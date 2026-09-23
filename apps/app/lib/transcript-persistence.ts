import type { TranscriptTurn } from './types';

const PREFIX = 'veylo:transcript:';
const MAX_TURNS = 80;

function key(sessionId: string) {
  return `${PREFIX}${sessionId.replace(/[^a-z0-9:_-]/gi, '-').slice(0, 120)}`;
}

export function loadTranscript(sessionId: string): TranscriptTurn[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key(sessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((turn) =>
        turn &&
        typeof turn.id === 'string' &&
        typeof turn.at === 'string' &&
        typeof turn.sourceText === 'string' &&
        typeof turn.translatedText === 'string' &&
        typeof turn.targetLanguage === 'string',
      )
      .slice(-MAX_TURNS);
  } catch {
    return [];
  }
}

export function saveTranscript(sessionId: string, turns: TranscriptTurn[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key(sessionId), JSON.stringify(turns.slice(-MAX_TURNS)));
  } catch {
    // Transcript persistence is best-effort and must never break a live conversation.
  }
}

export function clearTranscript(sessionId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key(sessionId));
  } catch {}
}
