// Unit tests for the engagement instrumentation layer (src/lib/analytics.js).
// These assert the *measurement* behaviour the adoption KPI relies on, against an isolated
// in-memory store so nothing leaks between cases.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DAILY_INTERACTION_TARGET,
  INTERACTION,
  trackInteraction,
  recordLocalInteraction,
  uniqueDailyInteractions,
  interactionSeries,
  engagementReport,
  resetEngagementLedger,
  configureAnalytics,
} from '../lib/analytics.js';

// Minimal in-memory localStorage-shaped store.
function makeStore() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

describe('engagement analytics', () => {
  let store;
  beforeEach(() => {
    store = makeStore();
    configureAnalytics(null); // no production sink unless a test opts in
  });

  it('exposes the measurable KPI target (500 unique daily interactions)', () => {
    expect(DAILY_INTERACTION_TARGET).toBe(500);
  });

  it('records distinct un-keyed interactions as separate unique events', () => {
    const now = new Date('2026-06-06T10:00:00').getTime();
    recordLocalInteraction(INTERACTION.SESSION_COMPLETE, {}, now, store);
    recordLocalInteraction(INTERACTION.SESSION_COMPLETE, {}, now, store);
    expect(uniqueDailyInteractions(now, store)).toBe(2);
  });

  it('collapses repeated keyed interactions into one unique event per day', () => {
    const now = new Date('2026-06-06T10:00:00').getTime();
    recordLocalInteraction(INTERACTION.TAB_VIEW, { dedupeKey: 'train' }, now, store);
    recordLocalInteraction(INTERACTION.TAB_VIEW, { dedupeKey: 'train' }, now, store);
    recordLocalInteraction(INTERACTION.TAB_VIEW, { dedupeKey: 'exam' }, now, store);
    expect(uniqueDailyInteractions(now, store)).toBe(2); // train + exam, not 3
  });

  it('buckets interactions by calendar day', () => {
    const day1 = new Date('2026-06-05T23:00:00').getTime();
    const day2 = new Date('2026-06-06T01:00:00').getTime();
    recordLocalInteraction(INTERACTION.APP_OPEN, {}, day1, store);
    recordLocalInteraction(INTERACTION.APP_OPEN, {}, day2, store);
    expect(uniqueDailyInteractions(day1, store)).toBe(1);
    expect(uniqueDailyInteractions(day2, store)).toBe(1);
  });

  it('builds an N-day series ending today', () => {
    const now = new Date('2026-06-06T10:00:00').getTime();
    recordLocalInteraction(INTERACTION.APP_OPEN, {}, now, store);
    const series = interactionSeries(30, now, store);
    expect(series).toHaveLength(30);
    expect(series[series.length - 1]).toMatchObject({ day: '2026-06-06', count: 1 });
    expect(series[0].count).toBe(0);
  });

  it('engagementReport reflects the gap to target and the met flag', () => {
    const now = new Date('2026-06-06T10:00:00').getTime();
    // 3 interactions today — far below target.
    for (let i = 0; i < 3; i++) recordLocalInteraction(INTERACTION.SESSION_COMPLETE, {}, now, store);
    const r = engagementReport(now, store);
    expect(r.target).toBe(500);
    expect(r.today).toBe(3);
    expect(r.met).toBe(false);
    expect(r.gapToTarget).toBe(497);
  });

  it('met flag flips true once today reaches the target', () => {
    const now = new Date('2026-06-06T10:00:00').getTime();
    for (let i = 0; i < DAILY_INTERACTION_TARGET; i++) {
      recordLocalInteraction(INTERACTION.PRACTICE_ANSWER, {}, now, store);
    }
    const r = engagementReport(now, store);
    expect(r.today).toBe(DAILY_INTERACTION_TARGET);
    expect(r.met).toBe(true);
    expect(r.gapToTarget).toBe(0);
  });

  it('forwards tracked interactions to the production analytics sink', () => {
    const logEvent = vi.fn();
    const analytics = { id: 'ga4' };
    configureAnalytics({ analytics, logEvent });
    const now = new Date('2026-06-06T10:00:00').getTime();
    trackInteraction(INTERACTION.SESSION_COMPLETE, { mode: 'practice' }, now, store);
    expect(logEvent).toHaveBeenCalledWith(analytics, 'session_complete', { mode: 'practice' });
    // ...and still records locally for measurement.
    expect(uniqueDailyInteractions(now, store)).toBe(1);
  });

  it('never throws if the sink errors — measurement still succeeds', () => {
    configureAnalytics({ analytics: {}, logEvent: () => { throw new Error('GA down'); } });
    const now = new Date('2026-06-06T10:00:00').getTime();
    expect(() => trackInteraction(INTERACTION.APP_OPEN, {}, now, store)).not.toThrow();
    expect(uniqueDailyInteractions(now, store)).toBe(1);
  });

  it('resetEngagementLedger wipes the local ledger', () => {
    const now = new Date('2026-06-06T10:00:00').getTime();
    recordLocalInteraction(INTERACTION.APP_OPEN, {}, now, store);
    expect(uniqueDailyInteractions(now, store)).toBe(1);
    resetEngagementLedger(store);
    expect(uniqueDailyInteractions(now, store)).toBe(0);
  });
});
