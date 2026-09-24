import type { TranscriptTurn } from './types';

const PREFIX = 'veylo:transcript:';
export const MAX_TRANSCRIPT_TURNS = 500;

function key(sessionId: string) {
  return `${PREFIX}${sessionId.replace(/[^a-z0-9:_-]/gi, '-').slice(0, 120)}`;
}

function validTurn(turn: any): turn is TranscriptTurn {
  return Boolean(
    turn &&
    typeof turn.id === 'string' &&
    typeof turn.at === 'string' &&
    typeof turn.sourceText === 'string' &&
    typeof turn.translatedText === 'string' &&
    typeof turn.targetLanguage === 'string'
  );
}

export function trimTranscript(turns: TranscriptTurn[]) {
  return turns.slice(-MAX_TRANSCRIPT_TURNS);
}

export function loadTranscript(sessionId: string): TranscriptTurn[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key(sessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return trimTranscript(parsed.filter(validTurn));
  } catch {
    return [];
  }
}

export function saveTranscript(sessionId: string, turns: TranscriptTurn[]) {
  if (typeof window === 'undefined') return;
  const trimmed = trimTranscript(turns);

  // Most browsers provide several MB of localStorage. If the quota is unusually
  // constrained, progressively retain the newest half instead of breaking the call.
  let candidate = trimmed;
  while (candidate.length) {
    try {
      window.localStorage.setItem(key(sessionId), JSON.stringify(candidate));
      return;
    } catch {
      if (candidate.length <= 40) return;
      candidate = candidate.slice(-Math.max(40, Math.floor(candidate.length / 2)));
    }
  }
}

export function clearTranscript(sessionId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key(sessionId));
  } catch {}
}
