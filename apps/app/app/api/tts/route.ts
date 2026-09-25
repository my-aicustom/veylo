import { NextRequest, NextResponse } from 'next/server';
import { tts } from '@/lib/ai/openrouter';
import { guardAiBudget } from '@/lib/ai-budget';
import { cleanText, guardApi } from '@/lib/api-guard';

export async function POST(request: NextRequest) {
  const blocked = guardApi(request, 'tts', { limit: 120 });
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const text = cleanText(body.text, 6_000);
    if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 });

    const budgetBlocked = await guardAiBudget();
    if (budgetBlocked) return budgetBlocked;

    const response = await tts(text);
    if (!response.body) {
      return NextResponse.json({ error: 'TTS provider returned an empty stream' }, { status: 502 });
    }

    const headers = new Headers({
      'Content-Type': response.headers.get('content-type') || 'audio/mpeg',
      'Cache-Control': 'no-store, no-transform',
      'X-Veylo-TTS-Transport': 'stream',
    });
    const generationId = response.headers.get('x-generation-id');
    if (generationId) headers.set('X-Generation-Id', generationId);

    return new NextResponse(response.body, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'TTS failed' }, { status: 502 });
  }
}
