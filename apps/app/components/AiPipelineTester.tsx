'use client';

import * as React from 'react';
import { ALL_LANGUAGE_CODES } from '@/lib/countries';
import { speak, transcribe, translate } from '@/lib/client-ai';
import { PhraseRecorder, type Phrase } from '@/lib/wav-recorder';

type StepState = 'idle' | 'running' | 'good' | 'bad';

type Result = {
  stt?: { state: StepState; ms?: number; text?: string; language?: string; error?: string; cost?: number };
  translation?: { state: StepState; ms?: number; text?: string; error?: string; cost?: number };
  tts?: { state: StepState; ms?: number; error?: string };
};

function cost(usage: any) {
  const value = usage?.cost;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function msLabel(value?: number) {
  return typeof value === 'number' ? `${Math.round(value)} ms` : '—';
}

export function AiPipelineTester() {
  const [targetLanguage, setTargetLanguage] = React.useState('en');
  const [status, setStatus] = React.useState('Ready');
  const [recording, setRecording] = React.useState(false);
  const [result, setResult] = React.useState<Result>({});
  const [audioUrl, setAudioUrl] = React.useState('');
  const recorderRef = React.useRef<PhraseRecorder | null>(null);
  const timeoutRef = React.useRef<number | null>(null);
  const handledRef = React.useRef(false);

  const cleanupRecorder = React.useCallback(() => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }, []);

  React.useEffect(() => () => {
    cleanupRecorder();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl, cleanupRecorder]);

  async function processPhrase(phrase: Phrase) {
    if (handledRef.current) return;
    handledRef.current = true;
    cleanupRecorder();

    let transcript = '';
    try {
      setStatus('Testing speech-to-text…');
      setResult({ stt: { state: 'running' } });
      const started = performance.now();
      const stt = await transcribe(phrase.bytes);
      transcript = stt.text?.trim() || '';
      if (!transcript) throw new Error('STT returned an empty transcript.');
      setResult({
        stt: {
          state: 'good',
          ms: performance.now() - started,
          text: transcript,
          language: stt.language,
          cost: cost(stt.usage),
        },
        translation: { state: 'running' },
      });
    } catch (error) {
      setStatus('STT failed');
      setResult({ stt: { state: 'bad', error: error instanceof Error ? error.message : String(error) } });
      return;
    }

    let translated = '';
    try {
      setStatus('Testing translation…');
      const started = performance.now();
      const translatedResult = await translate(transcript, { targetLanguage });
      translated = translatedResult.text?.trim() || '';
      if (!translated) throw new Error('Translation returned empty output.');
      setResult((current) => ({
        ...current,
        translation: {
          state: 'good',
          ms: performance.now() - started,
          text: translated,
          cost: cost(translatedResult.usage),
        },
        tts: { state: 'running' },
      }));
    } catch (error) {
      setStatus('Translation failed');
      setResult((current) => ({
        ...current,
        translation: { state: 'bad', error: error instanceof Error ? error.message : String(error) },
      }));
      return;
    }

    try {
      setStatus('Testing text-to-speech…');
      const started = performance.now();
      const blob = await speak(translated);
      if (!blob.size) throw new Error('TTS returned an empty audio response.');
      const url = URL.createObjectURL(blob);
      setAudioUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return url;
      });
      setResult((current) => ({
        ...current,
        tts: { state: 'good', ms: performance.now() - started },
      }));
      setStatus('Pipeline passed');
    } catch (error) {
      setStatus('TTS failed');
      setResult((current) => ({
        ...current,
        tts: { state: 'bad', error: error instanceof Error ? error.message : String(error) },
      }));
    }
  }

  async function start() {
    if (recording) return;
    setResult({});
    setStatus('Requesting microphone…');
    handledRef.current = false;

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl('');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      const recorder = new PhraseRecorder(stream, {
        silenceMs: 750,
        minSpeechMs: 300,
        maxPhraseMs: 5_000,
        threshold: 0.014,
        preRollMs: 180,
        onPhrase: (phrase) => void processPhrase(phrase),
      });
      recorderRef.current = recorder;
      await recorder.start();
      setRecording(true);
      setStatus('Speak one short phrase, then pause…');

      timeoutRef.current = window.setTimeout(() => {
        if (!handledRef.current) {
          handledRef.current = true;
          cleanupRecorder();
          setStatus('No speech detected');
          setResult({ stt: { state: 'bad', error: 'No speech phrase was detected within 12 seconds.' } });
        }
      }, 12_000);
    } catch (error) {
      cleanupRecorder();
      setStatus('Microphone unavailable');
      setResult({ stt: { state: 'bad', error: error instanceof Error ? error.message : String(error) } });
    }
  }

  function stop() {
    handledRef.current = true;
    cleanupRecorder();
    setStatus('Stopped');
  }

  const totalCost = (result.stt?.cost || 0) + (result.translation?.cost || 0);

  return (
    <section className="pipeline-card">
      <div className="pipeline-heading">
        <div>
          <div className="eyebrow">REAL AI PIPELINE</div>
          <h2>Mic → STT → Translate → Voice</h2>
        </div>
        <span className="pipeline-status" data-state={status === 'Pipeline passed' ? 'good' : result.stt?.state === 'bad' || result.translation?.state === 'bad' || result.tts?.state === 'bad' ? 'bad' : 'neutral'}>
          {status}
        </span>
      </div>

      <p className="diag-note pipeline-warning">This test uses real OpenRouter inference and may incur a small usage charge. It records only the short phrase you speak for this test.</p>

      <div className="pipeline-controls">
        <label>
          <span>Translate test output to</span>
          <select value={targetLanguage} disabled={recording} onChange={(event) => setTargetLanguage(event.target.value)}>
            {ALL_LANGUAGE_CODES.map((code) => <option key={code} value={code}>{code.toUpperCase()}</option>)}
          </select>
        </label>
        <button className={recording ? 'danger' : 'primary'} onClick={recording ? stop : start}>
          {recording ? 'Stop microphone' : 'Run speech pipeline'}
        </button>
      </div>

      <div className="pipeline-steps">
        <PipelineStep
          number="01"
          label="Speech to text"
          step={result.stt}
          detail={result.stt?.text ? `“${result.stt.text}”${result.stt.language ? ` · ${result.stt.language.toUpperCase()}` : ''}` : undefined}
        />
        <PipelineStep
          number="02"
          label="Translation"
          step={result.translation}
          detail={result.translation?.text ? `“${result.translation.text}”` : undefined}
        />
        <PipelineStep number="03" label="Text to speech" step={result.tts} />
      </div>

      {audioUrl && (
        <div className="pipeline-audio">
          <span>Generated voice</span>
          <audio src={audioUrl} controls preload="metadata" />
        </div>
      )}

      {totalCost > 0 && <p className="diag-note">Reported STT + translation usage: approximately ${totalCost.toFixed(6)} USD. TTS cost may not be present in the binary response metadata.</p>}
    </section>
  );
}

function PipelineStep({
  number,
  label,
  step,
  detail,
}: {
  number: string;
  label: string;
  step?: { state: StepState; ms?: number; error?: string };
  detail?: string;
}) {
  const state = step?.state || 'idle';
  return (
    <div className="pipeline-step" data-state={state}>
      <span>{number}</span>
      <div>
        <strong>{label}</strong>
        <small>{state === 'running' ? 'Running…' : state === 'good' ? msLabel(step?.ms) : state === 'bad' ? 'Failed' : 'Not run'}</small>
      </div>
      {detail && <p>{detail}</p>}
      {step?.error && <p className="pipeline-error">{step.error}</p>}
    </div>
  );
}
