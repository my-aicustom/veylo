const BASE = 'https://openrouter.ai/api/v1';

function key() {
  const value = process.env.OPENROUTER_API_KEY;
  if (!value) throw new Error('OPENROUTER_API_KEY is not configured');
  return value;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function providerLog(event: string, details: Record<string, unknown>) {
  console.info(JSON.stringify({
    ts: new Date().toISOString(),
    component: 'openrouter',
    event,
    ...details,
  }));
}

async function request(path: string, body: unknown, raw = false) {
  let last = 'OpenRouter request failed';
  const requestId = crypto.randomUUID();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const startedAt = Date.now();
    let response: Response;

    try {
      response = await fetch(BASE + path, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:8080',
          'X-OpenRouter-Title': 'Veylo',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(path.includes('/audio/speech') ? 55_000 : 35_000),
      });
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
      providerLog('network_error', {
        requestId,
        path,
        attempt: attempt + 1,
        latencyMs: Date.now() - startedAt,
        error: last,
      });
      if (attempt < 2) {
        await sleep(300 * (attempt + 1));
        continue;
      }
      throw new Error(last);
    }

    const generationId = response.headers.get('x-generation-id');
    const latencyMs = Date.now() - startedAt;

    if (response.ok) {
      providerLog('success', {
        requestId,
        path,
        attempt: attempt + 1,
        status: response.status,
        latencyMs,
        generationId: generationId || undefined,
      });
      return raw ? response : response.json();
    }

    const responseText = (await response.text()).slice(0, 600);
    last = `OpenRouter ${response.status}: ${responseText}`;
    const retryable = response.status === 429 || response.status >= 500;

    providerLog('provider_error', {
      requestId,
      path,
      attempt: attempt + 1,
      status: response.status,
      latencyMs,
      retryable,
      generationId: generationId || undefined,
    });

    if (retryable && attempt < 2) {
      await sleep(400 * (attempt + 1));
      continue;
    }
    throw new Error(last);
  }

  throw new Error(last);
}

export async function stt(audioBase64: string, format: string, language?: string) {
  const body = {
    model: process.env.STT_MODEL || 'openai/whisper-large-v3-turbo',
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
  const sort = process.env.OPENROUTER_PROVIDER_SORT;
  const provider =
    sort === 'latency' || sort === 'throughput' || sort === 'price'
      ? { sort, allow_fallbacks: true }
      : undefined;

  return request('/chat/completions', {
    model: process.env.TRANSLATION_MODEL || 'google/gemini-3.1-flash-lite',
    messages,
    temperature,
    reasoning: { effort: 'minimal', exclude: true },
    max_tokens: 900,
    usage: { include: true },
    ...(provider ? { provider } : {}),
  });
}

async function validateAudio(response: Response) {
  const contentType = response.headers.get('content-type')?.toLowerCase() || '';
  if (!contentType.startsWith('audio/')) {
    const message = (await response.text()).slice(0, 500);
    throw new Error(`TTS returned ${contentType || 'an unknown content type'}: ${message}`);
  }
  return response;
}

export async function tts(text: string) {
  const model = process.env.TTS_MODEL || 'x-ai/grok-voice-tts-1.0';
  const voice = process.env.TTS_VOICE || 'eve';

  try {
    const response = (await request('/audio/speech', {
      model,
      input: text,
      voice,
      response_format: 'mp3',
    }, true)) as Response;
    return validateAudio(response);
  } catch (error) {
    const fallbackModel = process.env.TTS_FALLBACK_MODEL;
    const fallbackVoice = process.env.TTS_FALLBACK_VOICE;
    if (!fallbackModel || !fallbackVoice || fallbackModel === model) throw error;

    const response = (await request('/audio/speech', {
      model: fallbackModel,
      input: text,
      voice: fallbackVoice,
      response_format: 'mp3',
    }, true)) as Response;
    return validateAudio(response);
  }
}
