const ECHO_WINDOW_MS = 6_000;

function normalize(text: string) {
  return text.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function similarity(left: string, right: string) {
  const a = Array.from(left);
  const b = Array.from(right);
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length, 1);
}

export function isRecentSpeechEcho(text: string, spoken: { text: string; at: number }[], now = Date.now()) {
  const heard = normalize(text);
  if (!heard) return false;
  return spoken.some((item) => {
    if (now < item.at || now - item.at > ECHO_WINDOW_MS) return false;
    const said = normalize(item.text);
    if (!said) return false;
    if (heard === said) return true;
    const shorter = heard.length < said.length ? heard : said;
    const longer = heard.length < said.length ? said : heard;
    if (shorter.length >= 8 && shorter.length / longer.length >= 0.5 && longer.includes(shorter)) return true;
    if (heard.length > 500 || said.length > 500) return false;
    return similarity(heard, said) >= 0.7;
  });
}
