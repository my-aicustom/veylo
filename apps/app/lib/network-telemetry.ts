export type NetworkEventType =
  | 'offline'
  | 'online'
  | 'reconnecting'
  | 'reconnected'
  | 'quality-poor'
  | 'quality-lost'
  | 'audio-blocked'
  | 'audio-enabled';

export type NetworkEventTrace = {
  id: string;
  at: string;
  type: NetworkEventType;
  detail?: string;
};

const STORAGE_KEY = 'veylo.network.events.v1';
const MAX_EVENTS = 120;

function safeParse(raw: string | null): NetworkEventTrace[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.at === 'string' && typeof item.type === 'string')
      .slice(-MAX_EVENTS);
  } catch {
    return [];
  }
}

export function loadNetworkEvents(): NetworkEventTrace[] {
  if (typeof window === 'undefined') return [];
  try {
    return safeParse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function recordNetworkEvent(type: NetworkEventType, detail?: string) {
  if (typeof window === 'undefined') return;
  try {
    const next = [
      ...loadNetworkEvents(),
      {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        type,
        detail: detail?.slice(0, 240),
      },
    ].slice(-MAX_EVENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Diagnostics are best-effort and must never affect the call.
  }
}

export function clearNetworkEvents() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
