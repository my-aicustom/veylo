const BASE = 'https://openrouter.ai/api/v1';

function key() {
  const value = process.env.OPENROUTER_API_KEY;
  if (!value) throw new Error('OPENROUTER_API_KEY is not configured');
  return value;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function retryDelay(response: Response, attempt: number) {
  const retryAfter = Number(response.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 5_000);
  }
  return 400 * (attempt + 1);
}

async function request(path: string, body: unknown, raw = false) {
  let last = 'OpenRouter request failed';

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response;

    try {
      response = await fetch(BASE + path, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:8080/app',
          'X-OpenRouter-Title': 'Veylo',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(path.includes('/audio/speech') ? 55_000 : 35_000),
      });
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
      if (attempt < 2) {
        await sleep(300 * (attempt + 1));
        continue;
      }
      throw new Error(last);
    }

    if (response.ok) return raw ? response : response.json();

    last = `OpenRouter ${response.status}: ${(await response.text()).slice(0, 600)}`;
    const retryable = response.status === 429 || response.status >= 500;

    if (retryable && attempt < 2) {
      await sleep(retryDelay(response, attempt));
      continue;
    }

    // Do not retry deterministic client/auth errors such as 400/401/403.
    throw new Error(last);
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
    const message = String(error);
    if (message.includes(' 401:') || message.includes(' 403:')) throw error;

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
