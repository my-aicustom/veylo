'use client';

import type { Profile, SpeechPlaybackTiming, TranscriptTurn } from './types';
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

async function requestSpeech(text: string, startedAt: number) {
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
    return {
      response,
      responseMs: performance.now() - startedAt,
    };
  } finally {
    window.clearTimeout(timer);
  }
}

function waitForAudioEnd(audio: HTMLAudioElement) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
    const onEnded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Audio playback failed'));
    };
    audio.addEventListener('ended', onEnded, { once: true });
    audio.addEventListener('error', onError, { once: true });
  });
}

async function playBuffered(
  response: Response,
  startedAt: number,
  responseMs: number,
): Promise<SpeechPlaybackTiming> {
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  let playbackStartMs = performance.now() - startedAt;
  try {
    await audio.play();
    playbackStartMs = performance.now() - startedAt;
    await waitForAudioEnd(audio);
    return {
      mode: 'buffered',
      responseMs,
      playbackStartMs,
      totalMs: performance.now() - startedAt,
    };
  } finally {
    audio.pause();
    audio.removeAttribute('src');
    URL.revokeObjectURL(url);
  }
}

function waitForSourceOpen(mediaSource: MediaSource) {
  if (mediaSource.readyState === 'open') return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      mediaSource.removeEventListener('sourceopen', onOpen);
      mediaSource.removeEventListener('sourceclose', onClose);
    };
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      reject(new Error('MediaSource closed before opening'));
    };
    mediaSource.addEventListener('sourceopen', onOpen, { once: true });
    mediaSource.addEventListener('sourceclose', onClose, { once: true });
  });
}

function appendChunk(sourceBuffer: SourceBuffer, chunk: Uint8Array) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      sourceBuffer.removeEventListener('updateend', onEnd);
      sourceBuffer.removeEventListener('error', onError);
    };
    const onEnd = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Streaming audio buffer rejected a chunk'));
    };
    sourceBuffer.addEventListener('updateend', onEnd, { once: true });
    sourceBuffer.addEventListener('error', onError, { once: true });
    try {
      const stableBuffer = new Uint8Array(chunk.byteLength);
      stableBuffer.set(chunk);
      sourceBuffer.appendBuffer(stableBuffer.buffer);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

async function playProgressive(
  response: Response,
  contentType: string,
  startedAt: number,
  responseMs: number,
): Promise<SpeechPlaybackTiming> {
  if (!response.body) throw new Error('TTS response has no stream body');

  const mediaSource = new MediaSource();
  const objectUrl = URL.createObjectURL(mediaSource);
  const audio = new Audio(objectUrl);
  let playbackStarted = false;
  let playbackStartMs = 0;
  let firstChunkMs: number | undefined;

  try {
    await waitForSourceOpen(mediaSource);
    const sourceBuffer = mediaSource.addSourceBuffer(contentType);
    try { sourceBuffer.mode = 'sequence'; } catch {}

    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value?.byteLength) continue;

        if (firstChunkMs === undefined) firstChunkMs = performance.now() - startedAt;
        await appendChunk(sourceBuffer, value);
        if (!playbackStarted) {
          await audio.play();
          playbackStartMs = performance.now() - startedAt;
          playbackStarted = true;
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (sourceBuffer.updating) {
      await new Promise<void>((resolve) => {
        sourceBuffer.addEventListener('updateend', () => resolve(), { once: true });
      });
    }
    if (mediaSource.readyState === 'open') mediaSource.endOfStream();

    if (!playbackStarted) {
      await audio.play();
      playbackStartMs = performance.now() - startedAt;
      playbackStarted = true;
    }
    await waitForAudioEnd(audio);

    return {
      mode: 'progressive',
      responseMs,
      firstChunkMs,
      playbackStartMs,
      totalMs: performance.now() - startedAt,
    };
  } finally {
    audio.pause();
    audio.removeAttribute('src');
    if (mediaSource.readyState === 'open') {
      try { mediaSource.endOfStream(); } catch {}
    }
    URL.revokeObjectURL(objectUrl);
  }
}

export async function playSpeech(text: string): Promise<SpeechPlaybackTiming> {
  const startedAt = performance.now();
  const { response, responseMs } = await requestSpeech(text, startedAt);
  const contentType = (response.headers.get('content-type') || 'audio/mpeg').split(';')[0].trim();

  const progressive =
    Boolean(response.body) &&
    typeof MediaSource !== 'undefined' &&
    typeof MediaSource.isTypeSupported === 'function' &&
    MediaSource.isTypeSupported(contentType);

  if (progressive) {
    return playProgressive(response, contentType, startedAt, responseMs);
  }
  return playBuffered(response, startedAt, responseMs);
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
