import { NextRequest, NextResponse } from 'next/server';
import { tts } from '@/lib/ai/openrouter';
import { cleanText, guardApi } from '@/lib/api-guard';

export async function POST(request: NextRequest) {
  const blocked = guardApi(request, 'tts', { limit: 120 });
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const text = cleanText(body.text, 6_000);
    if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 });

    const response = await tts(text);
    const bytes = await response.arrayBuffer();
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': response.headers.get('content-type') || 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'TTS failed' }, { status: 502 });
  }
}
