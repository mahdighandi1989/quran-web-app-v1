import { describe, it, expect, vi, beforeEach } from 'vitest';

// firebase.js initialises SDKs at import — telegram.js imports nothing from firebase, but
// notificationScheduler.js imports telegram.js only (pure). No firebase mock needed here.
import {
  localHHMMAndDay,
  buildDailySummaryText,
  buildGoalReachedText,
  detectSessionComplete,
  detectDailyGoalReached,
  detectDueReminders,
  detectDailySummaryDue,
  collectDueEvents,
  createNotificationScheduler,
} from '../lib/notificationScheduler.js';
import { DEFAULT_TELEGRAM } from '../lib/telegram.js';

// A ready-to-send config (enabled + token + a recipient) so shouldNotify() passes.
function liveConfig(overrides = {}) {
  return {
    ...DEFAULT_TELEGRAM,
    enabled: true,
    botToken: 'T',
    primaryChatId: '123',
    tzOffsetMinutes: 0,
    notifications: { ...DEFAULT_TELEGRAM.notifications },
    ...overrides,
  };
}

// A UTC instant for a given HH:MM on 2026-01-15 (tzOffset 0 keeps local == UTC).
function utcAt(hh, mm) {
  return Date.UTC(2026, 0, 15, hh, mm, 0);
}
const DAY_KEY = '2026-01-15';

describe('localHHMMAndDay', () => {
  it('formats local HH:MM and day from a UTC instant (offset 0)', () => {
    expect(localHHMMAndDay(utcAt(8, 5), 0)).toEqual({ hhmm: '08:05', day: '2026-01-15' });
  });
  it('applies the tz offset (minutes added to UTC) and can roll the day forward', () => {
    // 23:30 UTC + 60min => 00:30 the next day, local.
    expect(localHHMMAndDay(utcAt(23, 30), 60)).toEqual({ hhmm: '00:30', day: '2026-01-16' });
  });
  it('treats a non-finite offset as 0', () => {
    expect(localHHMMAndDay(utcAt(8, 5), null).hhmm).toBe('08:05');
  });
});

describe('message builders', () => {
  it('buildDailySummaryText handles missing state', () => {
    expect(buildDailySummaryText(null)).toContain('هنوز داده‌ای ثبت نشده');
  });
  it('buildDailySummaryText renders today + overall figures', () => {
    const txt = buildDailySummaryText({ sessions: { accuracyPct: 90, last7Days: 4, today: { sessions: 2, correct: 8, wrong: 1 } } });
    expect(txt).toContain('2 جلسه');
    expect(txt).toContain('90%');
  });
  it('buildGoalReachedText mentions the count and goal', () => {
    expect(buildGoalReachedText(30, 20)).toContain('30');
    expect(buildGoalReachedText(30, 20)).toContain('20');
  });
});

describe('detectSessionComplete', () => {
  it('returns a session_complete event for a practice session', () => {
    const ev = detectSessionComplete({ end: 1000, correctItems: [1, 2], wrongItems: [3] });
    expect(ev.kind).toBe('session_complete');
    expect(ev.type).toBe('session_complete');
    expect(ev.dedupKey).toBe('session:1000');
    expect(ev.text).toContain('پایان جلسهٔ تمرین');
  });
  it('returns exam_result for an exam session and dedups by id when present', () => {
    const ev = detectSessionComplete({ id: 'x9', mode: 'mcq_exam', correctItems: [1], wrongItems: [] });
    expect(ev.type).toBe('exam_result');
    expect(ev.dedupKey).toBe('session:x9');
  });
  it('returns null for a missing session', () => {
    expect(detectSessionComplete(null)).toBeNull();
  });
});

describe('detectDailyGoalReached', () => {
  const appState = (correct, wrong) => ({ sessions: { today: { correct, wrong } } });
  it('fires once the today graded count reaches the goal', () => {
    const ev = detectDailyGoalReached({ appState: appState(15, 5), dailyGoal: 20, day: DAY_KEY });
    expect(ev).not.toBeNull();
    expect(ev.type).toBe('daily_summary');
    expect(ev.dedupKey).toBe(`goal:${DAY_KEY}`);
  });
  it('does not fire below the goal', () => {
    expect(detectDailyGoalReached({ appState: appState(5, 5), dailyGoal: 20, day: DAY_KEY })).toBeNull();
  });
  it('does not fire without a goal or without today data', () => {
    expect(detectDailyGoalReached({ appState: appState(50, 0), dailyGoal: 0, day: DAY_KEY })).toBeNull();
    expect(detectDailyGoalReached({ appState: { sessions: {} }, dailyGoal: 10, day: DAY_KEY })).toBeNull();
  });
});

describe('detectDueReminders', () => {
  const cfg = (reminders) => ({ reminders });
  it('returns reminders whose time matches the current minute', () => {
    const out = detectDueReminders({ config: cfg([{ id: 'r1', time: '08:00', text: 'صبح' }]), hhmm: '08:00', day: DAY_KEY });
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('reminder');
    expect(out[0].text).toContain('صبح');
    expect(out[0].dedupKey).toBe(`reminder:r1:${DAY_KEY}`);
  });
  it('skips disabled reminders, the wrong minute, and ones already fired today', () => {
    const reminders = [
      { id: 'a', time: '08:00', text: 'x', enabled: false },
      { id: 'b', time: '09:00', text: 'y' },
      { id: 'c', time: '08:00', text: 'z', lastFiredDay: DAY_KEY },
    ];
    expect(detectDueReminders({ config: cfg(reminders), hhmm: '08:00', day: DAY_KEY })).toHaveLength(0);
  });
});

