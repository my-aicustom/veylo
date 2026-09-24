import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/ai/openrouter';
import { mediatorSystem } from '@/lib/ai/prompts';
import { guardAiBudget, recordAiUsage } from '@/lib/ai-budget';
import { cleanText, guardApi } from '@/lib/api-guard';

export async function POST(request: NextRequest) {
  const blocked = guardApi(request, 'mediate', { limit: 40 });
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const turns = Array.isArray(body.turns) ? body.turns.slice(-8) : [];
    const transcript = turns
      .map((turn: any) => {
        const who = cleanText(turn?.participantName || turn?.speaker || 'Speaker', 80);
        const text = cleanText(turn?.sourceText || turn?.translatedText, 1_200);
        return text ? `${who || 'Speaker'}: ${text}` : '';
      })
      .filter(Boolean)
      .join('\n');

    if (!transcript) return NextResponse.json({ note: null });

    const budgetBlocked = guardAiBudget();
    if (budgetBlocked) return budgetBlocked;

    const result: any = await chat([
      { role: 'system', content: mediatorSystem },
      { role: 'user', content: transcript },
    ], 0);
    recordAiUsage(result);

    const note = result?.choices?.[0]?.message?.content?.trim();
    return NextResponse.json(
      { note: !note || note === 'NONE' ? null : note, usage: result.usage },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Mediation failed' }, { status: 502 });
  }
}
