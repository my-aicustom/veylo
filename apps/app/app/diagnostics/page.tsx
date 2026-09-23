'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/paths';

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
  microphone: string;
  camera: string;
  audioInputs: number;
  videoInputs: number;
};

function state(value: boolean | undefined) {
  return value ? 'good' : 'bad';
}

export default function DiagnosticsPage() {
  const router = useRouter();
  const [health, setHealth] = React.useState<Health | null>(null);
  const [browser, setBrowser] = React.useState<BrowserChecks | null>(null);
  const [runtime, setRuntime] = React.useState<{ online: boolean; secureContext: boolean } | null>(null);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setRuntime({ online: navigator.onLine, secureContext: window.isSecureContext });

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
        microphone: 'not tested',
        camera: 'not tested',
        audioInputs: 0,
        videoInputs: 0,
      };

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
          basic.videoInputs = devices.filter((device) => device.kind === 'videoinput').length;
        } catch {}
      }

      setBrowser(basic);
      setRuntime({ online: basic.online, secureContext: basic.secureContext });

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

  const config = health?.config || {};
  const openrouter = health?.checks?.openrouter;
  const livekit = health?.checks?.livekit;

  return (
    <main className="diagnostics-shell">
      <header className="tool-header">
        <button className="ghost small" onClick={() => router.push('/')}>← Home</button>
        <div><strong>Diagnostics</strong><span>Veylo {health?.version || ''}</span></div>
      </header>

      <section className="diagnostics-hero">
        <div className="eyebrow">LOCAL / CONNECTION CHECK</div>
        <h1>Know what failed.<br />Before debugging.</h1>
        <p className="lede">Checks browser media access, WebRTC support, server configuration, LiveKit reachability, and OpenRouter model availability. Secrets are never returned to the browser.</p>
        <button className="primary" onClick={runChecks} disabled={running}>{running ? 'Running checks…' : 'Run full diagnostics'}</button>
        {error && <div className="error-box">{error}</div>}
      </section>

      <section className="diagnostics-grid">
        <article className="diag-card">
          <div className="eyebrow">BROWSER</div>
          <Diag label="Online" value={runtime?.online} pending={!runtime} />
          <Diag label="Secure context" value={runtime?.secureContext} pending={!runtime} />
          <Diag label="WebRTC" value={browser?.webRtc} pending={!browser} />
          <Diag label="Media API" value={browser?.mediaDevices} pending={!browser} />
          <Diag label="Microphone" text={browser?.microphone || 'Run diagnostics'} pending={!browser} />
          <Diag label="Camera" text={browser?.camera || 'Run diagnostics'} pending={!browser} />
          {browser && <p className="diag-note">{browser.audioInputs} audio input · {browser.videoInputs} video input devices detected</p>}
        </article>

        <article className="diag-card">
          <div className="eyebrow">SERVER CONFIG</div>
          <Diag label="OpenRouter key" value={Boolean(config.openrouterKey)} />
          <Diag label="LiveKit API key" value={Boolean(config.livekitApiKey)} />
          <Diag label="LiveKit secret" value={Boolean(config.livekitApiSecret)} />
          <Diag label="LiveKit URL" value={Boolean(config.livekitUrl)} />
          <Diag label="Secure WSS" value={Boolean(config.livekitSecure)} />
          <p className="diag-note">Local ws:// is valid for development. Production should expose browser-reachable wss://.</p>
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

      <section className="diag-guidance">
        <strong>Interpretation</strong>
        <p>If browser checks fail, fix permission/HTTPS/device access first. If LiveKit is unreachable, inspect WSS/DNS/firewall/TURN. If OpenRouter is unreachable or a model is not listed, fix the API key or model configuration before testing speech translation.</p>
      </section>
    </main>
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
