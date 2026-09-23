import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/ai/openrouter';
import { translationSystem } from '@/lib/ai/prompts';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.text || !body.targetLanguage) {
      return NextResponse.json({ error: 'text and targetLanguage are required' }, { status: 400 });
    }
    const result: any = await chat([
      { role: 'system', content: translationSystem(body) },
      { role: 'user', content: body.text },
    ], 0.05);
    const text = result?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Translation model returned empty output');
    return NextResponse.json({ text, usage: result.usage });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Translation failed' }, { status: 502 });
  }
}
