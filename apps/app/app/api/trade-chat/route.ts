import { NextRequest, NextResponse } from 'next/server';
import { guardApi, cleanText } from '@/lib/api-guard';
import { guardAiBudget, recordAiUsage } from '@/lib/ai-budget';
import { chat } from '@/lib/ai/openrouter';
import { tradeAdvisorVoiceSystem } from '@/lib/ai/prompts';

export const runtime = 'nodejs';

interface ChatRequest {
  message: string;
  history?: { speaker: 'user' | 'advisor'; text: string }[];
}

export async function POST(req: NextRequest) {
  const blocked = guardApi(req, 'trade-chat', { limit: 40 });
  if (blocked) return blocked;

  const budgetBlocked = await guardAiBudget();
  if (budgetBlocked) return budgetBlocked;

  try {
    const body = (await req.json()) as ChatRequest;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
    }

    const message = cleanText(body.message, 1000);
    if (!message) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      {
        role: 'system',
        content: `${tradeAdvisorVoiceSystem}

CRITICAL: Return ONLY a valid, raw JSON object (without markdown code blocks, without backticks) in this exact structure:
{
  "reply": "Jawaban praktis dan ringkas 1-3 kalimat dalam Bahasa Indonesia",
  "recommendedView": "routes" | "tariff" | "compliance" | "market",
  "recommendedRoute": "singapore" | "douala" | "rotterdam" | "jebel-ali" | null
}

Rules for recommendedView & recommendedRoute:
- If discussing shipping routes, ports, transit time, freight, or locations like Singapore/Douala/Rotterdam/Jebel Ali -> "routes" with matching route id.
- If discussing HS Code, import duty, bea masuk, tarif, ATIGA, PPN, duty saving, commodity prices -> "tariff".
- If discussing certification, Halal, Phytosanitary, HACCP, PEB, export readiness, documents -> "compliance".
- If discussing spot prices, buyer demand, market trends, global benchmarks -> "market".`,
      },
    ];

    if (Array.isArray(body.history)) {
      for (const turn of body.history.slice(-4)) {
        if (turn && typeof turn.text === 'string' && (turn.speaker === 'user' || turn.speaker === 'advisor')) {
          messages.push({
            role: turn.speaker === 'user' ? 'user' : 'assistant',
            content: cleanText(turn.text, 500),
          });
        }
      }
    }

    messages.push({ role: 'user', content: message });

    // Call OpenRouter API
    const completion = (await chat(messages, { temperature: 0.2, maxTokens: 600, enableWebSearch: true })) as any;
    void recordAiUsage(completion);
    const content = completion?.choices?.[0]?.message?.content;

    if (!content || typeof content !== 'string') {
      throw new Error('Empty response from OpenRouter');
    }

    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // If parsing fails, extract text directly
      parsed = {
        reply: content.replace(/\{[\s\S]*\}/, '').trim() || content,
        recommendedView: 'routes',
        recommendedRoute: 'singapore',
      };
    }

    return NextResponse.json({
      reply: parsed.reply || 'Informasi diterima. Silakan cek visual canvas untuk rincian ekspor.',
      recommendedView: ['routes', 'tariff', 'compliance', 'market'].includes(parsed.recommendedView)
        ? parsed.recommendedView
        : 'routes',
      recommendedRoute: ['singapore', 'douala', 'rotterdam', 'jebel-ali'].includes(parsed.recommendedRoute)
        ? parsed.recommendedRoute
        : undefined,
    });
  } catch (error) {
    console.error('Trade chat error:', error);
    return NextResponse.json(
      {
        error: 'Gagal menghubungi Trade Advisor AI via OpenRouter.',
        reply: 'Maaf, terjadi kendala koneksi ke server AI OpenRouter. Silakan gunakan WhatsApp untuk respon instan.',
      },
      { status: 502 }
    );
  }
}
