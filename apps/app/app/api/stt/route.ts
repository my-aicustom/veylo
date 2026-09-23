import { NextRequest, NextResponse } from 'next/server';
import { stt } from '@/lib/ai/openrouter';
import { cleanText, estimatedBase64Bytes, guardApi } from '@/lib/api-guard';

const ALLOWED_FORMATS = new Set(['wav', 'mp3', 'flac', 'm4a', 'ogg', 'webm', 'aac']);
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const blocked = guardApi(request, 'stt', { limit: 120 });
  if (blocked) return blocked;

  try {
    const body = await request.json();
    if (typeof body.audioBase64 !== 'string' || !body.audioBase64 || typeof body.format !== 'string') {
      return NextResponse.json({ error: 'audioBase64 and format are required' }, { status: 400 });
    }
    if (estimatedBase64Bytes(body.audioBase64) > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Audio payload is too large.' }, { status: 413 });
    }

    const format = cleanText(body.format, 8).toLowerCase();
    if (!ALLOWED_FORMATS.has(format)) {
      return NextResponse.json({ error: 'Unsupported audio format.' }, { status: 400 });
    }

    const language = cleanText(body.language, 12) || undefined;
    const result = await stt(body.audioBase64, format, language);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'STT failed' }, { status: 502 });
  }
}
