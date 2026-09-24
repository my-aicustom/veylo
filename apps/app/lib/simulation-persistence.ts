'use client';

export interface SimulationTurn {
  id: string;
  speaker: 'you' | 'ai';
  text: string;
  translation?: string;
  at: string;
}

const PREFIX = 'veylo:simulation:';
const MAX_TURNS = 160;

function key(sessionId: string) {
  return `${PREFIX}${sessionId.replace(/[^a-z0-9:_-]/gi, '-').slice(0, 120)}`;
}

function trim(turns: SimulationTurn[]) {
  return turns.slice(-MAX_TURNS);
}

export function loadSimulation(sessionId: string): SimulationTurn[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key(sessionId));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return trim(parsed.filter((turn) =>
      turn &&
      typeof turn.id === 'string' &&
      (turn.speaker === 'you' || turn.speaker === 'ai') &&
      typeof turn.text === 'string' &&
      typeof turn.at === 'string',
    ));
  } catch {
    return [];
  }
}

export function saveSimulation(sessionId: string, turns: SimulationTurn[]) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(key(sessionId), JSON.stringify(trim(turns))); } catch {}
}

export function clearSimulation(sessionId: string) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(key(sessionId)); } catch {}
}

export function downloadSimulation(turns: SimulationTurn[], role: string, country: string) {
  if (!turns.length || typeof document === 'undefined') return;
  const text = [
    'VEYLO AI Simulation',
    `Counterpart: ${role}`,
    `Country: ${country}`,
    `Exported: ${new Date().toISOString()}`,
    '',
    ...turns.flatMap((turn) => [
      `[${turn.at}] ${turn.speaker === 'you' ? 'YOU' : 'AI'}`,
      turn.text,
      ...(turn.translation ? [`Translation: ${turn.translation}`] : []),
      '',
    ]),
  ].join('\n');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `veylo-simulation-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
