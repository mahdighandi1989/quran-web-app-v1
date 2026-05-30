import { describe, it, expect } from 'vitest';
import {
  computeOverallStats, computeStreak, dailySeries, activityHeatmap,
  mistakesByAyah, statsBySurah, formatDuration, dayKey,
} from '../lib/stats.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-05-30T12:00:00').getTime();
const at = (daysAgo, extra = {}) => ({
  id: NOW - daysAgo * DAY, start: NOW - daysAgo * DAY, end: NOW - daysAgo * DAY + 60000,
  correctItems: [], wrongItems: [], keys: [], ...extra,
});

describe('computeOverallStats', () => {
  it('sums correct/wrong, accuracy, durations and exam count', () => {
    const sessions = [
      at(0, { mode: 'practice', correctItems: [1, 2, 3], wrongItems: [1], end: NOW + 120000, start: NOW }),
      at(1, { mode: 'mcq_exam', correctItems: [1], wrongItems: [1, 2] }),
    ];
    const s = computeOverallStats(sessions);
    expect(s.totalSessions).toBe(2);
    expect(s.totalCorrect).toBe(4);
    expect(s.totalWrong).toBe(3);
    expect(s.accuracyPct).toBe(57); // 4/7
    expect(s.exams).toBe(1);
    expect(s.totalMs).toBeGreaterThan(0);
  });
  it('handles empty input', () => {
    expect(computeOverallStats([])).toMatchObject({ totalSessions: 0, accuracyPct: 0, totalCorrect: 0 });
  });
});

describe('computeStreak', () => {
  it('counts a current streak ending today', () => {
    const sessions = [at(0), at(1), at(2), at(4)]; // 3-day current (0,1,2), gap at 3
    const r = computeStreak(sessions, NOW);
    expect(r.current).toBe(3);
    expect(r.best).toBeGreaterThanOrEqual(3);
    expect(r.activeDays).toBe(4);
  });
  it('still counts current streak if last activity was yesterday', () => {
    const r = computeStreak([at(1), at(2)], NOW);
    expect(r.current).toBe(2);
  });
  it('returns zeros for no sessions', () => {
    expect(computeStreak([], NOW)).toEqual({ current: 0, best: 0, activeDays: 0 });
  });
});

describe('dailySeries', () => {
  it('returns N days oldest->newest with per-day accuracy', () => {
    const series = dailySeries([at(0, { correctItems: [1, 2], wrongItems: [1] })], 7, NOW);
    expect(series).toHaveLength(7);
    expect(series[6].day).toBe(dayKey(NOW)); // last is today
    expect(series[6].accuracyPct).toBe(67); // 2/3
    expect(series[0].accuracyPct).toBeNull(); // empty day
  });
});

describe('activityHeatmap', () => {
  it('builds week columns and reports max', () => {
    const { cols, max } = activityHeatmap([at(0), at(0), at(8)], 4, NOW);
    expect(cols.length).toBe(4);
    expect(cols[0].length).toBe(7);
    expect(max).toBe(2); // today has 2 sessions
  });
});

describe('mistakesByAyah & statsBySurah', () => {
  const sessions = [
    { wrongItems: [{ surah: 2, ayah: 5, when: 1 }, { surah: 2, ayah: 5, when: 2 }, { surah: 114, ayah: 1, when: 3 }], correctItems: [{ surah: 2, ayah: 5 }] },
  ];
  it('aggregates mistakes per ayah with corrections', () => {
    const rows = mistakesByAyah(sessions);
    const a25 = rows.find((r) => r.surah === 2 && r.ayah === 5);
    expect(a25.wrong).toBe(2);
    expect(a25.correct).toBe(1);
  });
  it('aggregates per surah sorted by most wrong', () => {
    const rows = statsBySurah(sessions);
    expect(rows[0].surah).toBe(2); // 2 wrong > 1 wrong
    expect(rows[0].wrong).toBe(2);
    expect(rows[0].accuracyPct).toBe(33); // 1 correct / 3 graded
  });
});

describe('formatDuration', () => {
  it('formats seconds/minutes/hours', () => {
    expect(formatDuration(30000)).toBe('30 ثانیه');
    expect(formatDuration(90000)).toContain('دقیقه');
    expect(formatDuration(3700000)).toContain('ساعت');
  });
});
