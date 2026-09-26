'use client';

import * as React from 'react';
import { BrandMark } from '@/components/BrandMark';
import { VisualCanvas, type VisualCanvasView } from '@/components/VisualCanvas';
import { VoiceOrb, type VoiceOrbProps } from '@/components/VoiceOrb';
import { playSpeech, transcribe } from '@/lib/client-ai';
import { loadProfile } from '@/lib/profile';
import { PhraseRecorder, type Phrase } from '@/lib/wav-recorder';
import type { Profile } from '@/lib/types';

type VoiceStatus = VoiceOrbProps['status'];
type AdvisorTurn = { speaker: 'user' | 'advisor'; text: string; view?: VisualCanvasView; route?: string };

const whatsappUrl = 'https://wa.me/6289660152525?text=Halo%20Veylo%20Trade%20Advisor%2C%20saya%20ingin%20konsultasi%20ekspor%20impor%20dan%20regulasi%20pasar.';

const scenarios = [
  'Rute Tanjung Priok ke Singapura',
  'Ekspor kopi HS 0901.11',
  'Kakao ke Afrika dan sertifikasi',
  'Audit dokumen ekspor saya',
  'Benchmark harga VCO FOB',
];

const opening: AdvisorTurn = {
  speaker: 'advisor',
  text: 'Halo, saya Veylo Trade Advisor. Ceritakan komoditas, negara tujuan, dan target jadwal kirim. Saya akan bantu pilih rute, HS Code, tarif, dan checklist dokumen.',
  view: 'routes',
  route: 'singapore',
};

