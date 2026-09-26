'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { BrandMark } from '@/components/BrandMark';
import { VoiceOrb } from '@/components/VoiceOrb';
import { VisualCanvas, type VisualCanvasView } from '@/components/VisualCanvas';
import { loadProfile } from '@/lib/profile';
import { apiUrl } from '@/lib/paths';
import type { Profile } from '@/lib/types';

function roomId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function DualEntryCards({ onVoice }: { onVoice: () => void }) {
  return (
    <section className="dual-entry-grid" aria-label="Trade advisor entry options">
      <article className="dual-entry-card voice-entry">
        <div className="entry-copy">
          <span className="entry-kicker">AI Voice Trade Assistant (Jarvis Mode)</span>
          <h2>Konsultasi Suara Interaktif</h2>
          <p>Bicara langsung dengan AI ekspor bersuara native. Dilengkapi Voice Orb 60fps & Visual Canvas (Peta Rute Kargo Laut/Udara, Kalkulator Tarif HS Code, & Radar Kepatuhan).</p>
        </div>
        <div className="entry-visual" aria-hidden="true">
          <VoiceOrb status="speaking" amplitude={0.82} />
        </div>
        <div className="entry-action-row">
          <button className="primary" type="button" onClick={onVoice}>Mulai Konsultasi Suara</button>
          <span>Multimodal Gemini 2.5 · Instant Voice</span>
        </div>
      </article>
      <article className="dual-entry-card whatsapp-entry">
        <div className="entry-copy">
          <span className="entry-kicker">Fast WhatsApp Desk (+62 896-6015-2525)</span>
          <h2>Chat WhatsApp Resmi</h2>
          <p>Lebih suka chatan teks cepat tanpa bicara? Langsung terhubung ke AI Trade Intelligence & Konsultan Ekspor kami di WhatsApp resmi.</p>
        </div>
        <div className="whatsapp-visual" aria-hidden="true">
          <span>+62</span>
          <strong>896 6015 2525</strong>
          <small>Trade desk online</small>
        </div>
        <div className="entry-action-row">
          <a className="primary" href="https://wa.me/6289660152525?text=Halo%20Veylo%20Trade%20Advisor%2C%20saya%20ingin%20konsultasi%20ekspor%20impor%20dan%20regulasi%20pasar." target="_blank" rel="noreferrer">Mulai Chat WhatsApp</a>
          <span>Online 24/7 · WhatsApp Direct</span>
        </div>
      </article>
    </section>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [checked, setChecked] = React.useState(false);
  const [joinValue, setJoinValue] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [roomError, setRoomError] = React.useState('');
  const [canvasView, setCanvasView] = React.useState<VisualCanvasView>('routes');
  const [canvasRoute, setCanvasRoute] = React.useState('singapore');

  React.useEffect(() => { setProfile(loadProfile()); setChecked(true); }, []);
  if (!checked) return <main className="center-screen">Loading…</main>;

  async function createConversation() {
    if (creating) return;
    setCreating(true);
    setRoomError('');
    const room = roomId();

    try {
      const response = await fetch(apiUrl('/api/invite'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: room }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || 'Could not create room invite');

      const query = body?.token ? `?invite=${encodeURIComponent(body.token)}` : '';
      router.push(`/rooms/${room}${query}`);
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : 'Could not create conversation');
      setCreating(false);
    }
  }

  function join() {
    const value = joinValue.trim();
    if (!value) return;
    setRoomError('');

    try {
      if (value.startsWith('http')) {
        const url = new URL(value);
        const pieces = url.pathname.split('/').filter(Boolean);
        const roomIndex = pieces.lastIndexOf('rooms');
        const room = roomIndex >= 0 ? pieces[roomIndex + 1] : pieces[pieces.length - 1];
        if (room) {
          const invite = url.searchParams.get('invite');
          const query = invite ? `?invite=${encodeURIComponent(invite)}` : '';
          return router.push(`/rooms/${room}${query}`);
        }
      }
    } catch {}

    const room = value.replace(/[^A-Za-z0-9_-]/g, '');
    if (room) router.push(`/rooms/${room}`);
  }

  return (
    <main className="landing-shell">
      <header className="landing-header">
        <BrandMark />
        <nav className="mode-nav" aria-label="Quick navigation">
          <a href="/app" className="mode-nav-btn active">🌐 Trade Command</a>
          <a href="/app/consultation" className="mode-nav-btn">🎙️ Voice Advisor</a>
          <a href="/app/face-to-face" className="mode-nav-btn">🤝 Face-to-Face</a>
          <a href="/app/simulation" className="mode-nav-btn">🎭 AI Simulation</a>
        </nav>
        <div className="profile-chip">
          <strong>{profile?.name ?? 'Trade Guest'}</strong>
          <span>{profile ? `${profile.countryName} · ${profile.preferredLanguage.toUpperCase()}` : 'Global Trader'}</span>
        </div>
      </header>

      <section className="home-hero">
        <div className="eyebrow">VEYLO TRADE AI ADVISOR</div>
        <h1>Choose your export command center.</h1>
        <p className="lede">Masuk lewat suara native ala Jarvis atau chat WhatsApp resmi untuk konsultasi ekspor, impor, tarif HS Code, rute kargo, dan kesiapan dokumen.</p>
      </section>

      <DualEntryCards onVoice={() => router.push('/consultation')} />

      {/* Live Visual Canvas Showcase */}
      <section className="home-canvas-showcase" aria-label="Trade Intelligence Board">
        <div className="section-header">
          <div className="eyebrow">LIVE TRADE RADAR & SIMULATOR</div>
          <h2>Peta Rute Kargo, Tarif HS Code, & Radar Kepatuhan</h2>
          <p className="lede" style={{ marginTop: '8px', fontSize: '15px' }}>
            Eksplorasi koridor logistik maritim Tanjung Priok/Perak ke pelabuhan dunia, hitung tarif bea masuk komoditas unggulan, dan verifikasi sertifikasi ekspor secara interaktif.
          </p>
        </div>

        <VisualCanvas
          activeView={canvasView}
          activeRoute={canvasRoute}
          onViewChange={setCanvasView}
        />

        <div className="home-canvas-banner">
          <div>
            <p><strong>Konsultasi Suara Dua Arah & Generator PDF Kepabeanan Resmi</strong></p>
            <p>Bicara langsung dengan AI ekspor atau cetak Commercial Invoice, Packing List, & SKA Form D siap pakai.</p>
          </div>
          <button
            type="button"
            className="primary"
            onClick={() => router.push('/consultation')}
            style={{ whiteSpace: 'nowrap' }}
          >
            Buka Fullscreen Voice Advisor →
          </button>
        </div>
      </section>

      <section className="mode-grid" style={{ marginTop: '48px' }}>
        <article className="mode-card primary-mode">
          <span>01</span>
          <h2>Live Call</h2>
          <p>Create an internal video room and invite anyone with a signed link. (Requires LiveKit SFU server).</p>
          <button className="primary" onClick={createConversation} disabled={creating}>
            {creating ? 'Creating…' : 'Create conversation'}
          </button>
          <div className="join-line">
            <input
              value={joinValue}
              onChange={(e) => setJoinValue(e.target.value)}
              placeholder="Invite link or room code"
              onKeyDown={(e) => e.key === 'Enter' && join()}
            />
            <button className="ghost" onClick={join}>Join</button>
          </div>
          {roomError && <div className="error-box">{roomError}</div>}
        </article>
        <article className="mode-card">
          <span>02</span>
          <h2>Face-to-Face</h2>
          <p>Use one device as an interpreter between two people, with external-mic and headset routing support.</p>
          <button className="ghost" onClick={() => router.push('/face-to-face')}>Open mode</button>
        </article>
        <article className="mode-card">
          <span>03</span>
          <h2>AI Simulation</h2>
          <p>Practice a business conversation with an AI counterpart from any country.</p>
          <button className="ghost" onClick={() => router.push('/simulation')}>Open mode</button>
        </article>
      </section>

      <footer className="home-footer">
        <span>Self-hosted communication</span>
        <span>OpenRouter inference</span>
        <span>No user accounts</span>
        <span>Meeting intelligence export</span>
        <button className="footer-link" onClick={() => router.push('/diagnostics')}>Diagnostics</button>
      </footer>
    </main>
  );
}
