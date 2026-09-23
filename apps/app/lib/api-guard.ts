import { NextRequest, NextResponse } from 'next/server';

type Counter = { count: number; resetAt: number };

declare global {
  // eslint-disable-next-line no-var
  var __veyloRateLimits: Map<string, Counter> | undefined;
}

const counters = globalThis.__veyloRateLimits ?? new Map<string, Counter>();
globalThis.__veyloRateLimits = counters;

function clientId(request: NextRequest) {
  // In production, nginx overwrites X-Real-IP with the socket peer address.
  // Direct dev requests fall back to a stable local bucket.
  return request.headers.get('x-real-ip')?.trim() || 'direct';
}

function expectedOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedHost && forwardedProto) return `${forwardedProto}://${forwardedHost}`;
  return request.nextUrl.origin;
}

function cleanupExpired(now: number) {
  if (counters.size < 5_000) return;
  for (const [key, value] of counters) {
    if (value.resetAt <= now) counters.delete(key);
  }
}

export function guardApi(
  request: NextRequest,
  bucket: string,
  options: { limit: number; windowMs?: number },
) {
  const origin = request.headers.get('origin');
  const expected = expectedOrigin(request);
  if (origin && expected && origin !== expected) {
    return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 });
  }

  const now = Date.now();
  cleanupExpired(now);

  const windowMs = options.windowMs ?? 60_000;
  const key = `${bucket}:${clientId(request)}`;
  const current = counters.get(key);

  if (!current || current.resetAt <= now) {
    counters.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (current.count >= options.limit) {
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return NextResponse.json(
      { error: 'Too many requests. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  current.count += 1;
  return null;
}

export function cleanText(value: unknown, max: number) {
  return typeof value === 'string'
    ? value.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max)
    : '';
}

export function estimatedBase64Bytes(value: string) {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((value.length * 3) / 4) - padding);
}
