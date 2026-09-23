'use client';

import type { Profile, TranscriptTurn } from './types';
import { apiUrl } from './paths';

async function fetchJson<T>(url: string, body: unknown, timeoutMs = 45_000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || `Request failed ${response.status}`);
    return payload;
  } finally {
    window.clearTimeout(timer);
  }
}

function base64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function transcribe(bytes: Uint8Array, language?: string) {
  return fetchJson<{ text: string; language?: string; duration?: number; usage?: any }>(apiUrl('/api/stt'), {
    audioBase64: base64(bytes), format: 'wav', language,
  });
}

export function translate(text: string, args: {
  targetLanguage: string;
  sourceLanguage?: string;
  sourceCountry?: string;
  targetCountry?: string;
}) {
  return fetchJson<{ text: string; usage?: any }>(apiUrl('/api/translate'), { text, ...args });
}

export async function speak(text: string) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 55_000);
  try {
    const response = await fetch(apiUrl('/api/tts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error || `TTS failed ${response.status}`);
    }
    return response.blob();
  } finally {
    window.clearTimeout(timer);
  }
}

export function simulate(input: {
  text: string;
  profile: Profile;
  country: string;
  role: string;
  scenario: string;
  language?: string;
  history: Array<{ speaker: string; sourceText?: string; translatedText?: string }>;
}) {
  return fetchJson<{ reply: string }>(apiUrl('/api/simulate'), input);
}

export function mediate(turns: TranscriptTurn[]) {
  return fetchJson<{ note: string | null }>(apiUrl('/api/mediate'), { turns });
}
