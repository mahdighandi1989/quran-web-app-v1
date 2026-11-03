// WHEN DOES THE SUPERVISOR COME? Measured from its own visits, not written down (ported from Detective-1's
// services/supervisor_rounds.py). The routines live in claude.ai, not in this repo, so a schedule hard-coded
// here would be true only until someone edits the routine — and a quietly wrong countdown is worse than none.
// Every supervisor round "knocks" (urgent claim / queue read); from the last knocks we say:
//   observed — watched, this is when it is next due
//   assumed  — nothing watched yet; the configured default
//   stale    — no knock for several cycles: the routine may be off («unmeasured» must never look like «fine»)
// Pure: a clock and a list of timestamps in, an answer out.

export const KEEP = 12;
export const HOURLY_LO = 45 * 60, HOURLY_HI = 75 * 60; // legacy export (kept; no longer used for the snap)
export const STALE_CYCLES = 3;

const parse = (list) => (Array.isArray(list) ? list : [])
  .map((v) => Date.parse(v)).filter((t) => Number.isFinite(t)).sort((a, b) => a - b);

export function recordRound(list, now = Date.now(), keep = KEEP) {
  const s = [...new Set([...parse(list), now])].sort((a, b) => a - b).slice(-keep);
  return s.map((t) => new Date(t).toISOString());
}

// The urgent routine's cron (UTC) — "M */N * * *", "M H,H,... * * *" or "M * * * *". Since 2026-11-03 it is
// `23 */3 * * *`: every THREE hours at minute 23 (00:23, 03:23, … UTC), not hourly.
export const DEFAULT_URGENT_CRON = '23 */3 * * *';
export function parseEveryCron(cron) {
  const s = typeof cron === 'number' ? `${cron} * * * *` : String(cron || DEFAULT_URGENT_CRON);
  const [m, h = '*'] = s.trim().split(/\s+/);
  const minute = Math.min(59, Math.max(0, Number(m) || 0));
  let hours;
  const step = /^\*\/(\d+)$/.exec(h);
  if (h === '*') hours = [...Array(24).keys()];
  else if (step) { const n = Math.max(1, Number(step[1])); hours = [...Array(24).keys()].filter((x) => x % n === 0); }
  else hours = h.split(',').map(Number).filter((x) => Number.isInteger(x) && x >= 0 && x <= 23);
  if (!hours.length) hours = [...Array(24).keys()];
  hours = [...new Set(hours)].sort((a, b) => a - b);
  const gaps = hours.map((x, i) => ((hours[(i + 1) % hours.length] - x + 24) % 24) || 24);
  return { minute, hours, every: Math.min(...gaps) * 3600 };
}
function nextSlot(now, { minute, hours }) {
  const d = new Date(now); d.setUTCMinutes(minute, 0, 0);
  for (let i = 0; i < 49; i++) {
    if (d.getTime() > now && hours.includes(d.getUTCHours())) return d.getTime();
    d.setUTCHours(d.getUTCHours() + 1);
  }
  return now + 3600000;
}
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
function commonMinute(stamps) {
  const c = new Map();
  for (const t of stamps) { const m = new Date(t).getUTCMinutes(); c.set(m, (c.get(m) || 0) + 1); }
  let best = null, bestN = -1;
  for (const t of stamps) { const m = new Date(t).getUTCMinutes(); if (c.get(m) >= bestN) { best = m; bestN = c.get(m); } } // newest wins a tie
  return best;
}
const minuteDist = (a, b) => { const d = Math.abs(a - b) % 60; return Math.min(d, 60 - d); };

// `schedule`: the configured cron (default every 3 h at :23); a bare number is the legacy «hourly at minute N».
// A round "knocks" several times (one claim per sheet, possibly long apart), so the period is measured only
// from the knocks near the routine's usual minute (its starts), and gaps shorter than 30 minutes are one visit.
export function nextRound(now, list, schedule = DEFAULT_URGENT_CRON) {
  const cfg = parseEveryCron(schedule);
  const stamps = parse(list);
  const mode = stamps.length ? commonMinute(stamps) : null;
  const starts = stamps.filter((t) => minuteDist(new Date(t).getUTCMinutes(), mode) <= 5);
  const gaps = starts.slice(1).map((b, i) => (b - starts[i]) / 1000).filter((g) => g >= 1800 && g <= 86400);
  let basis = 'assumed', every = cfg.every, at = nextSlot(now, cfg);
  if (gaps.length) {
    every = median(gaps);
    const k = Math.round(every / 3600);
    const last = starts[starts.length - 1];
    if (k >= 1 && Math.abs(every - k * 3600) <= 15 * 60) { // whole hours: snap to the observed minute
      every = k * 3600;
      const base = new Date(last); base.setUTCMinutes(mode, 0, 0);
      at = base.getTime();
    } else at = last;
    while (at <= now) at += every * 1000;
    basis = 'observed';
  }
  if (stamps.length && (now - stamps[stamps.length - 1]) / 1000 > STALE_CYCLES * every) basis = 'stale';
  return {
    at: new Date(at).toISOString(), in_minutes: Math.max(0, Math.round((at - now) / 60000)),
    every_minutes: Math.round(every / 60), basis, last_seen: stamps.length ? new Date(stamps[stamps.length - 1]).toISOString() : null,
  };
}

// cron "M H * * D,D" (UTC) — the only shape the full round uses.
export function parseCron(cron) {
  const [m, h, , , dow] = String(cron || '').trim().split(/\s+/);
  const days = String(dow || '*') === '*' ? [0, 1, 2, 3, 4, 5, 6] : String(dow).split(',').map(Number).filter((d) => d >= 0 && d <= 7).map((d) => d % 7);
  return { minute: Number(m) || 0, hour: Number(h) || 0, days: [...new Set(days)].sort((a, b) => a - b) };
}

export function nextFullRound(now, list, cron) {
  const { minute, hour, days } = parseCron(cron);
  let at = null;
  for (let add = 0; add < 8 && at === null; add++) {
    const d = new Date(now + add * 86400000); d.setUTCHours(hour, minute, 0, 0);
    if (days.includes(d.getUTCDay()) && d.getTime() > now) at = d.getTime();
  }
  if (at === null) at = now + 7 * 86400000;
  const stamps = parse(list);
  const last = stamps.length ? stamps[stamps.length - 1] : null;
  const longestGap = days.length ? Math.max(...days.map((d, i) => ((days[(i + 1) % days.length] - d + 7) % 7) || 7)) : 7;
  const basis = last !== null && now - last > (longestGap + 1) * 86400000 ? 'stale' : 'scheduled';
  return { at: new Date(at).toISOString(), in_minutes: Math.max(0, Math.round((at - now) / 60000)), last_seen: last ? new Date(last).toISOString() : null, basis, schedule: cron };
}
