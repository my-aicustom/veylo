import { NextRequest, NextResponse } from 'next/server';
import { stt } from '@/lib/ai/openrouter';

const ALLOWED_FORMATS = new Set(['wav', 'mp3', 'flac', 'm4a', 'ogg', 'webm', 'aac']);
const MAX_BASE64_LENGTH = 12 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const audioBase64 = typeof body.audioBase64 === 'string' ? body.audioBase64 : '';
    const format = typeof body.format === 'string' ? body.format.toLowerCase() : '';
    const language = typeof body.language === 'string' ? body.language.trim().slice(0, 16) : undefined;

    if (!audioBase64 || !format) {
      return NextResponse.json(
        { error: 'audioBase64 and format are required' },
        { status: 400 },
      );
    }

    if (!ALLOWED_FORMATS.has(format)) {
      return NextResponse.json({ error: 'unsupported audio format' }, { status: 400 });
    }

    if (audioBase64.length > MAX_BASE64_LENGTH) {
      return NextResponse.json({ error: 'audio payload is too large' }, { status: 413 });
    }

    const result = await stt(audioBase64, format, language);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'STT failed' },
      { status: 502 },
    );
  }
}
