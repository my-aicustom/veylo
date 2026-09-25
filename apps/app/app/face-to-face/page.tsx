'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { COUNTRY_LANGUAGE_HINTS, normalizeDetectedLanguage } from '@/lib/countries';
import { CountryPicker } from '@/components/CountryPicker';
import { LanguagePicker } from '@/components/LanguagePicker';
import { countryName, defaultLanguage, loadProfile } from '@/lib/profile';
import { PhraseRecorder } from '@/lib/wav-recorder';
import { isRecentSpeechEcho } from '@/lib/echo-guard';
import { analyzeMeeting, playSpeech, transcribe, translate } from '@/lib/client-ai';
import { downloadTranscript } from '@/lib/transcript-export';
import { clearTranscript, loadTranscript, saveTranscript, trimTranscript } from '@/lib/transcript-persistence';
import {
  clearMeetingIntelligence,
  downloadMeetingBrief,
  downloadMeetingJson,
  loadMeetingIntelligence,
  saveMeetingIntelligence,
} from '@/lib/meeting-intelligence';
import { listAudioDevices, type AudioDeviceChoice } from '@/lib/audio-devices';
import { glossaryToInput, loadSessionGlossary, parseGlossary, saveSessionGlossary } from '@/lib/session-glossary';
import type { MeetingIntelligence, Profile, TranscriptTurn } from '@/lib/types';
import { ProfileForm } from '@/components/ProfileForm';

const SESSION_ID = 'face-to-face:active';

