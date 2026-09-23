import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/ai/openrouter';
import { mediatorSystem } from '@/lib/ai/prompts';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const transcript = (body.turns || []).slice(-8).map((t: any) => `${t.participantName || t.speaker || 'Speaker'}: ${t.sourceText || t.translatedText || ''}`).join('\n');
    const result: any = await chat([
      { role: 'system', content: mediatorSystem },
      { role: 'user', content: transcript },
    ], 0);
    const note = result?.choices?.[0]?.message?.content?.trim();
    return NextResponse.json({ note: !note || note === 'NONE' ? null : note });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Mediation failed' }, { status: 502 });
  }
}
