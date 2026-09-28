import { NextRequest, NextResponse } from 'next/server';
import WebSocket from 'ws';
import { tradeAdvisorVoiceSystem } from '@/lib/ai/prompts';
import { cleanText, guardApi } from '@/lib/api-guard';
import { guardAiBudget } from '@/lib/ai-budget';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GEMINI_LIVE_ENDPOINT =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const DEFAULT_MODEL = 'models/gemini-2.0-flash-live-001';
const POST_TIMEOUT_MS = 12_000;
const POST_MAX_MESSAGES = 24;

type GeminiLiveMessage = {
  setup?: unknown;
  realtimeInput?: unknown;
  clientContent?: unknown;
  serverContent?: unknown;
  setupComplete?: unknown;
  toolCall?: unknown;
  toolCallCancellation?: unknown;
  type?: string;
};

function apiKey() {
  return cleanText(process.env.GEMINI_API_KEY, 240);
}

function geminiLiveUrl(key = apiKey()) {
  const url = new URL(GEMINI_LIVE_ENDPOINT);
  url.searchParams.set('key', key);
  return url.toString();
}

function setupPayload(): GeminiLiveMessage {
  return {
    setup: {
      model: process.env.GEMINI_LIVE_MODEL || DEFAULT_MODEL,
      systemInstruction: {
        parts: [{ text: tradeAdvisorVoiceSystem }],
      },
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: process.env.GEMINI_LIVE_VOICE || 'Puck',
            },
          },
        },
      },
    },
  };
}

function safeJson(raw: WebSocket.RawData | string): GeminiLiveMessage | null {
  const text = typeof raw === 'string' ? raw : raw.toString('utf8');
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function outboundClientMessage(message: GeminiLiveMessage): GeminiLiveMessage | null {
  if (message.type === 'client-stop') {
    return { clientContent: { turnComplete: true } };
  }
  if (message.realtimeInput) return { realtimeInput: message.realtimeInput };
  if (message.clientContent) return { clientContent: message.clientContent };
  return null;
}

function inboundGeminiMessage(message: GeminiLiveMessage): GeminiLiveMessage | null {
  if (message.setupComplete) return { setupComplete: message.setupComplete };
  if (message.serverContent) return { serverContent: message.serverContent };
  if (message.toolCall) return { toolCall: message.toolCall };
  if (message.toolCallCancellation) return { toolCallCancellation: message.toolCallCancellation };
  return null;
}

function connectGemini() {
  const key = apiKey();
  if (!key) throw new Error('GEMINI_API_KEY is not configured.');
  return new WebSocket(geminiLiveUrl(key), { perMessageDeflate: false });
}

function sendJson(socket: WebSocket, message: GeminiLiveMessage) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function attachGeminiLiveProxy(client: WebSocket) {
  let upstream: WebSocket;
  try {
    upstream = connectGemini();
  } catch (error) {
    client.send(JSON.stringify({ error: error instanceof Error ? error.message : 'Gemini Live unavailable.' }));
    client.close(1011, 'Gemini Live unavailable');
    return;
  }

  const pending: GeminiLiveMessage[] = [];

  upstream.on('open', () => {
    sendJson(upstream, setupPayload());
    while (pending.length) sendJson(upstream, pending.shift()!);
  });

  client.on('message', (raw) => {
    const message = safeJson(raw);
    if (!message) return;
    const outbound = outboundClientMessage(message);
    if (!outbound) return;
    if (upstream.readyState === WebSocket.OPEN) sendJson(upstream, outbound);
    else pending.push(outbound);
  });

  upstream.on('message', (raw) => {
    const message = safeJson(raw);
    const inbound = message ? inboundGeminiMessage(message) : null;
    if (inbound && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(inbound));
    }
  });

  upstream.on('error', (error) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ error: error.message || 'Gemini Live upstream error.' }));
    }
  });

  upstream.on('close', () => {
    if (client.readyState === WebSocket.OPEN) client.close(1011, 'Gemini Live closed');
  });

  client.on('close', () => {
    if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
      upstream.close(1000, 'client closed');
    }
  });
}

async function proxyPostMessage(message: GeminiLiveMessage, signal: AbortSignal) {
  const outbound = outboundClientMessage(message);
  if (!outbound) throw new Error('realtimeInput or clientContent is required.');

  const upstream = connectGemini();
  const received: GeminiLiveMessage[] = [];

  return await new Promise<GeminiLiveMessage[]>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      finish(new Error('Gemini Live response timed out.'));
    }, POST_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      finish(new Error('Request aborted.'));
    };

    function finish(error?: Error) {
      if (settled) return;
      settled = true;
      cleanup();
      if (upstream.readyState === WebSocket.CONNECTING) upstream.terminate();
      else upstream.close(1000, 'post complete');
      if (error) reject(error);
      else resolve(received);
    }

    signal.addEventListener('abort', onAbort);

    upstream.on('open', () => {
      sendJson(upstream, setupPayload());
    });

    upstream.on('message', (raw) => {
      const parsed = safeJson(raw);
      const inbound = parsed ? inboundGeminiMessage(parsed) : null;
      if (!inbound) return;
      if (inbound.setupComplete) sendJson(upstream, outbound);
      received.push(inbound);
      const done = Boolean((inbound.serverContent as any)?.turnComplete || (inbound.serverContent as any)?.generationComplete);
      if (done || received.length >= POST_MAX_MESSAGES) {
        finish();
      }
    });

    upstream.on('error', (error) => {
      finish(error);
    });
    upstream.on('close', () => finish(new Error('Gemini Live closed before completing the response.')));
    if (signal.aborted) onAbort();
  });
}

export async function GET(request: NextRequest) {
  const blocked = guardApi(request, 'live-voice-status', { limit: 120 });
  if (blocked) return blocked;

  const upgrade = request.headers.get('upgrade')?.toLowerCase() === 'websocket';
  return NextResponse.json(
    {
      ok: true,
      configured: Boolean(apiKey()),
      available: false,
      reason: 'WebSocket upgrade is not wired in this Next.js deployment. Use recorded voice fallback.',
      websocket: '/api/live-voice',
      upstream: 'Gemini BidiGenerateContent',
      model: process.env.GEMINI_LIVE_MODEL || DEFAULT_MODEL,
      upgrade,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: NextRequest) {
  const blocked = guardApi(request, 'live-voice-post', { limit: 60 });
  if (blocked) return blocked;

  if (!apiKey()) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 503 });
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body) || !outboundClientMessage(body)) {
      return NextResponse.json({ error: 'realtimeInput or clientContent is required.' }, { status: 400 });
    }
    const budgetBlocked = await guardAiBudget();
    if (budgetBlocked) return budgetBlocked;
    const messages = await proxyPostMessage(body, request.signal);
    return NextResponse.json({ ok: true, messages }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: 'Gemini Live proxy failed.' },
      { status: 502 },
    );
  }
}