export default function FaceToFacePage() {
  const router = useRouter();
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [ready, setReady] = React.useState(false);
  const [otherName, setOtherName] = React.useState('Guest');
  const [otherCountry, setOtherCountry] = React.useState('US');
  const [otherLanguage, setOtherLanguage] = React.useState(defaultLanguage('US'));
  const [running, setRunning] = React.useState(false);
  const [status, setStatus] = React.useState('Ready');
  const [turns, setTurns] = React.useState<TranscriptTurn[]>([]);
  const [inputs, setInputs] = React.useState<AudioDeviceChoice[]>([]);
  const [outputs, setOutputs] = React.useState<AudioDeviceChoice[]>([]);
  const [inputDeviceId, setInputDeviceId] = React.useState('default');
  const [outputDeviceId, setOutputDeviceId] = React.useState('default');
  const [outputSelectionSupported, setOutputSelectionSupported] = React.useState(false);
  const [report, setReport] = React.useState<MeetingIntelligence | null>(null);
  const [reportBusy, setReportBusy] = React.useState(false);
  const [reportError, setReportError] = React.useState('');
  const [glossaryInput, setGlossaryInput] = React.useState('');
  const [speakerMode, setSpeakerMode] = React.useState<'auto' | 'you' | 'other'>('auto');
  const [captureMode, setCaptureMode] = React.useState<'auto' | 'tap'>('auto');
  const [talkingSide, setTalkingSide] = React.useState<'you' | 'other' | null>(null);
  const recorderRef = React.useRef<PhraseRecorder | null>(null);
  const queueRef = React.useRef<Promise<void>>(Promise.resolve());
  const lastSide = React.useRef<'you' | 'other'>('other');
  const alive = React.useRef(false);
  const isPlayingAudioRef = React.useRef(false);
  const recentSpokenTexts = React.useRef<{ text: string; at: number }[]>([]);
  const sessionRef = React.useRef(0);
  const playbackRef = React.useRef<Promise<void> | null>(null);
  const heldSide = React.useRef<'you' | 'other' | null>(null);

  const refreshDevices = React.useCallback(async () => {
    try {
      const devices = await listAudioDevices();
      setInputs(devices.inputs);
      setOutputs(devices.outputs);
      setOutputSelectionSupported(devices.outputSelectionSupported);
    } catch {}
  }, []);

  React.useEffect(() => {
    setProfile(loadProfile());
    setTurns(loadTranscript(SESSION_ID));
    setReport(loadMeetingIntelligence(SESSION_ID));
    setGlossaryInput(glossaryToInput(loadSessionGlossary(SESSION_ID)));
    try {
      setInputDeviceId(window.localStorage.getItem('veylo:ftf-input') || 'default');
      setOutputDeviceId(window.localStorage.getItem('veylo:ftf-output') || 'default');
      const savedSpeakerMode = window.localStorage.getItem('veylo:ftf-speaker-mode');
      if (savedSpeakerMode === 'you' || savedSpeakerMode === 'other' || savedSpeakerMode === 'auto') setSpeakerMode(savedSpeakerMode);
    } catch {}
    void refreshDevices();
    setReady(true);
  }, [refreshDevices]);
  React.useEffect(() => setOtherLanguage(defaultLanguage(otherCountry)), [otherCountry]);
  React.useEffect(() => () => recorderRef.current?.stop(), []);
  React.useEffect(() => {
    const handler = () => void refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', handler);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', handler);
  }, [refreshDevices]);

  function inferSide(detected?: string) {
    if (speakerMode !== 'auto') return speakerMode;
    if (!profile) return 'other' as const;
    const lang = normalizeDetectedLanguage(detected) || '';
    const myHints = COUNTRY_LANGUAGE_HINTS[profile.countryCode] || [profile.preferredLanguage];
    const theirHints = COUNTRY_LANGUAGE_HINTS[otherCountry] || [otherLanguage];
    const mine = myHints.includes(lang) || lang === profile.preferredLanguage;
    const theirs = theirHints.includes(lang) || lang === otherLanguage;
    if (mine && !theirs) return 'you' as const;
    if (theirs && !mine) return 'other' as const;
    return lastSide.current === 'you' ? 'other' : 'you';
  }

  function commitTurns(update: (current: TranscriptTurn[]) => TranscriptTurn[]) {
    setTurns((current) => {
      const next = trimTranscript(update(current));
      saveTranscript(SESSION_ID, next);
      return next;
    });
  }

  function resetTranscript() {
    setTurns([]);
    setReport(null);
    setReportError('');
    clearTranscript(SESSION_ID);
    clearMeetingIntelligence(SESSION_ID);
  }

  async function play(text: string) {
    const recorder = recorderRef.current;
    const session = sessionRef.current;
    isPlayingAudioRef.current = true;
    recorder?.pause();
    try {
      await playSpeech(text, outputDeviceId);
    } finally {
      recentSpokenTexts.current = [...recentSpokenTexts.current.slice(-4), { text, at: Date.now() }];
      await new Promise((resolve) => window.setTimeout(resolve, 850));
      recorder?.reset();
      if (sessionRef.current === session) {
        isPlayingAudioRef.current = false;
        if (alive.current && recorderRef.current === recorder && captureMode === 'auto') recorder?.resume();
      }
    }
  }

  async function process(bytes: Uint8Array, forcedSide?: 'you' | 'other') {
    const session = sessionRef.current;
    if (!profile || !alive.current || isPlayingAudioRef.current) return;
    setStatus('Understanding…');
    const stt = await transcribe(bytes);
    const sourceText = stt.text.trim();
    if (!sourceText || !alive.current || sessionRef.current !== session || isPlayingAudioRef.current) return;

    if (isRecentSpeechEcho(sourceText, recentSpokenTexts.current)) {
      console.warn('[face-to-face] Ignored acoustic echo of AI playback:', sourceText);
      if (alive.current) setStatus('Listening');
      return;
    }
    const detected = normalizeDetectedLanguage(stt.language);
    const side = forcedSide || inferSide(detected);
    lastSide.current = side;
    const targetLanguage = side === 'you' ? otherLanguage : profile.preferredLanguage;
    const isSameLanguage = Boolean(detected && detected.toLowerCase() === targetLanguage.toLowerCase());
    let result = { text: sourceText };
    let translationState: TranscriptTurn['translationState'] = isSameLanguage ? 'same-language' : 'translated';
    if (!isSameLanguage) {
      try {
        result = await translate(sourceText, {
          sourceLanguage: detected,
          targetLanguage,
          sourceCountry: side === 'you' ? profile.countryName : countryName(otherCountry),
          targetCountry: side === 'you' ? countryName(otherCountry) : profile.countryName,
          glossary: parseGlossary(glossaryInput),
        });
      } catch (error) {
        translationState = 'failed';
        console.warn('[face-to-face] translation failed; preserving source transcript', error);
      }
    }
    if (!alive.current || sessionRef.current !== session) return;
    const turn: TranscriptTurn = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      participantName: side === 'you' ? profile.name : otherName,
      sourceText,
      translatedText: result.text,
      sourceLanguage: detected,
      targetLanguage,
      translationState,
    };
    commitTurns((current) => [...current, turn]);
    if (!isSameLanguage && translationState !== 'failed') {
      setStatus('Speaking translation…');
      const playback = play(result.text);
      playbackRef.current = playback.then(() => {}, () => {});
      await playback;
    } else if (translationState === 'failed') {
      setStatus('Translation temporarily unavailable · transcript preserved');
    }
    if (alive.current && sessionRef.current === session) setStatus('Listening');
  }

  async function start() {
    if (!profile) return;
    const session = ++sessionRef.current;
    let stream: MediaStream | undefined;
    try {
      if (playbackRef.current) await playbackRef.current;
      if (sessionRef.current !== session) return;
      isPlayingAudioRef.current = false;
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(inputDeviceId !== 'default' ? { deviceId: { exact: inputDeviceId } } : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (sessionRef.current !== session) { stream.getTracks().forEach((track) => track.stop()); return; }
      await refreshDevices();
      alive.current = true;
      queueRef.current = Promise.resolve();
      const recorder = new PhraseRecorder(stream, {
        silenceMs: 600,
        minSpeechMs: 280,
        maxPhraseMs: 5000,
        threshold: 0.015,
        onPhrase: (phrase) => {
          if (sessionRef.current !== session) return;
          const side = captureMode === 'tap' ? heldSide.current : undefined;
          if (captureMode === 'tap' && !side) return;
          if (isPlayingAudioRef.current) return;
          queueRef.current = queueRef.current.then(() => process(phrase.bytes, side || undefined)).catch((error) => {
            console.warn(error);
            setStatus('AI error · original conversation can continue');
          });
        },
      });
      recorderRef.current = recorder;
      await recorder.start();
      if (sessionRef.current !== session) { recorder.stop(); return; }
      if (captureMode === 'tap') recorder.pause();
      setRunning(true);
      setStatus(captureMode === 'tap' ? 'Hold a speaker button to talk' : 'Listening · language auto-detect on');
    } catch (error) {
      if (sessionRef.current !== session) return;
      recorderRef.current?.stop();
      recorderRef.current = null;
      stream?.getTracks().forEach((track) => track.stop());
      alive.current = false;
      setStatus(error instanceof Error ? error.message : 'Could not start microphone');
    }
  }

  function stop() {
    sessionRef.current += 1;
    heldSide.current = null;
    setTalkingSide(null);
    alive.current = false;
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRunning(false);
    setStatus('Stopped');
  }

  function beginTap(side: 'you' | 'other') {
    if (!alive.current || isPlayingAudioRef.current || heldSide.current) return;
    heldSide.current = side;
    setTalkingSide(side);
    recorderRef.current?.resume();
  }

  function endTap() {
    if (!heldSide.current) return;
    recorderRef.current?.flush();
    recorderRef.current?.pause();
    heldSide.current = null;
    setTalkingSide(null);
  }

  async function generateReport() {
    if (!turns.length || reportBusy) return;
    setReportBusy(true);
    setReportError('');
    try {
      const result = await analyzeMeeting(turns);
      setReport(result.report);
      saveMeetingIntelligence(SESSION_ID, result.report);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : 'Could not generate meeting brief');
    } finally {
      setReportBusy(false);
    }
  }

  function rememberInput(value: string) {
    setInputDeviceId(value);
    try { window.localStorage.setItem('veylo:ftf-input', value); } catch {}
  }

  function rememberOutput(value: string) {
    setOutputDeviceId(value);
    try { window.localStorage.setItem('veylo:ftf-output', value); } catch {}
  }

  function rememberSpeakerMode(value: 'auto' | 'you' | 'other') {
    setSpeakerMode(value);
    try { window.localStorage.setItem('veylo:ftf-speaker-mode', value); } catch {}
  }

  if (!ready) return <main className="center-screen">Loading…</main>;
  if (!profile) return <main className="center-screen"><section className="join-card"><h1>Set your profile</h1><ProfileForm onDone={setProfile} /></section></main>;

  const reportStale = Boolean(report && report.sourceTurnCount !== turns.length);

  return (
    <main className="tool-shell">
      <header className="tool-header">
        <button className="ghost small" onClick={() => router.push('/')}>← Home</button>
        <div><strong>Face-to-Face</strong><span aria-live="polite">{status}</span></div>
      </header>

      <section className="tool-grid">
        <div className="setup-card face-setup">
          <div className="eyebrow">ONE DEVICE / TWO PEOPLE</div>
          <h1>{profile.name} ↔ {otherName}</h1>
          <p className="setup-intro">Set who you are talking to. Veylo translates each turn aloud.</p>
          <div className="field-grid">
            <label><span>Other person</span><input value={otherName} disabled={running} onChange={(e) => setOtherName(e.target.value)} /></label>
            <CountryPicker label="Their country" value={otherCountry} disabled={running} onChange={setOtherCountry} />
            <LanguagePicker label="Language they hear" value={otherLanguage} disabled={running} onChange={setOtherLanguage} suggested={COUNTRY_LANGUAGE_HINTS[otherCountry] || []} />
          </div>
          <div className="route-card">
            <div><strong>{profile.name}</strong><span>{profile.countryName} · {profile.preferredLanguage.toUpperCase()}</span></div>
            <span>⇄</span>
            <div><strong>{otherName}</strong><span>{countryName(otherCountry)} · {otherLanguage.toUpperCase()}</span></div>
          </div>
          <button className={running ? 'danger' : 'primary'} onClick={running ? stop : start}>{running ? 'Stop interpreter' : 'Start interpreter'}</button>
          <div className="field-grid"><label><span>Microphone mode</span><select value={captureMode} disabled={running} onChange={(event) => setCaptureMode(event.target.value as 'auto' | 'tap')}><option value="auto">Automatic listening</option><option value="tap">Hold to talk</option></select></label></div>
          {captureMode === 'tap' && <div className="route-card" role="group" aria-label="Hold a speaker button while talking">
            {(['you', 'other'] as const).map((side) => <button key={side} type="button" disabled={!running} className={talkingSide === side ? 'primary' : 'ghost'} aria-pressed={talkingSide === side} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); beginTap(side); }} onPointerUp={endTap} onPointerCancel={endTap} onLostPointerCapture={endTap} onBlur={endTap} onKeyDown={(event) => { if (!event.repeat && (event.key === ' ' || event.key === 'Enter')) { event.preventDefault(); beginTap(side); } }} onKeyUp={(event) => { if (event.key === ' ' || event.key === 'Enter') endTap(); }}>{side === 'you' ? profile.name : otherName} · hold to talk</button>)}
          </div>}
          <details className="advanced-settings">
            <summary>Audio &amp; conversation settings <span>Microphone, speaker, glossary</span></summary>
            <div className="field-grid">
              <label><span>Microphone input</span><select value={inputDeviceId} disabled={running} onChange={(e) => rememberInput(e.target.value)}><option value="default">System default</option>{inputs.filter((item) => item.deviceId !== 'default').map((item) => <option key={item.deviceId} value={item.deviceId}>{item.label}</option>)}</select></label>
              <label><span>Translated audio output</span><select value={outputDeviceId} onChange={(e) => rememberOutput(e.target.value)} disabled={!outputSelectionSupported}><option value="default">System default</option>{outputs.filter((item) => item.deviceId !== 'default').map((item) => <option key={item.deviceId} value={item.deviceId}>{item.label}</option>)}</select></label>
              <label className="wide"><span>Protected terms / glossary</span><input value={glossaryInput} disabled={running} placeholder="Brand, SKU, product, Incoterm…" onChange={(e) => { const value = e.target.value; setGlossaryInput(value); saveSessionGlossary(SESSION_ID, parseGlossary(value)); }} /></label>
              <label><span>Speaker attribution</span><select value={speakerMode} onChange={(e) => rememberSpeakerMode(e.target.value as 'auto' | 'you' | 'other')}><option value="auto">Auto by language</option><option value="you">Force speaker = {profile.name}</option><option value="other">Force speaker = {otherName}</option></select></label>
            </div>
            <div className="device-note"><span>For two people at a table, use an external mic. If both speak the same language, set the speaker manually.</span><button className="text-button compact" onClick={refreshDevices}>Refresh devices</button></div>
            {!outputSelectionSupported && <p className="fineprint">Audio plays on your system-selected speaker or headset.</p>}
          </details>
        </div>

        <div className="transcript-card">
          <div className="transcript-card-head">
            <div><div className="eyebrow">LIVE TRANSCRIPT</div><small>Source language is auto-detected for each phrase.</small></div>
            {turns.length > 0 && (
              <div className="transcript-card-actions">
                <button className="ghost small" onClick={() => downloadTranscript(turns, 'face-to-face')}>Transcript</button>
                <button className="ghost small" disabled={reportBusy} onClick={generateReport}>{reportBusy ? 'Analyzing…' : report ? (reportStale ? 'Update brief' : 'Refresh brief') : 'Meeting brief'}</button>
                <button className="ghost small" onClick={resetTranscript}>Clear</button>
              </div>
            )}
          </div>
          {turns.length === 0 ? <div className="transcript-empty"><span>01 / READY WHEN YOU ARE</span><strong>Speak one thought.<br />Pause. Then switch sides.</strong><p>Original words, translation, and speaker will appear here as the conversation moves.</p></div> : turns.map((turn) => (
            <div className="turn" key={turn.id}>
              <span>{turn.participantName} · {(turn.sourceLanguage || 'auto').toUpperCase()} → {turn.targetLanguage.toUpperCase()}</span>
              <p>{turn.sourceText}</p>
              <strong>{turn.translationState === 'failed' ? 'Translation unavailable · original preserved' : turn.translatedText}</strong>
            </div>
          ))}
          {reportError && <div className="error-box compact-error">{reportError}</div>}
          {report && <MeetingBrief report={report} stale={reportStale} />}
        </div>
      </section>
    </main>
  );
}

