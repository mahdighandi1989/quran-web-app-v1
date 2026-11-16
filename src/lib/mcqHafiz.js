// Sheet 5-۴: multiple-choice questions a hafiz actually needs — «آیهٔ بعدی/قبلی کدام است؟» and
// «این آیه در کدام صفحه/جزء است؟». Pure; the question has the same shape as the older types
// (key, questionText, questionDisplay, options, correctIndex, surah, name, ayah, questionType, fullAyah).
// «متشابهات» (2026-11-16): an ayah whose opening words also open an ayah of ANOTHER surah — the hafiz picks the
// continuation that belongs to this surah. The similar ayahs are found in the loaded text itself (no extra data).
import { normAR } from './arabic.js';

export const HAFIZ_MCQ_TYPES = [
  { id: 'next_ayah', label: 'آیهٔ بعدی کدام است؟' },
  { id: 'prev_ayah', label: 'آیهٔ قبلی کدام است؟' },
  { id: 'page', label: 'این آیه در کدام صفحه است؟' },
  { id: 'juz', label: 'این آیه در کدام جزء است؟' },
  { id: 'mutashabih', label: 'متشابهات: ادامهٔ همین سوره کدام است؟' },
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

// ---- متشابهات -------------------------------------------------------------------------------------------
const MIN_SHARED = 2;   // opening words two ayahs must share to count as «similar»
const MAX_SHARED = 6;
const words = (a) => (a.tokens_plain?.length ? a.tokens_plain : a.tokens_with_diacritics || []).map((w) => normAR(w)).filter(Boolean);
const openingCache = new WeakMap();
function openingIndex(dataset) {
  let m = openingCache.get(dataset);
  if (!m) {
    m = new Map();
    for (const a of dataset) {
      const w = words(a); if (w.length <= MIN_SHARED) continue;
      const k = w.slice(0, MIN_SHARED).join(' ');
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(a);
    }
    openingCache.set(dataset, m);
  }
  return m;
}
const sharedPrefix = (x, y) => { let i = 0; while (i < x.length && i < y.length && x[i] === y[i]) i++; return i; };
const continuation = (a, from) => {
  const t = (a.tokens_with_diacritics || []).slice(from);
  return t.length > SNIPPET_WORDS ? `${t.slice(0, SNIPPET_WORDS).join(' ')} …` : t.join(' ');
};

/** Ayahs of OTHER surahs that open with the same words as `ayah`, with how many words they share. */
export function similarOpenings(ayah, dataset) {
  const w = words(ayah);
  if (w.length <= MIN_SHARED) return [];
  const out = [];
  for (const b of openingIndex(dataset).get(w.slice(0, MIN_SHARED).join(' ')) || []) {
    if (b.surah_number === ayah.surah_number) continue;
    const n = Math.min(sharedPrefix(w, words(b)), MAX_SHARED);
    if (n >= MIN_SHARED && n < words(b).length) out.push({ ayah: b, shared: n });
  }
  return out.sort((x, y) => y.shared - x.shared);
}

function mutashabihQuestion(ayah, dataset, base, shuffle) {
  const sim = similarOpenings(ayah, dataset);
  if (!sim.length) return null;
  const len = words(ayah).length;
  const want = Math.min(3, sim.length);
  // Show as many shared words as possible while still leaving `want` look-alikes that share ALL of them
  // (a look-alike that shares fewer words would be cut mid-way and read like a truncated right answer).
  for (let k = sim[0].shared; k >= MIN_SHARED; k--) {
    if (len <= k) continue;
    const answer = continuation(ayah, k);
    const taken = new Set([answer]);
    const wrong = [];
    for (const { ayah: b, shared } of sim) {
      if (wrong.length >= 3 || shared < k) continue;
      const c = continuation(b, k);
      if (c && !taken.has(c) && !answer.startsWith(c) && !c.startsWith(answer)) { taken.add(c); wrong.push(c); }
    }
    if (!answer || wrong.length < Math.min(want, 3) && k > MIN_SHARED) continue;
    if (!wrong.length) return null;
    const opening = (ayah.tokens_with_diacritics || []).slice(0, k).join(' ');
    const options = shuffle([answer, ...wrong]);
    return { ...base, questionText: `در سورهٔ ${ayah.surah_name || ayah.surah_number}، این آغاز چطور ادامه می‌یابد؟ (آیه‌های سوره‌های دیگر هم با همین کلمه‌ها شروع می‌شوند)`, questionDisplay: `${opening} …`, options, correctIndex: options.indexOf(answer) };
  }
  return null;
}

/** One question for `ayah`, or null when it cannot be asked (first/last ayah of a surah, no page number…). */
export function buildHafizQuestion(ayah, type, dataset, { shuffle = defaultShuffle, toAr = String } = {}) {
  if (!ayah || !isHafizMcqType(type)) return null;
  const base = { key: `${ayah.surah_number}:${ayah.ayah_number}`, surah: ayah.surah_number, name: ayah.surah_name, ayah: ayah.ayah_number, questionType: type, fullAyah: fullText(ayah), questionDisplay: fullText(ayah) };
  if (!base.questionDisplay) return null;
  if (type === 'mutashabih') return mutashabihQuestion(ayah, dataset, base, shuffle);

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
