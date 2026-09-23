import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/ai/openrouter';
import { simulationSystem } from '@/lib/ai/prompts';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const system = simulationSystem({
      userName: body.profile?.name || 'User',
      userCountry: body.profile?.countryName || 'Unknown',
      country: body.country || 'Unknown',
      role: body.role || 'international counterpart',
      scenario: body.scenario || 'professional conversation',
      language: body.language,
    });
    const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
    const messages = [
      { role: 'system', content: system },
      ...history.flatMap((turn: any) => [
        ...(turn.sourceText ? [{ role: turn.speaker === 'ai' ? 'assistant' : 'user', content: turn.sourceText }] : []),
        ...(turn.speaker === 'ai' && turn.translatedText ? [{ role: 'assistant', content: turn.translatedText }] : []),
      ]),
      { role: 'user', content: body.text },
    ];
    const result: any = await chat(messages, 0.65);
    const reply = result?.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error('Simulation model returned empty output');
    return NextResponse.json({ reply });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Simulation failed' }, { status: 502 });
  }
}
