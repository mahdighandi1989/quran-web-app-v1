// Pure analytics helpers over the saved practice/exam sessions. No React, no I/O — easy to test.
// A session looks like: { id, start, end, mode, size, keys[], correctItems[], wrongItems[],
//   completedCount, cloze, timeLimit, questionType }

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export const sessionCorrect = (s) => (s && s.correctItems && s.correctItems.length) || 0;
export const sessionWrong = (s) => (s && s.wrongItems && s.wrongItems.length) || 0;
export const sessionGraded = (s) => sessionCorrect(s) + sessionWrong(s);
export const sessionTime = (s) => (s && s.start) || (s && s.id) || 0;
export const sessionDurationMs = (s) => (s && s.end && s.start && s.end > s.start) ? (s.end - s.start) : 0;
export const isExamSession = (s) => /exam/.test((s && s.mode) || '');

// Headline KPIs across all sessions.
export function computeOverallStats(sessions = []) {
  let totalCorrect = 0, totalWrong = 0, totalPracticed = 0, totalMs = 0, exams = 0;
  for (const s of sessions) {
    totalCorrect += sessionCorrect(s);
    totalWrong += sessionWrong(s);
    totalPracticed += s.completedCount || (s.keys ? s.keys.length : 0) || 0;
    totalMs += sessionDurationMs(s);
    if (isExamSession(s)) exams += 1;
  }
  const graded = totalCorrect + totalWrong;
  return {
    totalSessions: sessions.length,
    exams,
    totalCorrect, totalWrong, totalPracticed,
    accuracyPct: graded ? Math.round((totalCorrect / graded) * 100) : 0,
    totalMs,
    avgSessionMs: sessions.length ? Math.round(totalMs / sessions.length) : 0,
  };
}

// Consecutive-day streak (current + best) based on days that have at least one session.
export function computeStreak(sessions = [], now = Date.now()) {
  const days = new Set(sessions.map((s) => dayKey(sessionTime(s))).filter(Boolean));
  if (!days.size) return { current: 0, best: 0, activeDays: 0 };
  // best streak
  const sorted = [...days].sort();
  let best = 1, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = startOfDay(new Date(sorted[i - 1]).getTime());
    const cur = startOfDay(new Date(sorted[i]).getTime());
    run = (cur - prev === DAY) ? run + 1 : 1;
    if (run > best) best = run;
  }
  // current streak: walk back from today (or yesterday) while days exist
  let current = 0;
  let cursor = startOfDay(now);
  if (!days.has(dayKey(cursor))) cursor -= DAY; // allow "yesterday" to still count today's streak
  while (days.has(dayKey(cursor))) { current += 1; cursor -= DAY; }
  return { current, best, activeDays: days.size };
}

// Per-day accuracy + counts for the last N days (oldest -> newest). For the trend chart.
export function dailySeries(sessions = [], days = 14, now = Date.now()) {
  const today = startOfDay(now);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const ts = today - i * DAY;
    out.push({ day: dayKey(ts), ts, correct: 0, wrong: 0, sessions: 0 });
  }
  const idx = new Map(out.map((d, i) => [d.day, i]));
  for (const s of sessions) {
    const k = dayKey(sessionTime(s));
    if (idx.has(k)) {
      const d = out[idx.get(k)];
      d.correct += sessionCorrect(s);
      d.wrong += sessionWrong(s);
      d.sessions += 1;
    }
  }
  for (const d of out) {
    const g = d.correct + d.wrong;
    d.accuracyPct = g ? Math.round((d.correct / g) * 100) : null;
    d.total = g;
  }
  return out;
}

// Activity heatmap buckets (GitHub-style) for the last `weeks` weeks. Returns {weeks, max}.
export function activityHeatmap(sessions = [], weeks = 13, now = Date.now()) {
  const counts = new Map();
  for (const s of sessions) {
    const k = dayKey(sessionTime(s));
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const today = startOfDay(now);
  // align end to the most recent Saturday-week; simplest: build `weeks*7` days ending today.
  const totalDays = weeks * 7;
  const cells = [];
  let max = 0;
  for (let i = totalDays - 1; i >= 0; i--) {
    const ts = today - i * DAY;
    const k = dayKey(ts);
    const c = counts.get(k) || 0;
    if (c > max) max = c;
    cells.push({ ts, day: k, count: c });
  }
  // chunk into columns of 7 (weeks)
  const cols = [];
  for (let i = 0; i < cells.length; i += 7) cols.push(cells.slice(i, i + 7));
  return { cols, max };
}

// Aggregate mistakes per ayah across all sessions, with improvement (corrections after).
export function mistakesByAyah(sessions = []) {
  const m = new Map(); // key "s:a" -> {surah, ayah, wrong, correct, lastWrongAt}
  for (const s of sessions) {
    for (const w of s.wrongItems || []) {
      const key = `${w.surah}:${w.ayah}`;
      const e = m.get(key) || { surah: w.surah, ayah: w.ayah, wrong: 0, correct: 0, lastWrongAt: 0 };
      e.wrong += 1; e.lastWrongAt = Math.max(e.lastWrongAt, w.when || sessionTime(s));
      m.set(key, e);
    }
    for (const c of s.correctItems || []) {
      const key = `${c.surah}:${c.ayah}`;
      const e = m.get(key); if (e) e.correct += 1;
    }
  }
  return [...m.values()];
}

// Per-surah aggregate (correct/wrong/accuracy) sorted by most-wrong.
export function statsBySurah(sessions = []) {
  const m = new Map();
  const add = (surah, field) => {
    const e = m.get(surah) || { surah, correct: 0, wrong: 0 };
    e[field] += 1; m.set(surah, e);
  };
  for (const s of sessions) {
    for (const w of s.wrongItems || []) add(w.surah, 'wrong');
    for (const c of s.correctItems || []) add(c.surah, 'correct');
  }
  const rows = [...m.values()].map((e) => {
    const g = e.correct + e.wrong;
    return { ...e, total: g, accuracyPct: g ? Math.round((e.correct / g) * 100) : 0 };
  });
  rows.sort((a, b) => b.wrong - a.wrong || b.total - a.total);
  return rows;
}

export function formatDuration(ms) {
  const sec = Math.round((ms || 0) / 1000);
  if (sec < 60) return `${sec} ثانیه`;
  const min = Math.floor(sec / 60), s = sec % 60;
  if (min < 60) return `${min} دقیقه${s ? ` و ${s} ثانیه` : ''}`;
  const hr = Math.floor(min / 60), mm = min % 60;
  return `${hr} ساعت${mm ? ` و ${mm} دقیقه` : ''}`;
}
