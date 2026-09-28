'use client';

import * as React from 'react';
import { BrandMark } from '@/components/BrandMark';
import { VisualCanvas, type VisualCanvasView } from '@/components/VisualCanvas';
import { VoiceOrb, type VoiceOrbProps } from '@/components/VoiceOrb';
import { playSpeech, transcribe } from '@/lib/client-ai';
import { loadProfile } from '@/lib/profile';
import { apiUrl } from '@/lib/paths';
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

// ─── SSE Hook ─────────────────────────────────────────────────────────────────

function useTradeEvents(sessionId: string, onPanel: (panel: VisualCanvasView) => void) {
  const [live, setLive] = React.useState(false);
  const [waToast, setWaToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    let toastTimer: ReturnType<typeof setTimeout>;
    const es = new EventSource(apiUrl(`/api/trade-events?sessionId=${encodeURIComponent(sessionId)}`));

    es.addEventListener('connected', () => setLive(true));

    es.addEventListener('canvas-switch', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { panel: string; source?: string };
        const panel = data.panel === 'route-map' ? 'routes' : data.panel;
        if (!['routes', 'tariff', 'compliance', 'market'].includes(panel)) return;
        onPanel(panel as VisualCanvasView);
        if (data.source === 'whatsapp') {
          setWaToast(`📱 WhatsApp terhubung — menampilkan data ${data.panel}`);
          clearTimeout(toastTimer);
          toastTimer = setTimeout(() => setWaToast(null), 4000);
        }
      } catch { /* ignore malformed */ }
    });

    es.onerror = () => setLive(false);

    return () => { es.close(); clearTimeout(toastTimer); };
  }, [sessionId, onPanel]);

  return { live, waToast };
}

// ─── PDF Export Modal ─────────────────────────────────────────────────────────

type DocType = 'invoice' | 'packing-list' | 'ska-form-d';

const DOC_OPTIONS: { type: DocType; label: string; icon: string }[] = [
  { type: 'invoice',      label: 'Commercial Invoice',  icon: '📋' },
  { type: 'packing-list', label: 'Packing List',        icon: '📦' },
  { type: 'ska-form-d',   label: 'SKA Form D (ATIGA)',  icon: '📜' },
];

function ExportModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = React.useState<DocType | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    exporterName: 'PT. Nusantara Agro Ekspor',
    exporterAddress: 'Jl. Sudirman No. 1, Jakarta Selatan 12190, Indonesia',
    importerName: 'SingaTrade Global Pte. Ltd.',
    importerAddress: '1 Trade Boulevard, Singapore 018989',
    importerCountry: 'Singapore',
    portOfLoading: 'Tanjung Priok, Jakarta',
    portOfDischarge: 'Port of Singapore',
    incoterms: 'FOB',
    commodity: 'Kopi Arabika Gayo Grade 1',
    hsCode: '0901.11',
    qty: 5000,
    unit: 'kg',
    unitPrice: 4.50,
    currency: 'USD',
  });

  const totalFob = form.qty * form.unitPrice;

  async function download(type: DocType) {
    setLoading(type);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/export-doc'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          data: {
            exporterName: form.exporterName,
            exporterAddress: form.exporterAddress,
            importerName: form.importerName,
            importerAddress: form.importerAddress,
            importerCountry: form.importerCountry,
            portOfLoading: form.portOfLoading,
            portOfDischarge: form.portOfDischarge,
            incoterms: form.incoterms,
            countryOfOrigin: 'Indonesia',
            items: [
              {
                description: form.commodity,
                hsCode: form.hsCode,
                qty: Number(form.qty) || 1,
                unit: form.unit,
                unitPrice: Number(form.unitPrice) || 1,
                currency: form.currency,
                grossWeightKg: (Number(form.qty) || 1) * 1.05,
                netWeightKg: Number(form.qty) || 1,
                cbm: Math.round((Number(form.qty) || 1) * 0.0017 * 10) / 10,
                cartons: Math.ceil((Number(form.qty) || 1) / 25),
              },
            ],
          },
        }),
      });
      if (!res.ok) { setError('Gagal generate PDF. Coba lagi.'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.split('filename="')[1]?.replace(/"/g, '') ?? `veylo-${type}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('Koneksi gagal. Coba lagi.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="export-modal-overlay" role="dialog" aria-modal="true" aria-label="Ekspor Dokumen Perdagangan">
      <div className="export-modal">
        <div className="export-modal-header">
          <h2>📄 Generator Dokumen Ekspor Resmi</h2>
          <button type="button" aria-label="Tutup" onClick={onClose}>✕</button>
        </div>
        <p className="export-modal-desc">Sesuaikan data transaksi ekspor Anda di bawah ini, lalu pilih jenis dokumen yang ingin digenerate secara instan.</p>
        {error && <p className="export-modal-error">{error}</p>}

        <div className="export-form-grid">
          <div>
            <label className="export-field-label">Nama Eksportir (PT)</label>
            <input
              type="text"
              className="export-input"
              value={form.exporterName}
              onChange={(e) => setForm({ ...form, exporterName: e.target.value })}
            />
          </div>
          <div>
            <label className="export-field-label">Nama Buyer / Importer</label>
            <input
              type="text"
              className="export-input"
              value={form.importerName}
              onChange={(e) => setForm({ ...form, importerName: e.target.value })}
            />
          </div>
          <div className="export-field-full">
            <label className="export-field-label">Deskripsi Komoditas</label>
            <input
              type="text"
              className="export-input"
              value={form.commodity}
              onChange={(e) => setForm({ ...form, commodity: e.target.value })}
            />
          </div>
          <div>
            <label className="export-field-label">HS Code</label>
            <input
              type="text"
              className="export-input"
              value={form.hsCode}
              onChange={(e) => setForm({ ...form, hsCode: e.target.value })}
            />
          </div>
          <div>
            <label className="export-field-label">Pelabuhan Muat (POL)</label>
            <input
              type="text"
              className="export-input"
              value={form.portOfLoading}
              onChange={(e) => setForm({ ...form, portOfLoading: e.target.value })}
            />
          </div>
          <div>
            <label className="export-field-label">Kuantitas (Qty & Unit)</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="number"
                className="export-input"
                style={{ flex: 2 }}
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })}
              />
              <input
                type="text"
                className="export-input"
                style={{ flex: 1 }}
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="export-field-label">Harga Satuan (USD)</label>
            <input
              type="number"
              step="0.01"
              className="export-input"
              value={form.unitPrice}
              onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="export-calc-banner">
          <span>Total Nilai Ekspor ({form.incoterms}):</span>
          <strong>${totalFob.toLocaleString('en-US', { minimumFractionDigits: 2 })} {form.currency}</strong>
        </div>

        <div className="export-modal-options">
          {DOC_OPTIONS.map(({ type, label, icon }) => (
            <button
              key={type}
              type="button"
              className="export-doc-btn"
              disabled={loading !== null}
              onClick={() => void download(type)}
            >
              <span className="export-doc-icon">{loading === type ? '⏳' : icon}</span>
              <span>{label}</span>
              {loading === type && <span className="export-loading">Generating...</span>}
            </button>
          ))}
        </div>
        <p className="export-modal-note">✅ Dokumen dicetak dengan standar format ekspor internasional & legalitas kepabeanan.</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConsultationPage() {
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [status, setStatus] = React.useState<VoiceStatus>('idle');
  const [amplitude, setAmplitude] = React.useState(0.18);
  const [turns, setTurns] = React.useState<AdvisorTurn[]>([opening]);
  const [prompt, setPrompt] = React.useState('');
  const [activeView, setActiveView] = React.useState<VisualCanvasView>('routes');
  const [activeRoute, setActiveRoute] = React.useState('singapore');
  const [notice, setNotice] = React.useState('Klik orb untuk mulai bicara, atau ketik prompt di bawah.');
  const [geminiLiveStatus, setGeminiLiveStatus] = React.useState<'checking' | 'ready' | 'fallback'>('checking');
  const [showExport, setShowExport] = React.useState(false);
  const recorderRef = React.useRef<PhraseRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const busyRef = React.useRef(false);
  const submittingRef = React.useRef(false);
  const recordingGeneration = React.useRef(0);
  const startingRecording = React.useRef(false);

  // Stable session ID per page mount
  const [sessionId] = React.useState(() => crypto.randomUUID());

  const handlePanelSwitch = React.useCallback((panel: VisualCanvasView) => {
    setActiveView(panel);
  }, []);

  const handleLiveNotice = React.useCallback((message: string) => {
    setNotice(message);
    if (message.toLowerCase().includes('fallback')) setGeminiLiveStatus('fallback');
  }, []);

  const { live, waToast } = useTradeEvents(sessionId, handlePanelSwitch);

  React.useEffect(() => { setProfile(loadProfile()); }, []);
  React.useEffect(() => {
    let cancelled = false;
    fetch(apiUrl('/api/live-voice'), { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (cancelled) return;
        setGeminiLiveStatus(data?.configured && data?.available ? 'ready' : 'fallback');
      })
      .catch(() => {
        if (!cancelled) setGeminiLiveStatus('fallback');
      });
    return () => { cancelled = true; };
  }, []);
  React.useEffect(() => () => {
    recordingGeneration.current += 1;
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function toggleRecording() {
    if (startingRecording.current) {
      recordingGeneration.current += 1;
      startingRecording.current = false;
      recorderRef.current?.stop();
      recorderRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStatus('idle');
      return;
    }
    if (recorderRef.current) {
      recordingGeneration.current += 1;
      recorderRef.current.stop();
      recorderRef.current = null;
      streamRef.current = null;
      setStatus('idle');
      setAmplitude(0.18);
      setNotice('Voice session paused.');
      return;
    }

    startingRecording.current = true;
    const generation = ++recordingGeneration.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (generation !== recordingGeneration.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const recorder = new PhraseRecorder(stream, { onPhrase: handlePhrase, silenceMs: 950, minSpeechMs: 260 });
      recorderRef.current = recorder;
      await recorder.start();
      if (generation !== recordingGeneration.current) { recorder.stop(); return; }
      setStatus('listening');
      setAmplitude(0.72);
      setNotice('Listening. Bicara natural, saya akan tangkap kalimat saat jeda.');
    } catch (error) {
      if (generation !== recordingGeneration.current) return;
      recorderRef.current?.stop();
      recorderRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStatus('idle');
      setAmplitude(0.18);
      setNotice(error instanceof Error ? error.message : 'Microphone permission failed.');
    } finally {
      if (generation === recordingGeneration.current) startingRecording.current = false;
    }
  }

  async function handlePhrase(phrase: Phrase) {
    if (busyRef.current || submittingRef.current) return;
    busyRef.current = true;
    setStatus('thinking');
    setAmplitude(Math.min(1, Math.max(0.35, phrase.peak * 7)));
    try {
      const result = await transcribe(phrase.bytes, undefined, ['Veylo', 'HS Code', 'Tanjung Priok', 'Douala', 'Rotterdam', 'Jebel Ali']);
      if (result.text?.trim()) await submitMessage(result.text);
    } catch {
      setNotice('Transkripsi gagal. Silakan coba lagi atau ketik pesan.');
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
    if (!text || submittingRef.current) return;
    submittingRef.current = true;
    setPrompt('');
    setTurns((current) => [...current, { speaker: 'user', text }]);
    setStatus('thinking');
    setNotice('OpenRouter AI menganalisis rute, tarif, dan kepatuhan...');

    let advisorText = '';
    let viewToSet: VisualCanvasView = 'routes';
    let routeToSet: string | undefined;

    try {
      const res = await fetch(apiUrl('/api/trade-chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: turns.slice(-4),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        advisorText = data.reply;
        if (data.recommendedView) viewToSet = data.recommendedView;
        if (data.recommendedRoute) routeToSet = data.recommendedRoute;
      } else {
        const fallback = advisorReply(text);
        advisorText = fallback.text;
        viewToSet = fallback.view ?? 'routes';
        routeToSet = fallback.route;
      }
    } catch {
      const fallback = advisorReply(text);
      advisorText = fallback.text;
      viewToSet = fallback.view ?? 'routes';
      routeToSet = fallback.route;
    }

    setActiveView(viewToSet);
    if (routeToSet) setActiveRoute(routeToSet);

    const response: AdvisorTurn = {
      speaker: 'advisor',
      text: advisorText,
      view: viewToSet,
      route: routeToSet,
    };

    recorderRef.current?.pause();
    try {
      setTurns((current) => [...current, response]);
      setStatus('speaking');
      setAmplitude(0.94);
      setNotice('OpenRouter AI menjawab dengan data visual.');
      await playSpeech(response.text);
    } catch {
      setNotice('Audio tidak tersedia. Jawaban tetap dapat dibaca.');
    } finally {
      submittingRef.current = false;
      recorderRef.current?.resume();
      setStatus(recorderRef.current ? 'listening' : 'idle');
      setAmplitude(recorderRef.current ? 0.72 : 0.18);
    }
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
      {/* Toast */}
      {waToast && (
        <div className="wa-toast" role="status" aria-live="polite">{waToast}</div>
      )}

      {/* PDF Export Modal */}
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}

      <header className="consultation-header">
        <BrandMark href="/app" />
        <nav className="mode-nav" aria-label="Mode switcher">
          <a href="/app" className="mode-nav-btn">🌐 Trade Command</a>
          <a href="/app/consultation" className="mode-nav-btn active">🎙️ Voice Advisor</a>
          <a href="/app/face-to-face" className="mode-nav-btn">🤝 Face-to-Face</a>
          <a href="/app/simulation" className="mode-nav-btn">🎭 AI Simulation</a>
        </nav>
        <div className="consultation-actions">
          {/* SSE live indicator */}
          <span className={`live-badge ${live ? 'live-badge--on' : 'live-badge--off'}`} title={live ? 'Koneksi SSE aktif; pairing WhatsApp belum diverifikasi' : 'Menghubungkan...'}>
            {live ? '🔴 LIVE' : '⚪ SYNC'}
          </span>
          <span
            className={`live-badge ${geminiLiveStatus === 'ready' ? 'live-badge--on' : 'live-badge--off'}`}
            title={geminiLiveStatus === 'ready' ? 'Gemini Live Voice siap' : 'Fallback ke rekaman lokal bila Gemini belum siap'}
          >
            {geminiLiveStatus === 'ready' ? 'Gemini Live' : geminiLiveStatus === 'checking' ? 'Gemini check' : 'Gemini fallback'}
          </span>
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
            <p>Mode demonstrasi: jawaban teks dan angka canvas adalah contoh statis, belum analisis AI atas dokumen Anda.</p>
          </div>

          <VoiceOrb
            status={status}
            amplitude={amplitude}
            mode="live"
            liveAvailable={geminiLiveStatus === 'ready'}
            onClick={toggleRecording}
            onLiveStatus={setStatus}
            onLiveNotice={handleLiveNotice}
          />

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

      {/* Floating PDF Export Button */}
      <button
        type="button"
        className="export-fab"
        aria-label="Ekspor Dokumen Perdagangan"
        onClick={() => setShowExport(true)}
        title="Generate Commercial Invoice, Packing List, atau SKA Form D"
      >
        📄 Ekspor Dokumen
      </button>
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
