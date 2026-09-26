/**
 * Veylo Trade Advisor — Real-time Trade Events via Server-Sent Events (SSE)
 *
 * GET  /api/trade-events?sessionId=xxx  → SSE stream (browser EventSource)
 * POST /api/trade-events                → Push event to a session (called by n8n webhook)
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApi, cleanText } from '@/lib/api-guard';

export const runtime = 'nodejs';

// ─── In-process session registry ─────────────────────────────────────────────
// Maps sessionId → SSE writer. Works in single-instance Node.js deployment.
// For multi-instance/edge, replace with Redis pub/sub.

declare global {
  // eslint-disable-next-line no-var
  var __veyloTradeEventSessions:
    | Map<string, ReadableStreamDefaultController<Uint8Array>>
    | undefined;
}

const sessions =
  globalThis.__veyloTradeEventSessions ??
  new Map<string, ReadableStreamDefaultController<Uint8Array>>();
globalThis.__veyloTradeEventSessions = sessions;

const PANEL_VALUES = ['route-map', 'tariff', 'compliance', 'market'] as const;
type Panel = (typeof PANEL_VALUES)[number];

function encodeSSE(event: string, data: unknown): Uint8Array {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  return new TextEncoder().encode(payload);
}

function keepalive(ctrl: ReadableStreamDefaultController<Uint8Array>) {
  ctrl.enqueue(new TextEncoder().encode(': ping\n\n'));
}

// ─── GET — SSE subscribe ──────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const sessionId = cleanText(request.nextUrl.searchParams.get('sessionId') ?? '', 64);
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  // Limit concurrent sessions
  if (sessions.size >= 500) {
    return NextResponse.json({ error: 'Server busy' }, { status: 503 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      sessions.set(sessionId, ctrl);

      // Initial handshake event
      ctrl.enqueue(encodeSSE('connected', { sessionId, ts: Date.now() }));

      // Keepalive every 25s to prevent proxy timeout
      const interval = setInterval(() => {
        try {
          keepalive(ctrl);
        } catch {
          clearInterval(interval);
        }
      }, 25_000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        sessions.delete(sessionId);
        try { ctrl.close(); } catch { /* already closed */ }
      });
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering
    },
  });
}

// ─── POST — n8n webhook push ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // n8n webhook calls this — only accept from same origin or internal (no user-facing rate limit needed,
  // but we still guard against abuse from public internet)
  const guard = guardApi(request, 'trade-events-push', { limit: 120, windowMs: 60_000 });
  if (guard) return guard;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const sessionId = cleanText(body.sessionId as string, 64);
  const panel = cleanText(body.panel as string, 30) as Panel;

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }
  if (!PANEL_VALUES.includes(panel)) {
    return NextResponse.json(
      { error: `panel must be one of: ${PANEL_VALUES.join(', ')}` },
      { status: 400 },
    );
  }

  const ctrl = sessions.get(sessionId);
  if (!ctrl) {
    // Session not found — may have disconnected
    return NextResponse.json({ ok: false, reason: 'session-not-found' }, { status: 404 });
  }

  try {
    const eventData = {
      panel,
      source: 'whatsapp',
      ts: Date.now(),
      data: body.data ?? null,
    };
    ctrl.enqueue(encodeSSE('canvas-switch', eventData));
    return NextResponse.json({ ok: true, sessionId, panel });
  } catch (err) {
    sessions.delete(sessionId);
    return NextResponse.json({ ok: false, reason: 'write-error' }, { status: 500 });
  }
}
