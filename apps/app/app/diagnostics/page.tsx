'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/paths';
import { clearLatencyTraces, loadLatencyTraces } from '@/lib/latency-telemetry';
import { clearNetworkEvents, loadNetworkEvents, type NetworkEventTrace } from '@/lib/network-telemetry';
import type { LatencyTrace } from '@/lib/types';

type Health = {
  app: string;
  version: string;
  serverTime: string;
  config: Record<string, unknown>;
  checks?: {
    openrouter?: any;
    livekit?: any;
  };
};

type BrowserChecks = {
  online: boolean;
  secureContext: boolean;
  mediaDevices: boolean;
  webRtc: boolean;
  webSocket: boolean;
  audioWorklet: boolean;
  outputRouting: boolean;
  storage: boolean;
  microphone: string;
  camera: string;
  audioInputs: number;
  audioOutputs: number;
  videoInputs: number;
  networkType: string;
};

function state(value: boolean | undefined) {
  return value ? 'good' : 'bad';
}

function formatMs(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`;
}

function median(values: Array<number | undefined>) {
  const clean = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!clean.length) return undefined;
  const sorted = [...clean].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export default function DiagnosticsPage() {
  const router = useRouter();
  const [health, setHealth] = React.useState<Health | null>(null);
  const [browser, setBrowser] = React.useState<BrowserChecks | null>(null);
  const [runtime, setRuntime] = React.useState<{ online: boolean; secureContext: boolean } | null>(null);
  const [latencyTraces, setLatencyTraces] = React.useState<LatencyTrace[]>([]);
  const [networkEvents, setNetworkEvents] = React.useState<NetworkEventTrace[]>([]);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setRuntime({ online: navigator.onLine, secureContext: window.isSecureContext });
    setLatencyTraces(loadLatencyTraces());
    setNetworkEvents(loadNetworkEvents());

    const onOnline = () => setRuntime((current) => ({ online: true, secureContext: current?.secureContext ?? window.isSecureContext }));
    const onOffline = () => setRuntime((current) => ({ online: false, secureContext: current?.secureContext ?? window.isSecureContext }));

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    fetch(apiUrl('/api/health'), { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error || 'Health endpoint failed');
        setHealth(body);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  async function runChecks() {
    setRunning(true);
    setError('');

    try {
      const basic: BrowserChecks = {
        online: navigator.onLine,
        secureContext: window.isSecureContext,
        mediaDevices: Boolean(navigator.mediaDevices?.getUserMedia),
        webRtc: typeof RTCPeerConnection !== 'undefined',
        webSocket: typeof WebSocket !== 'undefined',
        audioWorklet: typeof AudioWorkletNode !== 'undefined',
        outputRouting: typeof (HTMLMediaElement.prototype as any).setSinkId === 'function',
        storage: false,
        microphone: 'not tested',
        camera: 'not tested',
        audioInputs: 0,
        audioOutputs: 0,
        videoInputs: 0,
        networkType: String((navigator as any).connection?.effectiveType || 'unknown'),
      };

      try {
        const key = '__veylo_diag_storage__';
        localStorage.setItem(key, '1');
        localStorage.removeItem(key);
        basic.storage = true;
      } catch {}

      if (basic.mediaDevices) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          basic.microphone = stream.getAudioTracks().length ? 'allowed' : 'missing';
          basic.camera = stream.getVideoTracks().length ? 'allowed' : 'missing';
          stream.getTracks().forEach((track) => track.stop());
        } catch (reason: any) {
          const name = reason?.name || 'denied';
          basic.microphone = name;
          basic.camera = name;
        }

        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          basic.audioInputs = devices.filter((device) => device.kind === 'audioinput').length;
          basic.audioOutputs = devices.filter((device) => device.kind === 'audiooutput').length;
          basic.videoInputs = devices.filter((device) => device.kind === 'videoinput').length;
        } catch {}
      }

      setBrowser(basic);
      setRuntime({ online: basic.online, secureContext: basic.secureContext });
      setLatencyTraces(loadLatencyTraces());
      setNetworkEvents(loadNetworkEvents());

      const response = await fetch(apiUrl('/api/health?deep=1'), { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || 'Deep health check failed');
      setHealth(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setRunning(false);
    }
  }

  function clearTelemetry() {
    clearLatencyTraces();
    setLatencyTraces([]);
  }

  function clearNetworkTelemetry() {
    clearNetworkEvents();
    setNetworkEvents([]);
  }

  function exportFieldReport() {
    const report = {
      report: 'Veylo field diagnostics',
      generatedAt: new Date().toISOString(),
      location: window.location.origin,
      browserIdentity: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
      },
      browser,
      health,
      latency: {
        samples: latencyTraces.length,
        summary: latencySummary,
        traces: latencyTraces,
      },
      networkEvents,
      notes: [
        'No transcript text, microphone audio, API key, LiveKit secret, or invite secret is included.',
        'A real two-device call and restrictive-network TURN test must still be recorded separately.',
      ],
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `veylo-field-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(href), 1_000);
  }

  const config = health?.config || {};
  const openrouter = health?.checks?.openrouter;
  const livekit = health?.checks?.livekit;
  const latestLatency = latencyTraces[latencyTraces.length - 1];

  const latencySummary = {
    endToEnd: median(latencyTraces.map((trace) => trace.endToEndPlaybackMs)),
    stt: median(latencyTraces.map((trace) => trace.sttMs)),
    translate: median(latencyTraces.map((trace) => trace.translateMs)),
    ttsPlayback: median(latencyTraces.map((trace) => trace.ttsPlaybackStartMs)),
  };

  return (
    <main className="diagnostics-shell">
      <header className="tool-header">
        <button className="ghost small" onClick={() => router.push('/')}>← Home</button>
        <div><strong>Diagnostics</strong><span>Veylo {health?.version || ''}</span></div>
      </header>

      <section className="diagnostics-hero">
        <div className="eyebrow">LOCAL / CONNECTION CHECK</div>
        <h1>Know what failed.<br />Before debugging.</h1>
        <p className="lede">Checks browser media access, WebRTC support, server configuration, LiveKit reachability, OpenRouter model availability, and local interpreter latency traces. Secrets and conversation timing data stay on this device.</p>
        <div className="hero-actions">
          <button className="primary" onClick={runChecks} disabled={running}>{running ? 'Running checks…' : 'Run full diagnostics'}</button>
          <button className="ghost" onClick={exportFieldReport} disabled={!browser && !health}>Export field report</button>
        </div>
        {error && <div className="error-box">{error}</div>}
      </section>

      <section className="diagnostics-grid">
        <article className="diag-card">
          <div className="eyebrow">BROWSER</div>
          <Diag label="Online" value={runtime?.online} pending={!runtime} />
          <Diag label="Secure context" value={runtime?.secureContext} pending={!runtime} />
          <Diag label="WebRTC" value={browser?.webRtc} pending={!browser} />
          <Diag label="WebSocket" value={browser?.webSocket} pending={!browser} />
          <Diag label="Media API" value={browser?.mediaDevices} pending={!browser} />
          <Diag label="AudioWorklet" value={browser?.audioWorklet} pending={!browser} />
          <Diag label="Local storage" value={browser?.storage} pending={!browser} />
          <Diag label="Explicit audio output" value={browser?.outputRouting} pending={!browser} text={browser ? (browser.outputRouting ? 'setSinkId supported' : 'OS default output only') : undefined} />
          <Diag label="Microphone" text={browser?.microphone || 'Run diagnostics'} pending={!browser} />
          <Diag label="Camera" text={browser?.camera || 'Run diagnostics'} pending={!browser} />
          {browser && <p className="diag-note">{browser.audioInputs} audio input · {browser.audioOutputs} audio output · {browser.videoInputs} video input · network {browser.networkType}</p>}
        </article>

        <article className="diag-card">
          <div className="eyebrow">SERVER CONFIG</div>
          <Diag label="OpenRouter key" value={Boolean(config.openrouterKey)} />
          <Diag label="LiveKit API key" value={Boolean(config.livekitApiKey)} />
          <Diag label="LiveKit secret" value={Boolean(config.livekitApiSecret)} />
          <Diag label="LiveKit URL" value={Boolean(config.livekitUrl)} />
          <Diag label="Secure WSS" value={Boolean(config.livekitSecure)} />
          <p className="diag-note">Local insecure WebSocket URLs are valid for development. Production should expose browser-reachable secure WebSocket URLs.</p>
        </article>

        <article className="diag-card">
          <div className="eyebrow">LIVE SERVICES</div>
          <Diag
            label="OpenRouter"
            value={openrouter?.reachable}
            pending={!openrouter}
            text={openrouter ? (openrouter.reachable ? `reachable · ${openrouter.latencyMs} ms` : openrouter.error) : 'Run diagnostics'}
          />
          <Diag
            label="LiveKit"
            value={livekit?.reachable}
            pending={!livekit}
            text={livekit ? (livekit.reachable ? `reachable · ${livekit.latencyMs} ms` : livekit.error) : 'Run diagnostics'}
          />
          {openrouter?.models && Object.entries(openrouter.models).map(([name, model]: [string, any]) => (
            <Diag key={name} label={`${name.toUpperCase()} model`} value={model.listed} text={model.id} />
          ))}
        </article>
      </section>

      <section className="latency-history">
        <div className="latency-history-head">
          <div>
            <div className="eyebrow">LIVE INTERPRETER LATENCY</div>
            <h2>Local timing traces</h2>
            <p>Measured with the browser's monotonic high-resolution clock. Median values exclude stages that did not run, such as translation/TTS on same-language turns.</p>
          </div>
          {latencyTraces.length > 0 && <button className="ghost small" onClick={clearTelemetry}>Clear traces</button>}
        </div>

        {latencyTraces.length === 0 ? (
          <div className="latency-empty">No interpreter traces yet. Run a translated Live Call, then return here.</div>
        ) : (
          <>
            <div className="latency-summary">
              <LatencyMetric label="Latest E2E" value={latestLatency?.endToEndPlaybackMs} />
              <LatencyMetric label="Median E2E" value={latencySummary.endToEnd} />
              <LatencyMetric label="Median STT" value={latencySummary.stt} />
              <LatencyMetric label="Median Translate" value={latencySummary.translate} />
              <LatencyMetric label="Median TTS start" value={latencySummary.ttsPlayback} />
            </div>

            <div className="latency-table-wrap">
              <table className="latency-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Speaker</th>
                    <th>E2E</th>
                    <th>STT</th>
                    <th>TR</th>
                    <th>TTS response</th>
                    <th>TTS start</th>
                    <th>Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {latencyTraces.slice(-8).reverse().map((trace) => (
                    <tr key={trace.id}>
                      <td>{new Date(trace.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                      <td>{trace.participantName || 'Participant'}</td>
                      <td>{formatMs(trace.endToEndPlaybackMs)}</td>
                      <td>{formatMs(trace.sttMs)}</td>
                      <td>{formatMs(trace.translateMs)}</td>
                      <td>{formatMs(trace.ttsResponseMs)}</td>
                      <td>{formatMs(trace.ttsPlaybackStartMs)}</td>
                      <td>{trace.playbackMode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="latency-history">
        <div className="latency-history-head">
          <div>
            <div className="eyebrow">NETWORK RESILIENCE</div>
            <h2>Connection event history</h2>
            <p>Local evidence from real calls: offline/online transitions, LiveKit reconnects, poor/lost quality, and browser audio-playback blocks.</p>
          </div>
          {networkEvents.length > 0 && <button className="ghost small" onClick={clearNetworkTelemetry}>Clear events</button>}
        </div>
        {networkEvents.length === 0 ? (
          <div className="latency-empty">No network events recorded yet. A normal healthy call may legitimately have none.</div>
        ) : (
          <div className="latency-table-wrap">
            <table className="latency-table">
              <thead><tr><th>Time</th><th>Event</th><th>Detail</th></tr></thead>
              <tbody>
                {networkEvents.slice(-12).reverse().map((event) => (
                  <tr key={event.id}>
                    <td>{new Date(event.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                    <td>{event.type}</td>
                    <td>{event.detail || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="diag-guidance">
        <strong>Interpretation</strong>
        <p>If browser checks fail, fix permission/HTTPS/device access first. If LiveKit is unreachable, inspect WSS/DNS/firewall/TURN. If OpenRouter is unreachable or a model is not listed, fix the API key or model configuration. For latency, compare STT, translation, and TTS-start medians before changing models or infrastructure.</p>
      </section>
    </main>
  );
}

function LatencyMetric({ label, value }: { label: string; value?: number }) {
  return (
    <div className="latency-metric">
      <span>{label}</span>
      <strong>{formatMs(value)}</strong>
    </div>
  );
}

function Diag({
  label,
  value,
  text,
  pending,
}: {
  label: string;
  value?: boolean;
  text?: string;
  pending?: boolean;
}) {
  const status = pending ? 'pending' : state(Boolean(value));
  return (
    <div className="diag-row" data-state={status}>
      <span>{label}</span>
      <strong>{text || (pending ? 'Not tested' : value ? 'OK' : 'Needs attention')}</strong>
    </div>
  );
}
