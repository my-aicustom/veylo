'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { COUNTRY_LANGUAGE_HINTS } from '@/lib/countries';
import { CountryPicker } from '@/components/CountryPicker';
import { LanguagePicker } from '@/components/LanguagePicker';
import { countryName, defaultLanguage, loadProfile } from '@/lib/profile';
import { PhraseRecorder } from '@/lib/wav-recorder';
import { isRecentSpeechEcho } from '@/lib/echo-guard';
import { playSpeech, simulate, transcribe, translate } from '@/lib/client-ai';
import { listAudioDevices, type AudioDeviceChoice } from '@/lib/audio-devices';
import { clearSimulation, downloadSimulation, loadSimulation, saveSimulation, type SimulationTurn } from '@/lib/simulation-persistence';
import type { Profile } from '@/lib/types';
import { ProfileForm } from '@/components/ProfileForm';

export default function SimulationPage() {
  const router = useRouter();
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [checked, setChecked] = React.useState(false);
  const [country, setCountry] = React.useState('JP');
  const [language, setLanguage] = React.useState(defaultLanguage('JP'));
  const [role, setRole] = React.useState('International buyer');
  const [scenario, setScenario] = React.useState('Trade Expo Indonesia business meeting');
  const [running, setRunning] = React.useState(false);
  const [status, setStatus] = React.useState('Ready');
  const [turns, setTurns] = React.useState<SimulationTurn[]>([]);
  const [inputs, setInputs] = React.useState<AudioDeviceChoice[]>([]);
  const [outputs, setOutputs] = React.useState<AudioDeviceChoice[]>([]);
  const [inputDeviceId, setInputDeviceId] = React.useState('default');
  const [outputDeviceId, setOutputDeviceId] = React.useState('default');
  const [outputSelectionSupported, setOutputSelectionSupported] = React.useState(false);
  const recorderRef = React.useRef<PhraseRecorder | null>(null);
  const queueRef = React.useRef<Promise<void>>(Promise.resolve());
  const turnsRef = React.useRef<SimulationTurn[]>([]);
  const sessionId = React.useMemo(() => `simulation:${country}:${role.trim().toLowerCase().slice(0, 36)}:${scenario.trim().toLowerCase().slice(0, 48)}`, [country, role, scenario]);
  const alive = React.useRef(false);
  const isPlayingAudioRef = React.useRef(false);
  const recentSpokenTexts = React.useRef<{ text: string; at: number }[]>([]);
  const sessionRef = React.useRef(0);
  const playbackRef = React.useRef<Promise<void> | null>(null);

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
    try {
      setInputDeviceId(window.localStorage.getItem('veylo:sim-input') || 'default');
      setOutputDeviceId(window.localStorage.getItem('veylo:sim-output') || 'default');
    } catch {}
    void refreshDevices();
    setChecked(true);
  }, [refreshDevices]);
  React.useEffect(() => setLanguage(defaultLanguage(country)), [country]);
  React.useEffect(() => {
    const restored = loadSimulation(sessionId);
    turnsRef.current = restored;
    setTurns(restored);
  }, [sessionId]);
  React.useEffect(() => { turnsRef.current = turns; }, [turns]);
  React.useEffect(() => () => {
    alive.current = false;
    sessionRef.current += 1;
    recorderRef.current?.stop();
  }, []);
  React.useEffect(() => {
    const handler = () => void refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', handler);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', handler);
  }, [refreshDevices]);

  async function play(text: string) {
    const recorder = recorderRef.current;
    const session = sessionRef.current;
    isPlayingAudioRef.current = true;
    recorder?.pause();
    try {
      await playSpeech(text, outputDeviceId);
    } finally {
      recentSpokenTexts.current = [...recentSpokenTexts.current.slice(-4), { text, at: Date.now() }];
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      recorder?.reset();
      if (sessionRef.current === session) {
        isPlayingAudioRef.current = false;
        if (alive.current && recorderRef.current === recorder) recorder?.resume();
      }
    }
  }

  function commit(next: SimulationTurn[]) {
    const bounded = next.slice(-160);
    turnsRef.current = bounded;
    setTurns(bounded);
    saveSimulation(sessionId, bounded);
  }

  async function process(bytes: Uint8Array) {
    const session = sessionRef.current;
    if (!profile || !alive.current || isPlayingAudioRef.current) return;
    setStatus('Understanding you…');
    const stt = await transcribe(bytes, undefined, [profile.name, role, scenario]);
    const text = stt.text.trim();
    if (!text || !alive.current || sessionRef.current !== session || isPlayingAudioRef.current) return;

    if (isRecentSpeechEcho(text, recentSpokenTexts.current)) {
      console.warn('[simulation] Ignored acoustic echo of AI voice:', text);
      if (alive.current) setStatus('Listening');
      return;
    }

    const priorHistory = turnsRef.current.slice(-12);
    const userTurn: SimulationTurn = {
      id: crypto.randomUUID(),
      speaker: 'you',
      text,
      at: new Date().toISOString(),
    };
    const history = [...turnsRef.current, userTurn];
    commit(history);
    setStatus('Counterpart is responding…');

    const result = await simulate({
      text,
      profile,
      country: countryName(country),
      role,
      scenario,
      language,
      history: priorHistory.map((turn) => ({
        speaker: turn.speaker,
        sourceText: turn.speaker === 'you' ? turn.text : undefined,
        translatedText: turn.speaker === 'ai' ? turn.text : undefined,
      })),
    });
    if (!alive.current || sessionRef.current !== session) return;

    const aiTurn: SimulationTurn = {
      id: crypto.randomUUID(),
      speaker: 'ai',
      text: result.reply,
      at: new Date().toISOString(),
    };
    const next = [...turnsRef.current, aiTurn];
    commit(next);
    setStatus('Speaking…');

    const subtitlePromise = language.toLowerCase() !== profile.preferredLanguage.toLowerCase()
      ? translate(result.reply, {
          sourceLanguage: language,
          targetLanguage: profile.preferredLanguage,
          sourceCountry: countryName(country),
          targetCountry: profile.countryName,
        }).then((translated) => {
          if (!alive.current || sessionRef.current !== session) return;
          const updated = turnsRef.current.map((turn) =>
            turn.id === aiTurn.id ? { ...turn, translation: translated.text } : turn,
          );
          commit(updated);
        }).catch((error) => {
          console.warn('[simulation] subtitle translation failed', error);
        })
      : Promise.resolve();

    const playback = play(result.reply);
    playbackRef.current = playback.then(() => {}, () => {});
    await Promise.all([playback, subtitlePromise]);
    if (alive.current && sessionRef.current === session) setStatus('Listening');
  }

  async function start(deviceId = inputDeviceId) {
    if (!profile) return;
    const session = ++sessionRef.current;
    let stream: MediaStream | undefined;
    try {
      if (playbackRef.current) await playbackRef.current;
      if (sessionRef.current !== session) return;
      isPlayingAudioRef.current = false;
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId !== 'default' ? { deviceId: { exact: deviceId } } : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (sessionRef.current !== session) { stream.getTracks().forEach((track) => track.stop()); return; }
      stream.getAudioTracks().forEach((track) => track.addEventListener('ended', () => {
        if (sessionRef.current === session) { stop(); setStatus('Microphone disconnected · choose another input'); }
      }, { once: true }));
      await refreshDevices();
      alive.current = true;
      queueRef.current = Promise.resolve();
      const recorder = new PhraseRecorder(stream, {
        silenceMs: 1_100,
        minSpeechMs: 280,
        maxPhraseMs: 20_000,
        threshold: 0.015,
        onPhrase: (phrase) => {
          if (sessionRef.current !== session) return;
          if (isPlayingAudioRef.current) return;
          queueRef.current = queueRef.current.then(() => {
            if (sessionRef.current === session) return process(phrase.bytes);
          }).catch((error) => {
            if (sessionRef.current !== session) return;
            console.warn(error);
            setStatus('AI error · try again');
          });
        },
      });
      recorderRef.current = recorder;
      await recorder.start();
      if (sessionRef.current !== session) { recorder.stop(); return; }
      setRunning(true);
      setStatus('Listening');
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
    alive.current = false;
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRunning(false);
    setStatus('Stopped');
  }

  function rememberInput(value: string) {
    setInputDeviceId(value);
    try { window.localStorage.setItem('veylo:sim-input', value); } catch {}
    if (running) {
      stop();
      setStatus('Switching microphone…');
      void start(value);
    }
  }

  function rememberOutput(value: string) {
    setOutputDeviceId(value);
    try { window.localStorage.setItem('veylo:sim-output', value); } catch {}
  }

  function resetSimulation() {
    turnsRef.current = [];
    setTurns([]);
    clearSimulation(sessionId);
  }

  if (!checked) return <main className="center-screen">Loading…</main>;
  if (!profile) {
    return (
      <main className="center-screen">
        <section className="join-card">
          <h1>Set your profile</h1>
          <ProfileForm onDone={setProfile} />
        </section>
      </main>
    );
  }

  return (
    <main className="tool-shell">
      <header className="tool-header">
        <button className="ghost small" onClick={() => router.push('/')}>← Home</button>
        <div><strong>AI Simulation</strong><span aria-live="polite">{status}</span></div>
      </header>

      <section className="tool-grid">
        <div className="setup-card simulation-setup">
          <div className="eyebrow">PRACTICE / INTERNATIONAL CONVERSATION</div>
          <h1>{role}</h1>
          <div className="field-grid">
            <CountryPicker label="Counterpart country" value={country} disabled={running} onChange={setCountry} />
            <LanguagePicker label="Counterpart language" value={language} disabled={running} onChange={setLanguage} suggested={COUNTRY_LANGUAGE_HINTS[country] || []} />
            <label><span>Role</span><input value={role} disabled={running} onChange={(e) => setRole(e.target.value)} /></label>
          </div>

          <div className="route-card">
            <div><strong>{profile.name}</strong><span>{profile.countryName}</span></div>
            <span>↔ AI</span>
            <div><strong>{role}</strong><span>{countryName(country)} · {language.toUpperCase()}</span></div>
          </div>

          <button className={running ? 'danger' : 'primary'} onClick={running ? stop : () => { void start(); }}>
            {running ? 'End simulation' : 'Start simulation'}
          </button>
          <details className="advanced-settings">
            <summary>Scenario &amp; audio settings <span>Conversation context, microphone, speaker</span></summary>
            <div className="field-grid">
              <label className="wide"><span>Scenario</span><input value={scenario} disabled={running} onChange={(e) => setScenario(e.target.value)} /></label>
              <label><span>Microphone input</span><select value={inputDeviceId} onChange={(e) => rememberInput(e.target.value)}><option value="default">System default</option>{inputs.filter((item) => item.deviceId !== 'default').map((item) => <option key={item.deviceId} value={item.deviceId}>{item.label}</option>)}</select></label>
              <label><span>AI voice output</span><select value={outputDeviceId} onChange={(e) => rememberOutput(e.target.value)} disabled={!outputSelectionSupported}><option value="default">System default</option>{outputs.filter((item) => item.deviceId !== 'default').map((item) => <option key={item.deviceId} value={item.deviceId}>{item.label}</option>)}</select></label>
            </div>
          </details>
        </div>

        <div className="transcript-card" aria-live="polite">
          <div className="transcript-card-head">
            <div><div className="eyebrow">CONVERSATION</div><small>Simulation history is retained locally for this scenario.</small></div>
            {turns.length > 0 && <div className="transcript-card-actions"><button className="ghost small" onClick={() => downloadSimulation(turns, role, countryName(country))}>Download</button><button className="ghost small" onClick={resetSimulation}>Clear</button></div>}
          </div>
          {turns.length === 0 ? (
            <p className="empty-caption">Your simulated conversation will appear here.</p>
          ) : turns.map((turn) => (
            <div className={`turn ${turn.speaker}`} key={turn.id}>
              <span>{turn.speaker === 'you' ? profile.name : role}</span>
              <p>{turn.text}</p>
              {turn.speaker === 'ai' && turn.translation && (
                <p className="sim-translation">{turn.translation}</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
