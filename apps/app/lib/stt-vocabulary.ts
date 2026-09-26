/** Bounded vocabulary hints, never conversation instructions or generated text. */
export function sttVocabulary(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const terms: string[] = [];
  const seen = new Set<string>();
  let length = 0;
  for (const item of value.slice(0, 80)) {
    if (typeof item !== 'string') continue;
    const term = item.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    const key = term.toLowerCase();
    if (!term || seen.has(key)) continue;
    if (length + term.length > 800 || terms.length >= 40) break;
    seen.add(key);
    terms.push(term);
    length += term.length;
  }
  return terms;
}
