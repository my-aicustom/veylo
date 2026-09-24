import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/ai/openrouter';
import { meetingIntelligenceSystem } from '@/lib/ai/prompts';
import { guardAiBudget, recordAiUsage } from '@/lib/ai-budget';
import { cleanText, guardApi } from '@/lib/api-guard';
import type { MeetingIntelligence } from '@/lib/types';

function stripCodeFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function cleanString(value: unknown, max = 500) {
  return cleanText(value, max);
}

function cleanArray(value: unknown, maxItems = 30, maxLength = 500) {
  return Array.isArray(value)
    ? value.slice(0, maxItems).map((item) => cleanString(item, maxLength)).filter(Boolean)
    : [];
}

function normalizeReport(raw: any, sourceTurnCount: number): MeetingIntelligence {
  const parties = Array.isArray(raw?.parties)
    ? raw.parties.slice(0, 20).map((item: any) => ({
        name: cleanString(item?.name, 120) || undefined,
        company: cleanString(item?.company, 180) || undefined,
        role: cleanString(item?.role, 120) || undefined,
        country: cleanString(item?.country, 90) || undefined,
        contact: cleanString(item?.contact, 180) || undefined,
      })).filter((item: any) => Object.values(item).some(Boolean))
    : [];

  const commercialItems = Array.isArray(raw?.commercialItems)
    ? raw.commercialItems.slice(0, 30).map((item: any) => ({
        product: cleanString(item?.product, 220),
        quantity: cleanString(item?.quantity, 100) || undefined,
        unit: cleanString(item?.unit, 80) || undefined,
        price: cleanString(item?.price, 100) || undefined,
        currency: cleanString(item?.currency, 40) || undefined,
        incoterm: cleanString(item?.incoterm, 60) || undefined,
        delivery: cleanString(item?.delivery, 180) || undefined,
        notes: cleanString(item?.notes, 500) || undefined,
      })).filter((item: any) => item.product || item.quantity || item.price || item.notes)
    : [];

  const commitments = Array.isArray(raw?.commitments)
    ? raw.commitments.slice(0, 30).map((item: any) => ({
        party: cleanString(item?.party, 160) || undefined,
        commitment: cleanString(item?.commitment, 700),
        due: cleanString(item?.due, 120) || undefined,
      })).filter((item: any) => item.commitment)
    : [];

  const actionItems = Array.isArray(raw?.actionItems)
    ? raw.actionItems.slice(0, 30).map((item: any) => {
        const status = ['open', 'agreed', 'tentative', 'unknown'].includes(item?.status)
          ? item.status
          : 'unknown';
        return {
          owner: cleanString(item?.owner, 160) || undefined,
          action: cleanString(item?.action, 700),
          due: cleanString(item?.due, 120) || undefined,
          status,
        };
      }).filter((item: any) => item.action)
    : [];

  return {
    generatedAt: new Date().toISOString(),
    meetingTitle: cleanString(raw?.meetingTitle, 180) || 'Conversation brief',
    summary: cleanString(raw?.summary, 3_500) || 'No summary was returned.',
    parties,
    commercialItems,
    commitments,
    actionItems,
    followUps: cleanArray(raw?.followUps, 30, 600),
    openQuestions: cleanArray(raw?.openQuestions, 30, 600),
    risksOrAmbiguities: cleanArray(raw?.risksOrAmbiguities, 30, 600),
    languages: cleanArray(raw?.languages, 20, 80),
    sourceTurnCount,
  };
}

export async function POST(request: NextRequest) {
  const blocked = guardApi(request, 'intelligence', { limit: 12, windowMs: 5 * 60_000 });
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const turns = Array.isArray(body.turns) ? body.turns.slice(-500) : [];
    const transcript = turns
      .map((turn: any, index: number) => {
        const speaker = cleanString(turn?.participantName || turn?.speaker || `Speaker ${index + 1}`, 100);
        const language = cleanString(turn?.sourceLanguage, 20);
        const original = cleanString(turn?.sourceText, 320);
        if (!original) return '';
        return `${index + 1}. ${speaker || 'Speaker'}${language ? ` [${language}]` : ''}: ${original}`;
      })
      .filter(Boolean)
      .join('\n');

    if (!transcript) {
      return NextResponse.json({ error: 'A transcript is required.' }, { status: 400 });
    }

    const budgetBlocked = guardAiBudget();
    if (budgetBlocked) return budgetBlocked;

    const result: any = await chat([
      { role: 'system', content: meetingIntelligenceSystem },
      { role: 'user', content: transcript },
    ], 0, 1_800);
    recordAiUsage(result);

    const content = result?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('Meeting intelligence model returned empty output');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(stripCodeFence(content));
    } catch {
      throw new Error('Meeting intelligence model returned invalid JSON');
    }

    return NextResponse.json(
      { report: normalizeReport(parsed, turns.length), usage: result.usage },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Meeting intelligence failed' },
      { status: 502 },
    );
  }
}
