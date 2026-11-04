// Practice deck — pure functions (owner, 2026-11-04: «/practice قفل می‌شود»).
//
// The freeze was NOT a loop: with «آیات نشان‌شده» + «فیلتر سوره: الناس» and no flagged verse in that surah the deck was
// empty and the app called the browser's native alert() — which blocks every script on the tab until someone clicks OK
// (an automated browser cannot even see it). Messages are now non-blocking (App «notice»), and the size is capped here.

/** Cards for the typing practice. Never more than what the range has; `size` is only an upper bound. */
export function buildPracticeCards(ayat, { mode = 'without', cloze = 'all', randomCount = 2, order = 'sequential', size = 40, shuffle } = {}) {
  const list = Array.isArray(ayat) ? ayat : []
  const base = order === 'random' && typeof shuffle === 'function' ? shuffle(list) : list
  const cap = Math.min(base.length, Math.max(1, Number(size) || 1))
  const cards = []
  for (let n = 0; n < cap; n++) {           // bounded by the range itself
    const a = base[n]
    const D = a.tokens_with_diacritics || [], P = a.tokens_plain || []
    const display = mode === 'with' ? P : D
    const expect = mode === 'with' ? D : P
    let blanks = []
    if (cloze === 'all') blanks = [...expect.keys()]
    else if (cloze === 'first') blanks = expect.length ? [0] : []
    else if (cloze === 'last') blanks = expect.length ? [expect.length - 1] : []
    else if (cloze !== 'mcq') {
      const idx = [...expect.keys()].filter((i) => i > 0 && i < expect.length - 1)
      idx.sort(() => Math.random() - 0.5)
      blanks = idx.slice(0, Math.max(1, Math.min(randomCount || 2, idx.length)))
    }
    cards.push({ key: `${a.surah_number}:${a.ayah_number}`, surah: a.surah_number, name: a.surah_name, ayah: a.ayah_number, display, expect, blanks })
  }
  return cards
}

/** A clear Persian sentence for «nothing to practise here» — instead of a generic one. */
export function emptyRangeMessage({ rangeType, surahName, flaggedSurahFilter, versesInSurah } = {}) {
  if (rangeType === 'flagged') {
    if (flaggedSurahFilter) {
      const where = surahName ? `سورهٔ ${surahName}` : `سورهٔ ${flaggedSurahFilter}`
      return `در ${where} هیچ آیهٔ نشان‌شده‌ای نیست${versesInSurah ? ` (۰ از ${Number(versesInSurah).toLocaleString('fa-IR')} آیه)` : ''}. ` +
        'آیه‌ها را در «جستجو» نشان بزنید، یا محدوده را «سوره» بگذارید.'
    }
    return 'هنوز هیچ آیه‌ای نشان نزده‌اید. در «جستجو» روی ستارهٔ کنارِ آیه بزنید، یا محدوده را «سوره» بگذارید.'
  }
  if (rangeType === 'page') return 'در این صفحه‌ها آیه‌ای یافت نشد (ساختارِ صفحه‌ها بارگذاری شده است؟).'
  return 'در این بازه آیه‌ای یافت نشد؛ «از سوره/آیه» و «تا سوره/آیه» را بررسی کنید.'
}

/** «این بازه ۶ آیه دارد» when the deck is smaller than the requested size; '' otherwise. */
export function sizeNotice(requested, made) {
  const r = Number(requested) || 0
  if (!made || made >= r) return ''
  return `این بازه ${made.toLocaleString('fa-IR')} آیه دارد؛ دستهٔ ${made.toLocaleString('fa-IR')} کارتی ساخته شد (اندازهٔ درخواستی ${r.toLocaleString('fa-IR')}).`
}