export default function ConsultationPage() {
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [status, setStatus] = React.useState<VoiceStatus>('idle');
  const [amplitude, setAmplitude] = React.useState(0.18);
  const [turns, setTurns] = React.useState<AdvisorTurn[]>([opening]);
  const [prompt, setPrompt] = React.useState('');
  const [activeView, setActiveView] = React.useState<VisualCanvasView>('routes');
  const [activeRoute, setActiveRoute] = React.useState('singapore');
  const [notice, setNotice] = React.useState('Klik orb untuk mulai bicara, atau ketik prompt di bawah.');
  const recorderRef = React.useRef<PhraseRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const busyRef = React.useRef(false);

  React.useEffect(() => { setProfile(loadProfile()); }, []);
  React.useEffect(() => () => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function toggleRecording() {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
      streamRef.current = null;
      setStatus('idle');
      setAmplitude(0.18);
      setNotice('Voice session paused.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const recorder = new PhraseRecorder(stream, { onPhrase: handlePhrase, silenceMs: 950, minSpeechMs: 260 });
      recorderRef.current = recorder;
      await recorder.start();
      setStatus('listening');
      setAmplitude(0.72);
      setNotice('Listening. Bicara natural, saya akan tangkap kalimat saat jeda.');
    } catch (error) {
      setStatus('idle');
      setAmplitude(0.18);
      setNotice(error instanceof Error ? error.message : 'Microphone permission failed.');
    }
  }

  async function handlePhrase(phrase: Phrase) {
    if (busyRef.current) return;
    busyRef.current = true;
    setStatus('thinking');
    setAmplitude(Math.min(1, Math.max(0.35, phrase.peak * 7)));
    try {
      const result = await transcribe(phrase.bytes, undefined, ['Veylo', 'HS Code', 'Tanjung Priok', 'Douala', 'Rotterdam', 'Jebel Ali']);
      await submitMessage(result.text || 'Saya ingin konsultasi ekspor.');
    } catch {
      await submitMessage('Saya ingin konsultasi ekspor kopi dan rute pengiriman terbaik.');
    } finally {
      busyRef.current = false;
      if (recorderRef.current) {
        setStatus('listening');
        setAmplitude(0.72);
      }
    }
  }

  async function submitMessage(raw: string) {
    const text = raw.trim();
    if (!text) return;
    setPrompt('');
    setTurns((current) => [...current, { speaker: 'user', text }]);
    setStatus('thinking');
    setNotice('Menganalisis rute, tarif, dan kepatuhan...');

    const response = advisorReply(text);
    setActiveView(response.view ?? 'routes');
    if (response.route) setActiveRoute(response.route);

    window.setTimeout(() => {
      setTurns((current) => [...current, response]);
      setStatus('speaking');
      setAmplitude(0.94);
      setNotice('Advisor menjawab dengan konteks visual.');
      void playSpeech(response.text).catch(() => undefined).finally(() => {
        setStatus(recorderRef.current ? 'listening' : 'idle');
        setAmplitude(recorderRef.current ? 0.72 : 0.18);
      });
    }, 450);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage(prompt);
  }

  function runScenario(text: string) {
    void submitMessage(text);
  }

  return (
    <main className="consultation-shell">
      <header className="consultation-header">
        <BrandMark href="/" />
        <div className="consultation-actions">
          <div className="profile-chip">
            <strong>{profile?.name ?? 'Trade Guest'}</strong>
            <span>{profile ? `${profile.countryName} · ${profile.preferredLanguage.toUpperCase()}` : 'AI Trade Session'}</span>
          </div>
          <a className="primary" href={whatsappUrl} target="_blank" rel="noreferrer">Chat via WhatsApp</a>
        </div>
      </header>

      <section className="consultation-grid">
        <div className="voice-session-panel">
          <div className="voice-session-copy">
            <span className="eyebrow">AI VOICE TRADE ADVISOR</span>
            <h1>Konsultasi ekspor dengan suara dan visual real-time.</h1>
            <p>{notice}</p>
          </div>

          <VoiceOrb status={status} amplitude={amplitude} onClick={toggleRecording} />

          <div className="scenario-row" aria-label="Quick scenarios">
            {scenarios.map((scenario) => (
              <button key={scenario} type="button" onClick={() => runScenario(scenario)}>{scenario}</button>
            ))}
          </div>

          <div className="advisor-transcript" aria-live="polite">
            {turns.map((turn, index) => (
              <div key={`${turn.speaker}-${index}`} className={`advisor-bubble ${turn.speaker}`}>
                <span>{turn.speaker === 'user' ? 'Anda' : 'Veylo Advisor'}</span>
                <p>{turn.text}</p>
              </div>
            ))}
          </div>

          <form className="prompt-bar" onSubmit={onSubmit}>
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ketik: cek HS kopi ke Singapura, rute Douala, atau audit dokumen..."
            />
            <button className="primary" type="submit">Kirim</button>
          </form>
        </div>

        <aside className="context-panel">
          <VisualCanvas activeView={activeView} activeRoute={activeRoute} onViewChange={setActiveView} />
        </aside>
      </section>
    </main>
  );
}

function advisorReply(text: string): AdvisorTurn {
  const lower = text.toLowerCase();
  if (lower.includes('douala') || lower.includes('kamerun') || lower.includes('afrika')) {
    return {
      speaker: 'advisor',
      text: 'Untuk Douala, opsi realistis adalah laut 28-35 hari via Singapore atau Colombo. Fokuskan dokumen asal barang, phytosanitary bila pangan, dan buffer demurrage karena clearance Afrika Barat bisa fluktuatif.',
      view: 'routes',
      route: 'douala',
    };
  }
  if (lower.includes('rotterdam') || lower.includes('eropa')) {
    return {
      speaker: 'advisor',
      text: 'Ke Rotterdam, Tanjung Perak biasanya kompetitif untuk komoditas Jawa Timur. Pastikan standard EU buyer, fumigasi bila perlu, dan jadwalkan vessel 24-28 hari plus waktu pemeriksaan dokumen.',
      view: 'routes',
      route: 'rotterdam',
    };
  }
  if (lower.includes('jebel') || lower.includes('dubai') || lower.includes('timur tengah')) {
    return {
      speaker: 'advisor',
      text: 'Untuk Jebel Ali, gunakan rute laut 14-18 hari dan manfaatkan free zone Dubai sebagai hub re-export. Saya sarankan quotation FOB dan CFR dibandingkan agar margin terlihat jelas.',
      view: 'routes',
      route: 'jebel-ali',
    };
  }
  if (lower.includes('hs') || lower.includes('tarif') || lower.includes('kopi') || lower.includes('kakao') || lower.includes('coconut') || lower.includes('vco')) {
    return {
      speaker: 'advisor',
      text: 'Saya buka navigator HS Code. Untuk kopi HS 0901.11 atau kakao HS 1801.00, cek dulu status FTA dan invoice value. Simulasi duty saving membantu menentukan apakah SKA Form D layak diprioritaskan.',
      view: 'tariff',
    };
  }
  if (lower.includes('sertifikasi') || lower.includes('dokumen') || lower.includes('audit') || lower.includes('halal') || lower.includes('haccp')) {
    return {
      speaker: 'advisor',
      text: 'Radar kepatuhan menunjukkan baseline 92% export ready. Titik yang paling sering menahan shipment adalah phytosanitary, standard buyer negara tujuan, dan konsistensi PEB, packing list, invoice, serta Bill of Lading.',
      view: 'compliance',
    };
  }
  if (lower.includes('harga') || lower.includes('demand') || lower.includes('buyer') || lower.includes('market') || lower.includes('benchmark')) {
    return {
      speaker: 'advisor',
      text: 'Saya tampilkan market demand dan benchmark FOB. Gunakan angka ini sebagai pembuka negosiasi, lalu validasi ulang dengan grade, moisture, volume, Incoterms, dan jadwal stuffing.',
      view: 'market',
    };
  }
  return {
    speaker: 'advisor',
    text: 'Untuk awal cepat, saya sarankan rute Tanjung Priok ke Singapore sebagai hub: transit 2-3 hari laut atau 1.5 jam udara. Dari sana kita bisa lanjut hitung HS Code, dokumen, dan proyeksi landed cost.',
    view: 'routes',
    route: 'singapore',
  };
}
