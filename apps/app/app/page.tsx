'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ProfileForm } from '@/components/ProfileForm';
import { loadProfile } from '@/lib/profile';
import type { Profile } from '@/lib/types';

function roomId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export default function HomePage() {
  const router = useRouter();
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [checked, setChecked] = React.useState(false);
  const [joinValue, setJoinValue] = React.useState('');

  React.useEffect(() => { setProfile(loadProfile()); setChecked(true); }, []);
  if (!checked) return <main className="center-screen">Loading…</main>;

  if (!profile) {
    return (
      <main className="landing-shell">
        <header className="landing-header"><div className="brand-mark">VEYLO</div><span>Private multilingual communication</span></header>
        <section className="onboarding-wrap">
          <div className="eyebrow">PRIVATE CONVERSATION</div>
          <h1>Start with who you are.<br />Then just talk.</h1>
          <p className="lede">Start with your name and country. Spoken language is detected during the conversation.</p>
          <ProfileForm onDone={setProfile} />
        </section>
      </main>
    );
  }

  function join() {
    const value = joinValue.trim();
    if (!value) return;
    try {
      if (value.startsWith('http')) {
        const url = new URL(value);
        const pieces = url.pathname.split('/').filter(Boolean);
        const room = pieces[pieces.length - 1];
        if (room) return router.push(`/rooms/${room}`);
      }
    } catch {}
    router.push(`/rooms/${value.replace(/[^A-Za-z0-9_-]/g, '')}`);
  }

  return (
    <main className="landing-shell">
      <header className="landing-header">
        <div className="brand-mark">VEYLO</div>
        <div className="profile-chip"><strong>{profile.name}</strong><span>{profile.countryName} · {profile.preferredLanguage.toUpperCase()}</span></div>
      </header>
      <section className="home-hero">
        <div className="eyebrow">PRIVATE CONVERSATION</div>
        <h1>Speak freely.<br />Arrive understood.</h1>
        <p className="lede">Private multilingual calls on self-hosted LiveKit, with interpretation shaped to each listener through OpenRouter.</p>
      </section>
      <section className="mode-grid">
        <article className="mode-card primary-mode">
          <span>01</span><h2>Live Call</h2><p>Create an internal video room and invite anyone with a link.</p>
          <button className="primary" onClick={() => router.push(`/rooms/${roomId()}`)}>Create conversation</button>
          <div className="join-line"><input value={joinValue} onChange={(e) => setJoinValue(e.target.value)} placeholder="Room code or invite link" onKeyDown={(e) => e.key === 'Enter' && join()} /><button className="ghost" onClick={join}>Join</button></div>
        </article>
        <article className="mode-card"><span>02</span><h2>Face-to-Face</h2><p>Use one device as an interpreter between two people in the same room.</p><button className="ghost" onClick={() => router.push('/face-to-face')}>Open mode</button></article>
        <article className="mode-card"><span>03</span><h2>AI Simulation</h2><p>Practice a business conversation with an AI counterpart from any country.</p><button className="ghost" onClick={() => router.push('/simulation')}>Open mode</button></article>
      </section>
      <footer className="home-footer"><span>Self-hosted communication</span><span>OpenRouter inference</span><span>No user accounts</span></footer>
    </main>
  );
}
