import { NextRequest, NextResponse } from 'next/server';
import { tts } from '@/lib/ai/openrouter';

const MAX_TEXT_LENGTH = 5_000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = typeof body.text === 'string' ? body.text.trim() : '';

    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: 'text is too long' }, { status: 413 });
    }

    const response = await tts(text);
    const contentType = response.headers.get('content-type')?.split(';')[0] || '';

    if (!contentType.startsWith('audio/')) {
      const preview = (await response.text()).slice(0, 300);
      throw new Error(`TTS provider returned non-audio content: ${contentType || 'unknown'} ${preview}`);
    }

    const bytes = await response.arrayBuffer();
    const headers = new Headers({
      'Content-Type': response.headers.get('content-type') || 'audio/mpeg',
      'Cache-Control': 'no-store',
      'Content-Length': String(bytes.byteLength),
    });

    const generationId = response.headers.get('x-generation-id');
    if (generationId) headers.set('X-Generation-Id', generationId);

    return new NextResponse(bytes, { headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'TTS failed' },
      { status: 502 },
    );
  }
}
