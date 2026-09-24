'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ALL_LANGUAGE_CODES, COUNTRIES } from '@/lib/countries';
import { countryName, defaultLanguage, loadProfile } from '@/lib/profile';
import { PhraseRecorder } from '@/lib/wav-recorder';
import { playSpeech, simulate, transcribe, translate } from '@/lib/client-ai';
import type { Profile } from '@/lib/types';
import { ProfileForm } from '@/components/ProfileForm';

type SimTurn = {
  id: string;
  speaker: 'you' | 'ai';
  text: string;
  translation?: string;
  at: string;
};

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
  const [turns, setTurns] = React.useState<SimTurn[]>([]);
  const recorderRef = React.useRef<PhraseRecorder | null>(null);
  const queueRef = React.useRef<Promise<void>>(Promise.resolve());
  const turnsRef = React.useRef<SimTurn[]>([]);
  const alive = React.useRef(false);

  React.useEffect(() => { setProfile(loadProfile()); setChecked(true); }, []);
  React.useEffect(() => setLanguage(defaultLanguage(country)), [country]);
  React.useEffect(() => { turnsRef.current = turns; }, [turns]);
  React.useEffect(() => () => recorderRef.current?.stop(), []);

  async function play(text: string) {
    recorderRef.current?.pause();
    try {
      await playSpeech(text);
    } finally {
      if (alive.current) recorderRef.current?.resume();
    }
  }

  async function process(bytes: Uint8Array) {
    if (!profile || !alive.current) return;
    setStatus('Understanding you…');
    const stt = await transcribe(bytes, profile.preferredLanguage);
    const text = stt.text.trim();
    if (!text || !alive.current) return;

    const priorHistory = turnsRef.current.slice(-12);
    const userTurn: SimTurn = {
      id: crypto.randomUUID(),
      speaker: 'you',
      text,
      at: new Date().toISOString(),
    };
    const history = [...turnsRef.current, userTurn];
    turnsRef.current = history;
    setTurns(history);
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
    if (!alive.current) return;

    const aiTurn: SimTurn = {
      id: crypto.randomUUID(),
      speaker: 'ai',
      text: result.reply,
      at: new Date().toISOString(),
    };
    const next = [...turnsRef.current, aiTurn];
    turnsRef.current = next;
    setTurns(next);
    setStatus('Speaking…');

    const subtitlePromise = language.toLowerCase() !== profile.preferredLanguage.toLowerCase()
      ? translate(result.reply, {
          sourceLanguage: language,
          targetLanguage: profile.preferredLanguage,
          sourceCountry: countryName(country),
          targetCountry: profile.countryName,
        }).then((translated) => {
          if (!alive.current) return;
          const updated = turnsRef.current.map((turn) =>
            turn.id === aiTurn.id ? { ...turn, translation: translated.text } : turn,
          );
          turnsRef.current = updated;
          setTurns(updated);
        }).catch((error) => {
          console.warn('[simulation] subtitle translation failed', error);
        })
      : Promise.resolve();

    await Promise.all([play(result.reply), subtitlePromise]);
    if (alive.current) setStatus('Listening');
  }

  async function start() {
    if (!profile) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      alive.current = true;
      queueRef.current = Promise.resolve();
      const recorder = new PhraseRecorder(stream, {
        silenceMs: 620,
        minSpeechMs: 280,
        maxPhraseMs: 5200,
        threshold: 0.015,
        onPhrase: (phrase) => {
          queueRef.current = queueRef.current.then(() => process(phrase.bytes)).catch((error) => {
            console.warn(error);
            setStatus('AI error · try again');
          });
        },
      });
      recorderRef.current = recorder;
      await recorder.start();
      setRunning(true);
      setStatus('Listening');
    } catch (error) {
      alive.current = false;
      setStatus(error instanceof Error ? error.message : 'Could not start microphone');
    }
  }

  function stop() {
    alive.current = false;
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRunning(false);
    setStatus('Stopped');
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
        <div className="setup-card">
          <div className="eyebrow">PRACTICE / INTERNATIONAL CONVERSATION</div>
          <h1>{role}</h1>
          <div className="field-grid">
            <label>
              <span>Counterpart country</span>
              <select value={country} disabled={running} onChange={(e) => setCountry(e.target.value)}>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </label>
            <label>
              <span>Counterpart language</span>
              <select value={language} disabled={running} onChange={(e) => setLanguage(e.target.value)}>
                {ALL_LANGUAGE_CODES.map((lang) => <option key={lang} value={lang}>{lang.toUpperCase()}</option>)}
              </select>
            </label>
            <label><span>Role</span><input value={role} disabled={running} onChange={(e) => setRole(e.target.value)} /></label>
            <label className="wide"><span>Scenario</span><input value={scenario} disabled={running} onChange={(e) => setScenario(e.target.value)} /></label>
          </div>

          <div className="route-card">
            <div><strong>{profile.name}</strong><span>{profile.countryName}</span></div>
            <span>↔ AI</span>
            <div><strong>{role}</strong><span>{countryName(country)} · {language.toUpperCase()}</span></div>
          </div>

          <button className={running ? 'danger' : 'primary'} onClick={running ? stop : start}>
            {running ? 'End simulation' : 'Start simulation'}
          </button>
        </div>

        <div className="transcript-card" aria-live="polite">
          <div className="eyebrow">CONVERSATION</div>
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
