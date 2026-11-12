// Sheet 6-د: «بزن تا نشان بده» and «حرفِ اولِ هر کلمه» — memorising without typing.
import { describe, it, expect } from 'vitest';
import { REVEAL_MODES, isRevealMode, maskTokens, revealEntry } from '../lib/revealMode.js';
import { mistakeKind } from '../lib/todayPlan.js';
import { summarizeSession } from '../lib/mistakeExam.js';

const ayah = { surah_number: 1, ayah_number: 4, tokens_with_diacritics: ['مَالِكِ', 'يَوْمِ', 'الدِّينِ'] };

describe('reveal modes', () => {
  it('two modes, recognised by id', () => {
    expect(REVEAL_MODES.map((m) => m.id)).toEqual(['reveal', 'reveal_first']);
    expect(isRevealMode('reveal_first')).toBe(true);
    expect(isRevealMode('cloze_all')).toBe(false);
  });

  it('«بزن تا نشان بده» hides every word but keeps the word count', () => {
    expect(maskTokens(ayah.tokens_with_diacritics, 'reveal')).toEqual(['•••', '•••', '•••']);
  });

  it('«حرفِ اول» keeps the first letter WITH its marks and never leaks the rest', () => {
    const m = maskTokens(ayah.tokens_with_diacritics, 'reveal_first');
    expect(m).toEqual(['مَ…', 'يَ…', 'ا…']);
    expect(maskTokens(['و'], 'reveal_first')).toEqual(['و']); // a one-letter word is itself
    expect(maskTokens([], 'reveal_first')).toEqual([]);
  });

  it('«بلد نبودم» is recorded as a forgotten ayah, «بلد بودم» as a correct one — and both are summarised', () => {
    const wrong = revealEntry(ayah, false);
    const right = revealEntry({ ...ayah, ayah_number: 5 }, true);
    expect(wrong).toMatchObject({ key: '1:4', scope: 'ayah', surah: 1, ayah: 4, target: 'مَالِكِ يَوْمِ الدِّينِ', skip: true });
    expect(right.skip).toBeUndefined();
    expect(mistakeKind(wrong)).toBe('forgot');
    const sum = summarizeSession({ wrongItems: [wrong], correctItems: [right] });
    expect(sum.total).toBe(2);
    expect(sum.correct).toBe(1);
  });
});
