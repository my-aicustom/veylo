import { NextRequest, NextResponse } from 'next/server';
import { tts } from '@/lib/ai/openrouter';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.text) return NextResponse.json({ error: 'text is required' }, { status: 400 });
    const response = await tts(body.text);
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
