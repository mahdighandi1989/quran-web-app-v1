import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// COHERENCE regression guard for the proactive notification pipeline.
//
// The bug this protects against: the "event -> notify_event" rules (daily-summary wording, the
// local day-key/tz math, and the per-time reminder text) run in TWO tiers that must behave
// identically — the in-app scheduler (src/lib/notificationScheduler.js) and the 24/7 server
// (server/telegram-bot.mjs::reminderTick). When each tier kept its own hand-synced copy, a change
// to one silently drifted from the other and the same user got two different messages depending
// on which tier fired. Per-tier unit tests never caught it because they run in silos.
//
// The fix made src/lib/notificationRules.js the single ground truth and pointed both tiers at it.
// These tests assert that wiring stays intact, so a future re-introduction of a divergent copy
// fails CI here.

import * as rules from '../lib/notificationRules.js';
import {
  localHHMMAndDay as schedLocalHHMMAndDay,
  buildDailySummaryText as schedBuildDailySummaryText,
  buildGoalReachedText as schedBuildGoalReachedText,
  buildReminderText as schedBuildReminderText,
} from '../lib/notificationScheduler.js';

// vitest runs from the repo root, so resolve the server entry from cwd (import.meta.url is not a
// file:// URL under the jsdom environment).
const serverSrc = readFileSync(resolve(process.cwd(), 'server/telegram-bot.mjs'), 'utf8');

describe('notification rules: shared ground truth is the single source', () => {
  it('the in-app scheduler re-exports the SAME function objects as the rules module (no copy)', () => {
    expect(schedLocalHHMMAndDay).toBe(rules.localHHMMAndDay);
    expect(schedBuildDailySummaryText).toBe(rules.buildDailySummaryText);
    expect(schedBuildGoalReachedText).toBe(rules.buildGoalReachedText);
    expect(schedBuildReminderText).toBe(rules.buildReminderText);
  });

  it('the server imports its proactive helpers from the shared rules module', () => {
    expect(serverSrc).toMatch(/from '\.\.\/src\/lib\/notificationRules\.js'/);
    expect(serverSrc).toContain('buildDailySummaryText');
    expect(serverSrc).toContain('buildReminderText');
    expect(serverSrc).toContain('localHHMMAndDayAt');
  });

  it('the server no longer defines its OWN copies of the shared helpers (drift impossible)', () => {
    // A redefinition would shadow the import and re-open the coherence gap.
    expect(serverSrc).not.toMatch(/function\s+buildDailySummaryText\s*\(/);
    // The server keeps a thin localHHMMAndDay() wrapper, but it must DELEGATE to the shared
    // localHHMMAndDayAt rather than re-implement the date math.
    expect(serverSrc).toContain('localHHMMAndDayAt(Date.now()');
    expect(serverSrc).not.toMatch(/text:\s*`⏰ یادآوری: \$\{r\.text\}`/);
  });
});

describe('notification rules: pure outputs (the text both tiers send)', () => {
  it('daily summary text is identical for the same app-state on both tiers', () => {
    const appState = { sessions: { today: { sessions: 3, correct: 9, wrong: 1 }, accuracyPct: 90, last7Days: 12 } };
    const text = rules.buildDailySummaryText(appState);
    expect(text).toContain('🌅 <b>خلاصهٔ روزانه</b>');
    expect(text).toContain('امروز: 3 جلسه • 9 درست / 1 غلط');
    expect(text).toContain('دقت کلی: 90%');
    // The server path produces this via the very same imported function.
    expect(schedBuildDailySummaryText(appState)).toBe(text);
  });

  it('daily summary degrades gracefully when there is no data', () => {
    expect(rules.buildDailySummaryText(null)).toContain('هنوز داده‌ای ثبت نشده');
    expect(rules.buildDailySummaryText({ sessions: { accuracyPct: 0, last7Days: 0 } }))
      .toContain('امروز هنوز جلسه‌ای ثبت نشده');
  });

  it('reminder text format is the single shared format', () => {
    expect(rules.buildReminderText('بخوان')).toBe('⏰ یادآوری: بخوان');
  });

  it('local HH:MM + day key honor the tz offset and are pure (same input -> same output)', () => {
    const noon = Date.UTC(2026, 0, 15, 12, 0, 0);
    expect(rules.localHHMMAndDay(noon, 0)).toEqual({ hhmm: '12:00', day: '2026-01-15' });
    // +210 min (Tehran) pushes 12:00 UTC to 15:30 local, same day.
    expect(rules.localHHMMAndDay(noon, 210)).toEqual({ hhmm: '15:30', day: '2026-01-15' });
    // A negative offset can roll the day back.
    expect(rules.localHHMMAndDay(Date.UTC(2026, 0, 15, 0, 30), -60))
      .toEqual({ hhmm: '23:30', day: '2026-01-14' });
    // Non-finite offset falls back to 0 (no crash).
    expect(rules.localHHMMAndDay(noon, undefined)).toEqual({ hhmm: '12:00', day: '2026-01-15' });
  });

  it('goal-reached text reports the achieved count and the goal', () => {
    expect(rules.buildGoalReachedText(12, 10)).toContain('🎯 <b>هدف امروز محقق شد!</b>');
    expect(rules.buildGoalReachedText(12, 10)).toContain('امروز 12 مورد تمرین کردی (هدف: 10)');
  });
});
