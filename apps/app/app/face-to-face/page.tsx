'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ALL_LANGUAGE_CODES, COUNTRIES, COUNTRY_LANGUAGE_HINTS } from '@/lib/countries';
import { countryName, defaultLanguage, loadProfile } from '@/lib/profile';
import { PhraseRecorder } from '@/lib/wav-recorder';
import { speak, transcribe, translate } from '@/lib/client-ai';
import type { Profile, TranscriptTurn } from '@/lib/types';
import { ProfileForm } from '@/components/ProfileForm';

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
  const recorderRef = React.useRef<PhraseRecorder | null>(null);
  const queueRef = React.useRef<Promise<void>>(Promise.resolve());
  const lastSide = React.useRef<'you' | 'other'>('other');
  const alive = React.useRef(false);

  React.useEffect(() => { setProfile(loadProfile()); setReady(true); }, []);
  React.useEffect(() => setOtherLanguage(defaultLanguage(otherCountry)), [otherCountry]);
  React.useEffect(() => () => recorderRef.current?.stop(), []);

  function inferSide(detected?: string) {
    if (!profile) return 'other' as const;
    const lang = (detected || '').split('-')[0];
    const myHints = COUNTRY_LANGUAGE_HINTS[profile.countryCode] || [profile.preferredLanguage];
    const theirHints = COUNTRY_LANGUAGE_HINTS[otherCountry] || [otherLanguage];
    const mine = myHints.includes(lang) || lang === profile.preferredLanguage;
    const theirs = theirHints.includes(lang) || lang === otherLanguage;
    if (mine && !theirs) return 'you' as const;
    if (theirs && !mine) return 'other' as const;
    return lastSide.current === 'you' ? 'other' : 'you';
  }

  async function play(text: string) {
    recorderRef.current?.pause();
    try {
      const blob = await speak(text);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      try {
        await audio.play();
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.onpause = () => resolve();
        });
      } finally { URL.revokeObjectURL(url); }
    } finally {
      if (alive.current) recorderRef.current?.resume();
    }
  }

  async function process(bytes: Uint8Array) {
    if (!profile || !alive.current) return;
    setStatus('Understanding…');
    const stt = await transcribe(bytes);
    const sourceText = stt.text.trim();
    if (!sourceText || !alive.current) return;
    const detected = (stt.language || '').split('-')[0] || undefined;
    const side = inferSide(detected);
    lastSide.current = side;
    const targetLanguage = side === 'you' ? otherLanguage : profile.preferredLanguage;
    const result = await translate(sourceText, {
      sourceLanguage: detected,
      targetLanguage,
      sourceCountry: side === 'you' ? profile.countryName : countryName(otherCountry),
      targetCountry: side === 'you' ? countryName(otherCountry) : profile.countryName,
    });
    if (!alive.current) return;
    const turn: TranscriptTurn = {
      id: crypto.randomUUID(), at: new Date().toISOString(),
      participantName: side === 'you' ? profile.name : otherName,
      sourceText, translatedText: result.text, sourceLanguage: detected, targetLanguage,
    };
    setTurns((current) => [...current.slice(-49), turn]);
    setStatus('Speaking translation…');
    await play(result.text);
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
        silenceMs: 600, minSpeechMs: 280, maxPhraseMs: 5000, threshold: 0.015,
        onPhrase: (phrase) => {
          queueRef.current = queueRef.current.then(() => process(phrase.bytes)).catch((error) => {
            console.warn(error); setStatus('AI error · try again');
          });
        },
      });
      recorderRef.current = recorder;
      await recorder.start();
      setRunning(true); setStatus('Listening');
    } catch (error) {
      alive.current = false;
      setStatus(error instanceof Error ? error.message : 'Could not start microphone');
    }
  }

  function stop() {
    alive.current = false;
    recorderRef.current?.stop(); recorderRef.current = null;
    setRunning(false); setStatus('Stopped');
  }

  if (!ready) return <main className="center-screen">Loading…</main>;
  if (!profile) return <main className="center-screen"><section className="join-card"><h1>Set your profile</h1><ProfileForm onDone={setProfile} /></section></main>;

  return (
    <main className="tool-shell">
      <header className="tool-header"><button className="ghost small" onClick={() => router.push('/')}>← Home</button><div><strong>Face-to-Face</strong><span>{status}</span></div></header>
      <section className="tool-grid">
        <div className="setup-card">
          <div className="eyebrow">ONE DEVICE / TWO PEOPLE</div>
          <h1>{profile.name} ↔ {otherName}</h1>
          <div className="field-grid">
            <label><span>Other person</span><input value={otherName} disabled={running} onChange={(e) => setOtherName(e.target.value)} /></label>
            <label><span>Country</span><select value={otherCountry} disabled={running} onChange={(e) => setOtherCountry(e.target.value)}>{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
            <label><span>Their output language</span><select value={otherLanguage} disabled={running} onChange={(e) => setOtherLanguage(e.target.value)}>{ALL_LANGUAGE_CODES.map((lang) => <option key={lang} value={lang}>{lang.toUpperCase()}</option>)}</select></label>
          </div>
          <div className="route-card"><div><strong>{profile.name}</strong><span>{profile.countryName} · {profile.preferredLanguage.toUpperCase()}</span></div><span>⇄</span><div><strong>{otherName}</strong><span>{countryName(otherCountry)} · {otherLanguage.toUpperCase()}</span></div></div>
          <button className={running ? 'danger' : 'primary'} onClick={running ? stop : start}>{running ? 'Stop interpreter' : 'Start interpreter'}</button>
        </div>
        <div className="transcript-card">
          <div className="eyebrow">LIVE TRANSCRIPT</div>
          {turns.length === 0 ? <p className="empty-caption">Conversation will appear here.</p> : turns.map((turn) => <div className="turn" key={turn.id}><span>{turn.participantName}</span><p>{turn.sourceText}</p><strong>{turn.translatedText}</strong></div>)}
        </div>
      </section>
    </main>
  );
}
