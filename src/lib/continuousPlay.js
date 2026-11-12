// Continuous play of the hifz page (sheets 19-۳, 21-۲/۳, 6-هـ): which ayah comes next when
// «تکرارِ هر آیه», «بازهٔ آیه‌ها × N» and «مکث برای تکرارِ من» are on. Pure — the component
// owns the audio and the timers.

export const RANGE_REPEAT_CHOICES = [1, 2, 3, 5, 10];
const clampInt = (v, lo, hi, dflt) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt; };

// `range` = { from, to } as indexes into the page's ayahs, or null for the whole page.
// Returns inclusive { start, end, whole }; a reversed or out-of-page range is repaired, never thrown on.
export function clampRange(range, length) {
  const last = Math.max(0, (Number(length) || 0) - 1);
  if (!range) return { start: 0, end: last, whole: true };
  const a = clampInt(range.from, 0, last, 0);
  const b = clampInt(range.to, 0, last, last);
  const start = Math.min(a, b), end = Math.max(a, b);
  return { start, end, whole: start === 0 && end === last };
}

// One ayah has just finished. state = { index, rep, loop }; cfg = { start, end, ayahRepeat, rangeRepeat }.
// → the next state, or { done: true } when the range has been played `rangeRepeat` times.
export function advanceQueue(state, cfg) {
  const ayahRepeat = clampInt(cfg.ayahRepeat, 1, 10, 1);
  const rangeRepeat = clampInt(cfg.rangeRepeat, 1, 10, 1);
  const { index, rep = 0, loop = 0 } = state;
  if (rep + 1 < ayahRepeat) return { index, rep: rep + 1, loop };
  if (index < cfg.end) return { index: index + 1, rep: 0, loop };
  if (loop + 1 < rangeRepeat) return { index: cfg.start, rep: 0, loop: loop + 1 };
  return { done: true };
}

// «مکث برای تکرارِ من»: silence as long as the ayah just took to play (at the chosen speed),
// so the listener can say it back. Unknown duration (stream without metadata) ⇒ 4 s.
export function echoPauseMs(durationSec, rate = 1) {
  const d = Number(durationSec), r = Number(rate) > 0 ? Number(rate) : 1;
  if (!Number.isFinite(d) || d <= 0) return 4000;
  return Math.max(1500, Math.min(90000, Math.round((d / r) * 1000)));
}

// Label of one ayah in the «از آیه / تا آیه» pickers; the surah name is added only when the page holds more than one.
export function rangeOptionLabel(ayah, multiSurah, toAr = String) {
  const n = toAr(ayah.ayah_number);
  return multiSurah ? `${ayah.surah_name || `سوره ${toAr(ayah.surah_number)}`} ${n}` : n;
}
