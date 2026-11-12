// Sheet 5-۴: multiple-choice questions a hafiz actually needs — «آیهٔ بعدی/قبلی کدام است؟» and
// «این آیه در کدام صفحه/جزء است؟». Pure; the question has the same shape as the older types
// (key, questionText, questionDisplay, options, correctIndex, surah, name, ayah, questionType, fullAyah).

export const HAFIZ_MCQ_TYPES = [
  { id: 'next_ayah', label: 'آیهٔ بعدی کدام است؟' },
  { id: 'prev_ayah', label: 'آیهٔ قبلی کدام است؟' },
  { id: 'page', label: 'این آیه در کدام صفحه است؟' },
  { id: 'juz', label: 'این آیه در کدام جزء است؟' },
];
export const isHafizMcqType = (t) => HAFIZ_MCQ_TYPES.some((x) => x.id === t);

const SNIPPET_WORDS = 8;
const fullText = (a) => (a.tokens_with_diacritics || []).join(' ');
/** The start of an ayah, short enough for an answer button. */
export function snippet(a, words = SNIPPET_WORDS) {
  const t = a.tokens_with_diacritics || [];
  return t.length > words ? `${t.slice(0, words).join(' ')} …` : t.join(' ');
}

const defaultShuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const indexCache = new WeakMap();
function indexOf(dataset) {
  let m = indexCache.get(dataset);
  if (!m) { m = new Map(dataset.map((a) => [`${a.surah_number}:${a.ayah_number}`, a])); indexCache.set(dataset, m); }
  return m;
}

// Three wrong ayahs for a neighbour question: close ones from the same surah first (they are the ones a
// hafiz really confuses), then anything else. Never the asked ayah, never one that reads like the answer.
function neighbourDistractors(cur, correct, dataset, shuffle) {
  const taken = new Set([snippet(correct), snippet(cur)]);
  const pick = [];
  const add = (a) => { const s = snippet(a); if (!s || taken.has(s)) return; taken.add(s); pick.push(s); };
  const near = dataset.filter((a) => a.surah_number === cur.surah_number && Math.abs(a.ayah_number - cur.ayah_number) <= 6);
  for (const a of shuffle(near)) { if (pick.length >= 3) break; add(a); }
  if (pick.length < 3) for (const a of shuffle(dataset)) { if (pick.length >= 3) break; add(a); }
  return pick.length >= 3 ? pick : null;
}

// Three other numbers around `n` inside [lo, hi] (a neighbouring page is the honest wrong answer).
function nearbyNumbers(n, lo, hi, shuffle) {
  const pool = [];
  for (let d = 1; pool.length < 5 && d <= hi - lo; d++) { if (n - d >= lo) pool.push(n - d); if (n + d <= hi) pool.push(n + d); }
  return pool.length >= 3 ? shuffle(pool.slice(0, 5)).slice(0, 3) : null;
}

/** One question for `ayah`, or null when it cannot be asked (first/last ayah of a surah, no page number…). */
export function buildHafizQuestion(ayah, type, dataset, { shuffle = defaultShuffle, toAr = String } = {}) {
  if (!ayah || !isHafizMcqType(type)) return null;
  const base = { key: `${ayah.surah_number}:${ayah.ayah_number}`, surah: ayah.surah_number, name: ayah.surah_name, ayah: ayah.ayah_number, questionType: type, fullAyah: fullText(ayah), questionDisplay: fullText(ayah) };
  if (!base.questionDisplay) return null;

  if (type === 'next_ayah' || type === 'prev_ayah') {
    const step = type === 'next_ayah' ? 1 : -1;
    const correct = indexOf(dataset).get(`${ayah.surah_number}:${ayah.ayah_number + step}`);
    if (!correct || !snippet(correct)) return null;
    const wrong = neighbourDistractors(ayah, correct, dataset, shuffle);
    if (!wrong) return null;
    const answer = snippet(correct);
    const options = shuffle([answer, ...wrong]);
    return { ...base, questionText: step === 1 ? 'آیهٔ بعد از این آیه کدام است؟' : 'آیهٔ قبل از این آیه کدام است؟', options, correctIndex: options.indexOf(answer) };
  }

  const isPage = type === 'page';
  const n = Number(isPage ? ayah.page : ayah.juz);
  if (!Number.isInteger(n) || n < 1) return null;
  const others = nearbyNumbers(n, 1, isPage ? 604 : 30, shuffle);
  if (!others) return null;
  const nums = [n, ...others].sort((a, b) => a - b);
  const word = isPage ? 'صفحهٔ' : 'جزء';
  return { ...base, questionText: isPage ? 'این آیه در کدام صفحهٔ مصحف است؟' : 'این آیه در کدام جزء است؟', options: nums.map((x) => `${word} ${toAr(x)}`), correctIndex: nums.indexOf(n) };
}
