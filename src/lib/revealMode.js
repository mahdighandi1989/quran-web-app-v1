// Sheet 6-د: memorising without typing — «بزن تا نشان بده» and «حرفِ اولِ هر کلمه», graded by the
// reader («بلد بودم / بلد نبودم»). Pure helpers; the page owns the state.
import { segGraphemes } from './arabic.js';

export const REVEAL_MODES = [
  { id: 'reveal', label: 'بزن تا نشان بده (بی‌تایپ)' },
  { id: 'reveal_first', label: 'حرفِ اولِ هر کلمه (بی‌تایپ)' },
];
export const isRevealMode = (m) => m === 'reveal' || m === 'reveal_first';

/** What stands in for the hidden ayah: the first letter (with its marks) of every word, or one dot-group per word. */
export function maskTokens(tokens = [], mode = 'reveal') {
  return tokens.map((t) => {
    if (mode !== 'reveal_first') return '•••';
    const g = segGraphemes(String(t || ''));
    return g.length > 1 ? `${g[0]}…` : (g[0] || '');
  });
}

/** The session entry of one self-graded ayah (same shape the typed modes record). */
export function revealEntry(ayah, known) {
  return {
    key: `${ayah.surah_number}:${ayah.ayah_number}`, scope: 'ayah', surah: ayah.surah_number, ayah: ayah.ayah_number,
    typed: '', selfGraded: true, ...(known ? {} : { skip: true }),
    target: (ayah.tokens_with_diacritics || []).join(' '),
  };
}
