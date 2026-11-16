// Sheet 6-د: memorising without typing — «بزن تا نشان بده» and «حرفِ اولِ هر کلمه», graded by the
// reader («بلد بودم / بلد نبودم»). Pure helpers; the page owns the state.
import { segGraphemes } from './arabic.js';

export const REVEAL_MODES = [
  { id: 'reveal', label: 'بزن تا نشان بده (بی‌تایپ)' },
  { id: 'reveal_first', label: 'حرفِ اولِ هر کلمه (بی‌تایپ)' },
  { id: 'reveal_fade', label: 'محوشدنِ تدریجی (بی‌تایپ)' },
];
export const isRevealMode = (m) => m === 'reveal' || m === 'reveal_first' || m === 'reveal_fade';

// 2026-11-16 — sheet 6-د «محوشدنِ تدریجی کلمات ۲۰٪→۴۰٪→…→۱۰۰٪». The hidden words grow as NESTED sets:
// what is hidden at 40% is still hidden at 60%, so each step only takes words away. Order is stable per ayah.
export const FADE_LEVELS = [20, 40, 60, 80, 100];
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
/** Which word indexes are hidden at `level`% for the ayah `seed` ("surah:ayah"). */
export function fadeHidden(count, level, seed = '') {
  const n = Math.max(0, Math.round(count * Math.min(100, Math.max(0, Number(level) || 0)) / 100));
  const order = Array.from({ length: count }, (_, i) => i).sort((a, b) => hash(`${seed}#${a}`) - hash(`${seed}#${b}`) || a - b);
  return new Set(order.slice(0, Math.max(n, level > 0 && count ? 1 : 0)));
}
/** The next fade level after a page answered fully right (stays at 100). */
export const nextFadeLevel = (level) => FADE_LEVELS.find((l) => l > Number(level)) ?? 100;

// 2026-11-16 — sheet 6-ج: self-grading «سخت / خوب / آسان» (good = the old «بلد بودم»).
export const EASE = [
  { id: 'hard', label: '✓ سخت' },
  { id: 'good', label: '✓ خوب (بلد بودم)' },
  { id: 'easy', label: '✓ آسان' },
];

/** What stands in for the hidden ayah: the first letter (with its marks) of every word, or one dot-group per word. */
export function maskTokens(tokens = [], mode = 'reveal', { level = 20, seed = '' } = {}) {
  if (mode === 'reveal_fade') {
    const hidden = fadeHidden(tokens.length, level, seed);
    return tokens.map((t, i) => (hidden.has(i) ? '•••' : t));
  }
  return tokens.map((t) => {
    if (mode !== 'reveal_first') return '•••';
    const g = segGraphemes(String(t || ''));
    return g.length > 1 ? `${g[0]}…` : (g[0] || '');
  });
}

/** The session entry of one self-graded ayah (same shape the typed modes record). */
export function revealEntry(ayah, known, ease) {
  return {
    key: `${ayah.surah_number}:${ayah.ayah_number}`, scope: 'ayah', surah: ayah.surah_number, ayah: ayah.ayah_number,
    typed: '', selfGraded: true, ...(known ? {} : { skip: true }), ...(known && (ease === 'hard' || ease === 'easy') ? { ease } : {}),
    target: (ayah.tokens_with_diacritics || []).join(' '),
  };
}
