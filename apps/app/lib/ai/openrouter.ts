const BASE = 'https://openrouter.ai/api/v1';

function key() {
  const value = process.env.OPENROUTER_API_KEY;
  if (!value) throw new Error('OPENROUTER_API_KEY is not configured');
  return value;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path: string, body: unknown, raw = false) {
  let last = 'OpenRouter request failed';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(BASE + path, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
          'X-OpenRouter-Title': 'Veylo',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(path.includes('/audio/speech') ? 55_000 : 35_000),
      });
      if (response.ok) return raw ? response : response.json();
      last = `OpenRouter ${response.status}: ${(await response.text()).slice(0, 600)}`;
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await sleep(400 * (attempt + 1));
        continue;
      }
      throw new Error(last);
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
      if (attempt < 2) {
        await sleep(300 * (attempt + 1));
        continue;
      }
      throw new Error(last);
    }
  }
  throw new Error(last);
}

export async function stt(audioBase64: string, format: string, language?: string) {
  const body = {
    model: process.env.STT_MODEL || 'openai/whisper-large-v3',
    input_audio: { data: audioBase64, format },
    ...(language ? { language } : {}),
    response_format: 'verbose_json',
  };
  try {
    return await request('/audio/transcriptions', body);
  } catch (error) {
    const message = String(error);
    if (message.includes('400') || message.includes('422')) {
      const { response_format, ...fallback } = body;
      return request('/audio/transcriptions', fallback);
    }
    throw error;
  }
}

export async function chat(messages: unknown[], temperature = 0.1) {
  return request('/chat/completions', {
    model: process.env.TRANSLATION_MODEL || 'google/gemini-3.1-flash-lite',
    messages,
    temperature,
    reasoning: { effort: 'minimal', exclude: true },
    max_tokens: 900,
  });
}

export async function tts(text: string) {
  const model = process.env.TTS_MODEL || 'x-ai/grok-voice-tts-1.0';
  const voice = process.env.TTS_VOICE || 'eve';
  try {
    return (await request('/audio/speech', {
      model,
      input: text,
      voice,
      response_format: 'mp3',
    }, true)) as Response;
  } catch (error) {
    const fallbackModel = process.env.TTS_FALLBACK_MODEL;
    const fallbackVoice = process.env.TTS_FALLBACK_VOICE;
    if (!fallbackModel || !fallbackVoice || fallbackModel === model) throw error;
    return (await request('/audio/speech', {
      model: fallbackModel,
      input: text,
      voice: fallbackVoice,
      response_format: 'mp3',
    }, true)) as Response;
  }
}