describe('detectDailySummaryDue', () => {
  it('fires at the configured time once per day', () => {
    const ev = detectDailySummaryDue({ config: { dailySummaryTime: '21:00' }, appState: null, hhmm: '21:00', day: DAY_KEY });
    expect(ev.kind).toBe('daily_summary');
    expect(ev.dedupKey).toBe(`summary:${DAY_KEY}`);
  });
  it('does not fire at the wrong time or when already sent today', () => {
    expect(detectDailySummaryDue({ config: { dailySummaryTime: '21:00' }, appState: null, hhmm: '20:00', day: DAY_KEY })).toBeNull();
    expect(detectDailySummaryDue({ config: { dailySummaryTime: '21:00', dailySummaryDay: DAY_KEY }, appState: null, hhmm: '21:00', day: DAY_KEY })).toBeNull();
  });
});

describe('collectDueEvents', () => {
  it('gathers reminder + daily-summary + goal events due at the instant', () => {
    const config = liveConfig({
      dailyGoal: 10,
      dailySummaryTime: '08:00',
      reminders: [{ id: 'r1', time: '08:00', text: 'بخوان' }],
    });
    const appState = { sessions: { today: { correct: 10, wrong: 0 } } };
    const events = collectDueEvents({ config, appState, nowMs: utcAt(8, 0) });
    const kinds = events.map((e) => e.kind).sort();
    expect(kinds).toEqual(['daily_goal', 'daily_summary', 'reminder']);
  });
  it('returns nothing when no rule is due', () => {
    const config = liveConfig({ reminders: [{ id: 'r1', time: '06:00', text: 'x' }] });
    expect(collectDueEvents({ config, appState: null, nowMs: utcAt(8, 0) })).toEqual([]);
  });
});

describe('createNotificationScheduler', () => {
  let notify;
  beforeEach(() => { notify = vi.fn().mockResolvedValue({ sent: 1 }); });

  it('tick dispatches a due reminder exactly once (in-memory dedup)', async () => {
    const config = liveConfig({ reminders: [{ id: 'r1', time: '08:00', text: 'بخوان' }] });
    const sched = createNotificationScheduler({
      getConfig: () => config,
      getAppState: () => null,
      notify,
      now: () => utcAt(8, 0),
    });
    const first = await sched.tick();
    const second = await sched.tick(); // same minute -> deduped
    expect(first).toEqual(['reminder']);
    expect(second).toEqual([]);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(config, 'reminder', expect.stringContaining('بخوان'));
  });

  it('tick is a no-op when telegram is disabled or unconfigured', async () => {
    const sched = createNotificationScheduler({
      getConfig: () => liveConfig({ enabled: false, reminders: [{ id: 'r1', time: '08:00', text: 'x' }] }),
      getAppState: () => null,
      notify,
      now: () => utcAt(8, 0),
    });
    expect(await sched.tick()).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
  });

  it('respects per-type enable flags (shouldNotify) — disabled type is skipped', async () => {
    const config = liveConfig({
      reminders: [{ id: 'r1', time: '08:00', text: 'x' }],
      notifications: { ...DEFAULT_TELEGRAM.notifications, reminder: { enabled: false, silent: false } },
    });
    const sched = createNotificationScheduler({ getConfig: () => config, getAppState: () => null, notify, now: () => utcAt(8, 0) });
    expect(await sched.tick()).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
  });

  it('notifySessionComplete sends once and dedups the same session', async () => {
    const config = liveConfig();
    const sched = createNotificationScheduler({ getConfig: () => config, getAppState: () => null, notify });
    const session = { end: 5000, correctItems: [1, 2, 3], wrongItems: [4] };
    expect(await sched.notifySessionComplete(session)).toBe(true);
    expect(await sched.notifySessionComplete(session)).toBe(false); // deduped
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(config, 'session_complete', expect.stringContaining('پایان جلسهٔ تمرین'));
  });

  it('calls onReminderFired for persistence when a reminder dispatches', async () => {
    const onReminderFired = vi.fn();
    const config = liveConfig({ reminders: [{ id: 'r7', time: '08:00', text: 'x' }] });
    const sched = createNotificationScheduler({
      getConfig: () => config, getAppState: () => null, notify, now: () => utcAt(8, 0), onReminderFired,
    });
    await sched.tick();
    expect(onReminderFired).toHaveBeenCalledWith('r7', DAY_KEY);
  });

  it('prunes stale (previous-day) dedup keys so a reminder can fire again next day', async () => {
    let nowMs = utcAt(8, 0);
    const config = liveConfig({ reminders: [{ id: 'r1', time: '08:00', text: 'x' }] });
    const sched = createNotificationScheduler({ getConfig: () => config, getAppState: () => null, notify, now: () => nowMs });
    await sched.tick();                       // day 1 -> fires
    nowMs = utcAt(8, 0) + 24 * 60 * 60 * 1000; // next day, same minute
    const day2 = await sched.tick();
    expect(day2).toEqual(['reminder']);
    expect(notify).toHaveBeenCalledTimes(2);
  });
});
