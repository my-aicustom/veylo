import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/ai/openrouter';
import { simulationSystem } from '@/lib/ai/prompts';
import { guardAiBudget, recordAiUsage } from '@/lib/ai-budget';
import { cleanText, guardApi } from '@/lib/api-guard';

export async function POST(request: NextRequest) {
  const blocked = guardApi(request, 'simulate', { limit: 60 });
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const text = cleanText(body.text, 4_000);
    if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 });

    const system = simulationSystem({
      userName: cleanText(body.profile?.name, 80) || 'User',
      userCountry: cleanText(body.profile?.countryName, 90) || 'Unknown',
      country: cleanText(body.country, 90) || 'Unknown',
      role: cleanText(body.role, 120) || 'international counterpart',
      scenario: cleanText(body.scenario, 500) || 'professional conversation',
      language: cleanText(body.language, 12) || undefined,
    });

    const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
    const messages = [
      { role: 'system', content: system },
      ...history.flatMap((turn: any) => {
        const speaker = turn?.speaker === 'ai' ? 'assistant' : 'user';
        const sourceText = cleanText(turn?.sourceText, 1_500);
        const translatedText = cleanText(turn?.translatedText, 1_500);
        return [
          ...(sourceText ? [{ role: speaker, content: sourceText }] : []),
          ...(turn?.speaker === 'ai' && translatedText ? [{ role: 'assistant', content: translatedText }] : []),
        ];
      }),
      { role: 'user', content: text },
    ];

    const budgetBlocked = guardAiBudget();
    if (budgetBlocked) return budgetBlocked;

    const result: any = await chat(messages, 0.65);
    recordAiUsage(result);

    const reply = result?.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error('Simulation model returned empty output');

    return NextResponse.json({ reply, usage: result.usage }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Simulation failed' }, { status: 502 });
  }
}
