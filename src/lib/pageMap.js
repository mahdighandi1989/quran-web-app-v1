// Sheet 6-ج (2026-11-16) — «نقشهٔ رنگیِ پیشرفتِ ۶۰۴ صفحه / ۳۰ جزء». Pure: derived from the recorded sessions and the
// page structure the app already ships (src/data/quranPages.json). Nothing new is stored.
import { weakSpots, dueReviews, reviewStep, REVIEW_STEPS_DAYS } from './todayPlan.js';

export const PAGES = 604;
// First page of each juz in the 604-page Madani mushaf (the one quranPages.json follows).
export const JUZ_START = [1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582];
export const juzOfPage = (p) => { let j = 1; for (let i = 0; i < JUZ_START.length; i++) if (p >= JUZ_START[i]) j = i + 1; return j; };

export const STATUS = {
  none: { label: 'تمرین نشده', cls: 'pm-none' },
  due: { label: 'مرورش سرِ موعد است', cls: 'pm-due' },
  learning: { label: 'در حالِ تثبیت (اشتباهِ اخیر)', cls: 'pm-learning' },
  solid: { label: 'بی‌اشتباه / تثبیت‌شده', cls: 'pm-solid' },
};

/** "surah:ayah" ⇒ page, from the page structure. */
export function pageIndex(pageStructure = []) {
  const m = new Map();
  for (const p of pageStructure || []) for (const s of p?.surahs || []) for (const a of s?.ayahs || []) m.set(`${s.surah}:${a}`, p.page);
  return m;
}

/** One status per page (index 0 = page 1) + counts. Worst wins: due > learning > solid > none. */
export function pageProgress(sessions = [], pageStructure = [], { now = Date.now() } = {}) {
  const where = pageIndex(pageStructure);
  const rank = { none: 0, solid: 1, learning: 2, due: 3 };
  const status = Array(PAGES).fill('none');
  const set = (key, st) => {
    const p = where.get(key); if (!p || p < 1 || p > PAGES) return;
    if (rank[st] > rank[status[p - 1]]) status[p - 1] = st;
  };
  for (const s of sessions) for (const it of [...(s.correctItems || []), ...(s.wrongItems || [])]) {
    if (it.surah != null && it.ayah != null) set(`${it.surah}:${it.ayah}`, 'solid');
  }
  for (const e of weakSpots(sessions, { now, limit: 0 })) if (reviewStep(e) < REVIEW_STEPS_DAYS.length) set(e.key, 'learning');
  for (const e of dueReviews(sessions, { now, limit: 0 })) set(e.key, 'due');
  const counts = { none: 0, due: 0, learning: 0, solid: 0 };
  for (const st of status) counts[st] += 1;
  return { status, counts };
}
