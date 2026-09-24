'use client';

const PREFIX = 'veylo:glossary:';
const MAX_TERMS = 40;
const MAX_TERM_LENGTH = 120;

function key(sessionId: string) {
  return `${PREFIX}${sessionId.replace(/[^a-z0-9:_-]/gi, '-').slice(0, 120)}`;
}

export function parseGlossary(value: string) {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const raw of value.split(/[\n,;]+/)) {
    const term = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_TERM_LENGTH);
    if (!term) continue;
    const normalized = term.toLocaleLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    terms.push(term);
    if (terms.length >= MAX_TERMS) break;
  }
  return terms;
}

export function glossaryToInput(terms: string[]) {
  return terms.join(', ');
}

export function loadSessionGlossary(sessionId: string) {
  if (typeof window === 'undefined') return [] as string[];
  try {
    const raw = window.localStorage.getItem(key(sessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parseGlossary(parsed.filter((item) => typeof item === 'string').join(','));
  } catch {
    return [];
  }
}

export function saveSessionGlossary(sessionId: string, terms: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key(sessionId), JSON.stringify(parseGlossary(terms.join(','))));
  } catch {}
}