function MeetingBrief({ report, stale }: { report: MeetingIntelligence; stale: boolean }) {
  return (
    <section className="meeting-intelligence-card embedded">
      <div className="meeting-intelligence-body">
        <div className="meeting-brief-title"><div><div className="eyebrow">MEETING INTELLIGENCE</div><h3>{report.meetingTitle}</h3></div><small>{stale ? 'Transcript changed · update recommended' : `${report.sourceTurnCount} turns analyzed`}</small></div>
        <p>{report.summary}</p>
        {report.parties.length > 0 && <ReportList title="Parties" items={report.parties.map((item) => [item.name, item.company, item.role, item.country].filter(Boolean).join(' · '))} />}
        {report.commercialItems.length > 0 && <ReportList title="Products / commercial" items={report.commercialItems.map((item) => [item.product, item.quantity, item.unit, item.price, item.currency, item.incoterm, item.delivery, item.notes].filter(Boolean).join(' · '))} />}
        {report.commitments.length > 0 && <ReportList title="Commitments" items={report.commitments.map((item) => `${item.party ? `${item.party}: ` : ''}${item.commitment}${item.due ? ` · ${item.due}` : ''}`)} />}
        {report.actionItems.length > 0 && <ReportList title="Action items" items={report.actionItems.map((item) => `${item.owner ? `${item.owner}: ` : ''}${item.action}${item.due ? ` · ${item.due}` : ''}${item.status ? ` · ${item.status}` : ''}`)} />}
        <ReportList title="Follow-ups" items={report.followUps} />
        <ReportList title="Open questions" items={report.openQuestions} />
        <ReportList title="Risks / ambiguities" items={report.risksOrAmbiguities} />
        <div className="report-actions">
          <button className="text-button" onClick={() => downloadMeetingBrief(report, 'face-to-face')}>Download brief</button>
          <button className="text-button" onClick={() => downloadMeetingJson(report, 'face-to-face')}>Export JSON</button>
        </div>
      </div>
    </section>
  );
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  const clean = items.filter(Boolean);
  if (!clean.length) return null;
  return <div className="report-section"><h4>{title}</h4><ul>{clean.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul></div>;
}
