// «۵ نقطهٔ ضعفِ امروز» (sheet 9) and «برنامهٔ امروز» (sheet 6-الف) — pure functions over the recorded sessions, so the
// report, the home card and the tests all read the same numbers. No new data is stored; everything is derived from
// session.wrongItems / correctItems that the app already records (scope "token" carries the expected word).
import { eq } from './arabic.js';

const DAY = 24 * 3600 * 1000;
const HALF_LIFE_DAYS = 3;                 // a mistake from 3 days ago weighs half of one from today
export const REVIEW_STEPS_DAYS = [0, 1, 3, 7, 14, 30]; // correct answers in a row since the last mistake ⇒ next review

const ayahKey = (it) => `${it.surah}:${it.ayah}`;
const at = (it, s) => Number(it.when || s.end || s.start || s.id || 0);

/** What kind of mistake a recorded wrong answer is. */
export function mistakeKind(w) {
  const typed = String(w.typed ?? w.userAnswer ?? '').trim();
  const target = String(w.target ?? w.correctAnswer ?? '').trim();
  if (w.skip || !typed) return 'forgot';                       // left empty / skipped
  if (target && typed !== target && eq(typed, target)) return 'diacritics'; // same letters, other marks/spelling
  return 'other';                                              // another word (similar ayah, swapped, wrong)
}
export const KIND_FA = { forgot: 'فراموشی', diacritics: 'اعراب/املا', other: 'کلمهٔ دیگر' };

/**
 * Weak ayahs, strongest first: recency-weighted mistakes minus correct answers given AFTER the last mistake.
 * Each entry lists its weak WORDS (scope "token" / word MCQ) with the kinds of mistake.
 */
export function weakSpots(sessions = [], { now = Date.now(), limit = 5 } = {}) {
  const m = new Map();
  for (const s of sessions) {
    for (const w of s.wrongItems || []) {
      if (w.surah == null || w.ayah == null) continue;
      const k = ayahKey(w); const t = at(w, s);
      const e = m.get(k) || { key: k, surah: Number(w.surah), ayah: Number(w.ayah), wrong: 0, weight: 0, lastWrongAt: 0, words: new Map(), kinds: { forgot: 0, diacritics: 0, other: 0 }, correctAfter: 0, lastCorrectAt: 0 };
      e.wrong += 1;
      e.weight += Math.pow(0.5, Math.max(0, now - t) / DAY / HALF_LIFE_DAYS);
      e.lastWrongAt = Math.max(e.lastWrongAt, t);
      const kind = mistakeKind(w); e.kinds[kind] += 1;
      const word = String(w.target ?? w.correctAnswer ?? '').trim();
      if (word && (w.scope === 'token' || w.type)) {
        const ww = e.words.get(word) || { word, count: 0, kinds: { forgot: 0, diacritics: 0, other: 0 } };
        ww.count += 1; ww.kinds[kind] += 1; e.words.set(word, ww);
      }
      m.set(k, e);
    }
  }
  for (const s of sessions) {
    for (const c of s.correctItems || []) {
      const e = m.get(ayahKey(c)); if (!e) continue;
      const t = at(c, s);
      if (t > e.lastWrongAt) { e.correctAfter += 1; e.lastCorrectAt = Math.max(e.lastCorrectAt, t); }
    }
  }
  const out = [...m.values()].map((e) => ({
    ...e,
    words: [...e.words.values()].sort((a, b) => b.count - a.count).slice(0, 3),
    score: e.weight / (1 + e.correctAfter),
  })).filter((e) => e.score > 0.01);
  out.sort((a, b) => b.score - a.score || b.wrong - a.wrong || b.lastWrongAt - a.lastWrongAt);
  return limit ? out.slice(0, limit) : out;
}

/** Spaced review: an ayah with mistakes is due when its interval (by correct answers since the last mistake) has passed. */
export function dueReviews(sessions = [], { now = Date.now(), limit = 20 } = {}) {
  const all = weakSpots(sessions, { now, limit: 0 });
  const due = all.filter((e) => {
    const step = REVIEW_STEPS_DAYS[Math.min(e.correctAfter, REVIEW_STEPS_DAYS.length - 1)];
    if (e.correctAfter >= REVIEW_STEPS_DAYS.length) return false; // learned: 6 right in a row since the last mistake
    const since = e.correctAfter ? e.lastCorrectAt : e.lastWrongAt;
    return now - since >= step * DAY;
  });
  return limit ? due.slice(0, limit) : due;
}

/** How many answers were graded today (the daily goal counts these). */
export function gradedToday(sessions = [], now = Date.now()) {
  const d = new Date(now); const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  let n = 0;
  for (const s of sessions) for (const it of [...(s.wrongItems || []), ...(s.correctItems || [])]) if (at(it, s) >= start) n += 1;
  return n;
}

/** The three tasks of «برنامهٔ امروز». `lastHifzPage` = where memorising stopped (persisted by the app). */
export function todayPlan(sessions = [], { now = Date.now(), lastHifzPage = 1, dailyGoal = 20 } = {}) {
  const reviews = dueReviews(sessions, { now, limit: 20 });
  const done = gradedToday(sessions, now);
  return {
    reviews,                                               // spaced review of weak ayahs (one button)
    hifzPage: Math.min(604, Math.max(1, Number(lastHifzPage) || 1)), // continue memorising from here
    goal: { done, target: Number(dailyGoal) || 20, left: Math.max(0, (Number(dailyGoal) || 20) - done) },
  };
}

/** Items in the shape `startTestFromReport` takes (it reads `.key` "surah:ayah"). */
export const asPracticeItems = (spots) => spots.map((e) => ({ key: e.key, surah: e.surah, ayah: e.ayah }));
