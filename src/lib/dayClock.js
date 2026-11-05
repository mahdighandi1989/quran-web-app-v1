// One definition of «a day» for every daily number (daily goal, streak, due reviews, 7/30-day series, heatmap).
// The boundary is midnight in the user's time zone: the saved `settings.timeZone` (IANA, e.g. "Asia/Dubai"), or — when
// it is empty/«auto» — the browser's own zone. Never UTC (sheet 14: an answer at 02:30 Dubai belongs to TODAY).
let zone = '';
const valid = (z) => { try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return true; } catch { return false; } };

export function setAppTimeZone(z) { zone = z && z !== 'auto' && valid(z) ? z : ''; }
export const getAppTimeZone = () => zone || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

const parts = (ts) => {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: getAppTimeZone(), hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const o = {}; for (const p of f.formatToParts(new Date(ts))) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second };
};

export const dayKey = (ts) => { const p = parts(ts); return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`; };

/** Epoch ms of 00:00 (in the app zone) of the day containing `ts`. */
export function startOfDay(ts) {
  const p = parts(ts);
  return ts - (((p.h * 60 + p.mi) * 60 + p.s) * 1000 + (new Date(ts).getMilliseconds()));
}
