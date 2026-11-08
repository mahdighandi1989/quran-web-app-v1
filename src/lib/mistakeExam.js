// «آزمون از اشتباهات» — pure helpers (owner sheet 7, 2026-11-04).
// Kept out of App.jsx so each rule is unit-tested: deck size/order, look-alike distractors,
// what «تصحیح» means, which surahs the filter offers, and the end-of-exam summary.
import { normAR, levenshtein } from './arabic.js'

const keyOf = (a) => `${a.surah_number}:${a.ayah_number}`

/** Mistake rows → one lookup per ayah (O(1) instead of `dataset.find` per row). */
function indexDataset(dataset) {
  const m = new Map()
  for (const a of dataset || []) m.set(keyOf(a), a)
  return m
}

// Unique words of the whole text, with normalised form + where they occur. Cached per dataset array.
const _wordCache = new WeakMap()
function wordIndex(dataset) {
  if (_wordCache.has(dataset)) return _wordCache.get(dataset)
  const byWord = new Map()
  for (const a of dataset) {
    for (const w of a.tokens_with_diacritics || []) {
      let e = byWord.get(w)
      if (!e) { e = { w, n: normAR(w), pages: new Set(), surahs: new Set() }; byWord.set(w, e) }
      if (a.page != null) e.pages.add(a.page)
      e.surahs.add(a.surah_number)
    }
  }
  const list = [...byWord.values()].filter((e) => e.n)
  _wordCache.set(dataset, list)
  return list
}

/**
 * Look-alike distractors for `correct` (e.g. الرَّحْمَنِ / الرَّحِيمِ, مَالِكِ / مَلِكِ): the words with the
 * smallest edit distance on the plain spelling, nearer first; words from the same page/surah get a small bonus.
 * A word whose plain spelling is identical (only the vowel marks differ) is NOT used — it would be ambiguous.
 */
export function similarDistractors(correct, ayah, dataset, count = 3, rnd = Math.random) {
  const cn = normAR(correct)
  const scored = []
  for (const e of wordIndex(dataset)) {
    if (e.w === correct || e.n === cn) continue
    if (Math.abs(e.n.length - cn.length) > 3) continue
    let d = levenshtein(e.n, cn)
    if (d > Math.max(3, Math.ceil(cn.length / 2))) continue
    // owner sheet 18-۳: words the learner has met in the same page/surah beat equally-close words from elsewhere
    if (ayah && ayah.page != null && e.pages.has(ayah.page)) d -= 1.6
    else if (ayah && e.surahs.has(ayah.surah_number)) d -= 1.2
    scored.push({ w: e.w, s: d + rnd() * 0.25 })
  }
  scored.sort((x, y) => x.s - y.s)
  const out = scored.slice(0, count).map((x) => x.w)
  if (out.length < count) {      // tiny dataset / odd word: pad with anything different, never duplicates
    for (const e of wordIndex(dataset)) {
      if (out.length >= count) break
      if (e.w !== correct && e.n !== cn && !out.includes(e.w)) out.push(e.w)
    }
  }
  return out
}

/**
 * Deck for the mistakes exam. `items` are mistake rows already sorted the way the owner sees them
 * (default «بیشترین اشتباه») — that order is kept, NOT the mushaf order. Rows that cannot make a question
 * are skipped and the next mistake takes the seat, so the deck reaches `count` whenever enough mistakes exist.
 */
export function buildMistakeMcqDeck(items, dataset, { count = 20, shuffle = (a) => a, rnd = Math.random } = {}) {
  const idx = indexDataset(dataset)
  const cards = []
  for (const it of items || []) {
    if (cards.length >= count) break
    const ayah = idx.get(it.key)
    const tokens = ayah && ayah.tokens_with_diacritics
    if (!tokens || tokens.length < 2) continue
    // a blank in the middle when the ayah is long enough, otherwise any word (2-word ayahs are still testable)
    const pos = tokens.length >= 3 ? 1 + Math.floor(rnd() * (tokens.length - 2)) : Math.floor(rnd() * tokens.length)
    const correct = tokens[pos]
    const distractors = similarDistractors(correct, ayah, dataset, 3, rnd)
    if (distractors.length < 3) continue
    const options = shuffle([correct, ...distractors])
    const shown = tokens.map((t, i) => (i === pos ? '[...]' : t))
    cards.push({
      key: it.key, questionText: 'کلمه صحیح برای جای خالی کدام است؟', questionDisplay: shown.join(' '),
      fullAyah: tokens.join(' '), options, correctIndex: options.indexOf(correct), correctWord: correct,
      surah: ayah.surah_number, name: ayah.surah_name, ayah: ayah.ayah_number, questionType: 'random_word',
    })
  }
  return cards
}

/**
 * «تصحیح» = how many times the ayah was answered CORRECTLY after its first mistake (a wrong answer is never a
 * correction). Ayahs without a mistake are not in the map.
 */
export function correctionCounts(sessions) {
  const firstWrong = new Map()
  for (const s of sessions || []) for (const w of s.wrongItems || []) {
    const k = `${w.surah}:${w.ayah}`, t = w.when || 0
    if (!firstWrong.has(k) || t < firstWrong.get(k)) firstWrong.set(k, t)
  }
  const out = new Map()
  for (const s of sessions || []) for (const c of s.correctItems || []) {
    const k = `${c.surah}:${c.ayah}`
    if (!firstWrong.has(k)) continue
    if ((c.when || 0) > firstWrong.get(k)) out.set(k, (out.get(k) || 0) + 1)
  }
  return out
}

/** Only surahs that really have a mistake, with how many ayahs: [[num, count], …] by surah number. */
export function surahsWithMistakes(mistakes) {
  const m = new Map()
  for (const x of mistakes || []) m.set(x.s, (m.get(x.s) || 0) + 1)
  return [...m.entries()].sort((a, b) => a[0] - b[0])
}

/** First-attempt result per ayah of a finished session (retries and repeats do not change it). */
export function summarizeSession(s) {
  const first = new Map()
  const note = (it, ok) => {
    const k = `${it.surah}:${it.ayah}`, t = it.when || 0
    const cur = first.get(k)
    if (!cur || t < cur.t) first.set(k, { t, ok, surah: it.surah, ayah: it.ayah })
  }
  for (const w of (s && s.wrongItems) || []) note(w, false)
  for (const c of (s && s.correctItems) || []) note(c, true)
  const rows = [...first.entries()].map(([key, v]) => ({ key, ...v }))
  return {
    total: rows.length,
    correct: rows.filter((r) => r.ok).length,
    wrong: rows.filter((r) => !r.ok).map((r) => ({ key: r.key, surah: r.surah, ayah: r.ayah })),
  }
}
