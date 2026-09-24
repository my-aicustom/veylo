import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/ai/openrouter';
import { translationSystem } from '@/lib/ai/prompts';
import { guardAiBudget, recordAiUsage } from '@/lib/ai-budget';
import { cleanText, guardApi } from '@/lib/api-guard';

export async function POST(request: NextRequest) {
  const blocked = guardApi(request, 'translate', { limit: 180 });
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const input = {
      text: cleanText(body.text, 6_000),
      sourceLanguage: cleanText(body.sourceLanguage, 12) || undefined,
      targetLanguage: cleanText(body.targetLanguage, 12),
      sourceCountry: cleanText(body.sourceCountry, 90) || undefined,
      targetCountry: cleanText(body.targetCountry, 90) || undefined,
      glossary: Array.isArray(body.glossary)
        ? body.glossary.slice(0, 40).map((item: unknown) => cleanText(item, 120)).filter(Boolean)
        : undefined,
    };

    if (!input.text || !input.targetLanguage) {
      return NextResponse.json({ error: 'text and targetLanguage are required' }, { status: 400 });
    }

    const budgetBlocked = guardAiBudget();
    if (budgetBlocked) return budgetBlocked;

    const result: any = await chat([
      { role: 'system', content: translationSystem(input) },
      { role: 'user', content: input.text },
    ], 0.05);
    recordAiUsage(result);

    const text = result?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Translation model returned empty output');

    return NextResponse.json({ text, usage: result.usage }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Translation failed' }, { status: 502 });
  }
}
