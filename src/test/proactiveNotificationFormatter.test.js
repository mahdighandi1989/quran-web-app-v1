import { describe, it, expect } from 'vitest';
import {
  buildProactiveCaption,
  proactiveType,
  formatProactiveNotification,
  PROACTIVE_KINDS,
} from '../lib/proactiveNotificationFormatter.js';
import {
  buildGoalReachedText,
  buildReminderText,
  buildDailySummaryText,
} from '../lib/notificationRules.js';

// ST5 — dedicated caption generation for proactive notifications. The formatter is the single owner
// of proactive message content and delegates wording to the shared rules so the in-app + server
// tiers emit identical captions.

const appState = {
  sessions: { total: 12, last7Days: 6, accuracyPct: 91, today: { sessions: 4, correct: 30, wrong: 3 } },
};

describe('buildProactiveCaption', () => {
  it('builds a context-aware daily summary caption', () => {
    const cap = buildProactiveCaption({ kind: 'daily_summary', appState });
    expect(cap).toContain('خلاصهٔ روزانه');
    expect(cap).toContain('4 جلسه');
    expect(cap).toContain('30 درست / 3 غلط');
    expect(cap).toContain('91%');
    expect(cap).toBe(buildDailySummaryText(appState)); // delegates to the shared rule
  });

  it('builds goal-reached and reminder captions identical to the shared rules', () => {
    expect(buildProactiveCaption({ kind: 'daily_goal', doneToday: 33, dailyGoal: 30 }))
      .toBe(buildGoalReachedText(33, 30));
    expect(buildProactiveCaption({ kind: 'reminder', reminderText: 'مرور صفحهٔ ۵' }))
      .toBe(buildReminderText('مرور صفحهٔ ۵'));
  });

  it('builds a session-complete caption from the shared session-end builder', () => {
    const session = { mode: 'train', correctItems: [1, 2, 3], wrongItems: [4], size: 4, end: 0 };
    const cap = buildProactiveCaption({ kind: 'session_complete', session });
    expect(cap).toContain('پایان جلسهٔ تمرین');
    expect(cap).toContain('درست: 3');
  });

  it('returns an empty caption for unknown/empty events (never throws)', () => {
    expect(buildProactiveCaption({})).toBe('');
    expect(buildProactiveCaption({ kind: 'nope' })).toBe('');
    expect(buildProactiveCaption(null)).toBe('');
  });
});

describe('proactiveType / formatProactiveNotification', () => {
  it('maps kinds to the correct telegram notification type', () => {
    expect(proactiveType({ kind: 'reminder' })).toBe('reminder');
    expect(proactiveType({ kind: 'daily_summary' })).toBe('daily_summary');
    expect(proactiveType({ kind: 'daily_goal' })).toBe('daily_summary');
    expect(proactiveType({ kind: 'session_complete', session: { mode: 'exam', correctItems: [], wrongItems: [] } }))
      .toBe('exam_result');
  });

  it('formatProactiveNotification returns type + caption + criticality together', () => {
    const r = formatProactiveNotification({ kind: 'reminder', reminderText: 'x' });
    expect(r).toMatchObject({ kind: 'reminder', type: 'reminder', criticality: 'important' });
    expect(r.text).toBe('⏰ یادآوری: x');
  });

  it('exposes the known proactive kinds', () => {
    expect(PROACTIVE_KINDS).toEqual(['session_complete', 'daily_goal', 'reminder', 'daily_summary']);
  });
});
