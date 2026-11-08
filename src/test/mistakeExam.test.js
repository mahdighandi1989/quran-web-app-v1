import { describe, expect, it } from 'vitest'
import { buildMistakeMcqDeck, correctionCounts, similarDistractors, summarizeSession, surahsWithMistakes } from '../lib/mistakeExam'

const mk = (s, a, toks, page = 1) => ({ surah_number: s, ayah_number: a, surah_name: 'س' + s, page, tokens_with_diacritics: toks })
const ds = [
  mk(1, 1, ['بِسْمِ', 'اللَّهِ', 'الرَّحْمَٰنِ', 'الرَّحِيمِ']),
  mk(1, 2, ['الْحَمْدُ', 'لِلَّهِ', 'رَبِّ', 'الْعَالَمِينَ']),
  mk(1, 3, ['الرَّحْمَٰنِ', 'الرَّحِيمِ']),            // 2 words: must still be testable
  mk(1, 4, ['مَالِكِ', 'يَوْمِ', 'الدِّينِ']),
  mk(2, 1, ['مَلِكِ', 'النَّاسِ', 'الرَّحِيمُ', 'الْعَالَمِينَ'], 2),
  mk(2, 2, ['يُفْرَقُ', 'غَلَبَتْ', 'سَاعَةٍ', 'قَلِيلٍ'], 3),
]
const rows = (...keys) => keys.map((k, i) => ({ key: k, s: +k.split(':')[0], a: +k.split(':')[1], count: 10 - i }))

describe('mistakes exam (owner sheet 7)', () => {
  it('reaches the requested count by skipping nothing testable, keeps the mistake order', () => {
    const items = rows('1:4', '1:2', '1:3', '1:1', '2:1')
    const deck = buildMistakeMcqDeck(items, ds, { count: 5 })
    expect(deck.map((c) => c.key)).toEqual(['1:4', '1:2', '1:3', '1:1', '2:1'])
  })
  it('skipped (unusable) rows are replaced by the next mistake', () => {
    const items = [{ key: '9:9' }, ...rows('1:4', '1:2')]
    expect(buildMistakeMcqDeck(items, ds, { count: 2 })).toHaveLength(2)
  })
  it('distractors are look-alike words, never the same plain spelling, never duplicates', () => {
    const d = similarDistractors('الرَّحْمَٰنِ', ds[0], ds, 3, () => 0)
    expect(d).toHaveLength(3)
    expect(new Set(d).size).toBe(3)
    expect(d).not.toContain('الرَّحْمَٰنِ')
    expect(d).toContain('الرَّحِيمِ')
    const m = similarDistractors('مَالِكِ', ds[3], ds, 3, () => 0)
    expect(m[0]).not.toBe('مَلِكِ') // sheet 22: same-surah words come first, even over a closer look-alike elsewhere
  })
  it('sheet 18-۳: a same-surah word beats an equally-close word from another surah', () => {
    const d2 = [mk(1, 1, ['كَتَبَ', 'قَالَ', 'ذَهَبَ']), mk(2, 1, ['كَتَمَ'], 2)]
    const d = similarDistractors('كَتَبَ', d2[0], d2, 3, () => 0)
    expect(d.indexOf('ذَهَبَ')).toBeLessThan(d.indexOf('كَتَمَ'))
  })
  it('card shows the full ayah and has exactly one correct option', () => {
    const c = buildMistakeMcqDeck(rows('1:2'), ds, { count: 1 })[0]
    expect(c.fullAyah).toBe('الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ')
    expect(c.options[c.correctIndex]).toBe(c.correctWord)
    expect(c.questionDisplay).toContain('[...]')
  })
  it('«تصحیح» counts only right answers AFTER the first mistake', () => {
    const sessions = [
      { wrongItems: [{ surah: 1, ayah: 2, when: 100 }], correctItems: [{ surah: 1, ayah: 2, when: 50 }, { surah: 1, ayah: 2, when: 200 }, { surah: 1, ayah: 9, when: 300 }] },
      { wrongItems: [{ surah: 1, ayah: 2, when: 400 }], correctItems: [] },
    ]
    const m = correctionCounts(sessions)
    expect(m.get('1:2')).toBe(1)
    expect(m.has('1:9')).toBe(false)
  })
  it('surah filter lists only surahs with mistakes, with counts', () => {
    expect(surahsWithMistakes([{ s: 2 }, { s: 1 }, { s: 1 }])).toEqual([[1, 2], [2, 1]])
  })
  it('session summary uses the first attempt per ayah', () => {
    const r = summarizeSession({
      wrongItems: [{ surah: 1, ayah: 2, when: 10 }],
      correctItems: [{ surah: 1, ayah: 2, when: 20, retry: true }, { surah: 1, ayah: 1, when: 5 }, { surah: 1, ayah: 4, when: 6 }, { surah: 1, ayah: 6, when: 7 }],
    })
    expect(r.total).toBe(4); expect(r.correct).toBe(3); expect(r.wrong).toEqual([{ key: '1:2', surah: 1, ayah: 2 }])
  })
})

describe('sheet 22', () => {
  it('same-surah words always beat look-alikes from another surah', () => {
    const d = similarDistractors('مَالِكِ', ds[3], ds, 3, () => 0)
    expect(d).not.toContain('مَلِكِ')            // surah 2 look-alike loses to surah 1 words
    const surah1 = new Set(ds.filter((a) => a.surah_number === 1).flatMap((a) => a.tokens_with_diacritics))
    for (const w of d) expect(surah1.has(w)).toBe(true)
  })
})

