import type { LatencyTrace } from './types';

const STORAGE_KEY = 'veylo:latency-traces:v1';
const MAX_TRACES = 60;

function valid(trace: any): trace is LatencyTrace {
  return Boolean(
    trace &&
    typeof trace.id === 'string' &&
    typeof trace.at === 'string' &&
    typeof trace.targetLanguage === 'string' &&
    typeof trace.captureQueueMs === 'number' &&
    typeof trace.sttMs === 'number' &&
    typeof trace.totalTurnMs === 'number',
  );
}

export function loadLatencyTraces(): LatencyTrace[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(valid).slice(-MAX_TRACES);
  } catch {
    return [];
  }
}

export function recordLatencyTrace(trace: LatencyTrace) {
  if (typeof window === 'undefined') return;
  try {
    const next = [...loadLatencyTraces(), trace].slice(-MAX_TRACES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Telemetry is local and best-effort; it must never interrupt a live call.
  }
}

export function clearLatencyTraces() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
