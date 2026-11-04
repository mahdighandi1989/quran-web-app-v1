import { describe, expect, it } from 'vitest'
import { buildPracticeCards, emptyRangeMessage, sizeNotice } from '../lib/practiceDeck'

const nas = Array.from({ length: 6 }, (_, i) => ({ surah_number: 114, ayah_number: i + 1, surah_name: 'الناس',
  tokens_with_diacritics: ['قُلْ', 'أَعُوذُ', 'بِرَبِّ', 'النَّاسِ'], tokens_plain: ['قل', 'اعوذ', 'برب', 'الناس'] }))

describe('practice deck (owner 2026-11-04: /practice froze with An-Nas and size 40)', () => {
  it('a range smaller than the size gives exactly the range, never more and never a hang', () => {
    for (const cloze of ['all', 'first', 'last', 'random']) {
      const t0 = Date.now()
      const cards = buildPracticeCards(nas, { cloze, size: 40, order: 'random', shuffle: (a) => [...a].reverse() })
      expect(cards).toHaveLength(6)
      expect(Date.now() - t0).toBeLessThan(200)
    }
    expect(buildPracticeCards(nas, { size: 3 })).toHaveLength(3)
    expect(buildPracticeCards([], { size: 40 })).toEqual([])
    expect(buildPracticeCards(nas, { cloze: 'first' })[0].blanks).toEqual([0])
  })
  it('says how many verses the range has', () => {
    expect(sizeNotice(40, 6)).toContain('۶ آیه دارد')
    expect(sizeNotice(40, 40)).toBe('')
  })
  it('explains an empty flagged range precisely', () => {
    const m = emptyRangeMessage({ rangeType: 'flagged', flaggedSurahFilter: '114', surahName: 'الناس', versesInSurah: 6 })
    expect(m).toContain('سورهٔ الناس') && expect(m).toContain('نشان‌شده')
  })
})
