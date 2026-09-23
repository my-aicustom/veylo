import { NextRequest, NextResponse } from 'next/server';
import { stt } from '@/lib/ai/openrouter';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.audioBase64 || !body.format) {
      return NextResponse.json({ error: 'audioBase64 and format are required' }, { status: 400 });
    }
    const result = await stt(body.audioBase64, body.format, body.language);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'STT failed' }, { status: 502 });
  }
}
