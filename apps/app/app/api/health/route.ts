import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/api-guard';
import { VEYLO_VERSION } from '@/lib/version';

function configured(value?: string) {
  return Boolean(value && value.trim());
}

function publicLiveKitUrl() {
  return process.env.LIVEKIT_URL || '';
}

async function checkOpenRouter() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { reachable: false, latencyMs: null, error: 'OPENROUTER_API_KEY is not configured', models: {} };

  const started = Date.now();
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return {
        reachable: false,
        latencyMs: Date.now() - started,
        error: `OpenRouter returned HTTP ${response.status}`,
        models: {},
      };
    }

    const payload = await response.json();
    const ids = new Set<string>(
      Array.isArray(payload?.data) ? payload.data.map((model: any) => model?.id).filter(Boolean) : [],
    );
    const stt = process.env.STT_MODEL || 'openai/whisper-large-v3-turbo';
    const translation = process.env.TRANSLATION_MODEL || 'google/gemini-3.1-flash-lite';
    const tts = process.env.TTS_MODEL || 'x-ai/grok-voice-tts-1.0';

    return {
      reachable: true,
      latencyMs: Date.now() - started,
      error: null,
      models: {
        stt: { id: stt, listed: ids.has(stt) },
        translation: { id: translation, listed: ids.has(translation) },
        tts: { id: tts, listed: ids.has(tts) },
      },
    };
  } catch (error) {
    return {
      reachable: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
      models: {},
    };
  }
}

async function checkLiveKit() {
  const value = publicLiveKitUrl();
  if (!value) return { reachable: false, latencyMs: null, error: 'LIVEKIT_URL is not configured' };

  const httpUrl = value.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');
  const started = Date.now();
  try {
    const response = await fetch(httpUrl, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    return {
      reachable: true,
      latencyMs: Date.now() - started,
      status: response.status,
      error: null,
    };
  } catch (error) {
    return {
      reachable: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET(request: NextRequest) {
  const blocked = guardApi(request, 'health', { limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;

  const deep = request.nextUrl.searchParams.get('deep') === '1';
  const livekitUrl = publicLiveKitUrl();
  const base = {
    app: 'Veylo',
    version: VEYLO_VERSION,
    serverTime: new Date().toISOString(),
    config: {
      openrouterKey: configured(process.env.OPENROUTER_API_KEY),
      livekitApiKey: configured(process.env.LIVEKIT_API_KEY),
      livekitApiSecret: configured(process.env.LIVEKIT_API_SECRET),
      livekitUrl: configured(livekitUrl),
      livekitSecure: /^wss:/i.test(livekitUrl),
      appUrl: process.env.APP_URL || null,
      basePath: process.env.NEXT_PUBLIC_BASE_PATH || '/app',
    },
  };

  if (!deep) {
    return NextResponse.json(base, { headers: { 'Cache-Control': 'no-store' } });
  }

  const [openrouter, livekit] = await Promise.all([checkOpenRouter(), checkLiveKit()]);
  return NextResponse.json(
    { ...base, checks: { openrouter, livekit } },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
