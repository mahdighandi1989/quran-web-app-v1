import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CRITICALITY,
  NOTIFICATION_CRITICALITY,
  getNotificationCriticality,
  isCriticalNotification,
  resolveSilent,
  notify,
  DEFAULT_TELEGRAM,
} from '../lib/telegram.js';

// ST2 — criticality-based silent flag policy (the resolved coherence bug): a critical notification
// can NEVER be silent, overriding both the per-type config and an explicit caller override.

const cfg = (over = {}) => ({
  ...DEFAULT_TELEGRAM,
  enabled: true,
  botToken: 'BOT',
  primaryChatId: '5',
  notifications: {
    ...DEFAULT_TELEGRAM.notifications,
    critical_error: { enabled: true, silent: true }, // user TRIES to silence the critical type
    daily_summary: { enabled: true, silent: true },  // enabled so it actually sends in the test
    ...(over.notifications || {}),
  },
  ...over,
});

describe('notification criticality classification', () => {
  it('classifies critical_error as critical and routine types as routine', () => {
    expect(getNotificationCriticality('critical_error')).toBe(CRITICALITY.CRITICAL);
    expect(getNotificationCriticality('daily_summary')).toBe(CRITICALITY.ROUTINE);
    expect(getNotificationCriticality('session_complete')).toBe(CRITICALITY.IMPORTANT);
    expect(isCriticalNotification('critical_error')).toBe(true);
    expect(isCriticalNotification('reminder')).toBe(false);
  });

  it('defaults unknown types to routine (fail-safe: never accidentally critical)', () => {
    expect(getNotificationCriticality('totally_new_type')).toBe(CRITICALITY.ROUTINE);
    expect(isCriticalNotification('totally_new_type')).toBe(false);
  });

  it('classification map covers every shipped notification type', () => {
    for (const t of DEFAULT_TELEGRAM.notifications ? Object.keys(DEFAULT_TELEGRAM.notifications) : []) {
      expect(NOTIFICATION_CRITICALITY[t]).toBeTruthy();
    }
  });
});

describe('resolveSilent (ground-truth precedence)', () => {
  it('forces critical types loud regardless of config or override', () => {
    const c = cfg();
    expect(resolveSilent(c, 'critical_error')).toBe(false);
    expect(resolveSilent(c, 'critical_error', true)).toBe(false);
  });

  it('honours config default then explicit override for non-critical types', () => {
    const c = cfg();
    expect(resolveSilent(c, 'daily_summary')).toBe(true);   // config default silent
    expect(resolveSilent(c, 'reminder')).toBe(false);       // config default loud
    expect(resolveSilent(c, 'reminder', true)).toBe(true);  // override wins
    expect(resolveSilent(c, 'daily_summary', false)).toBe(false);
  });
});

describe('notify() enforces the silent policy at the send boundary', () => {
  let fetchMock;
  beforeEach(() => {
    vi.restoreAllMocks();
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, result: {} }) });
    vi.stubGlobal('fetch', fetchMock);
  });

  it('a critical_error is sent loud even though config + override ask for silent', async () => {
    await notify(cfg(), 'critical_error', '🚨', { silent: true });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.disable_notification).toBe(false);
  });

  it('a routine notification respects the per-type silent config', async () => {
    await notify(cfg(), 'daily_summary', 'hi');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.disable_notification).toBe(true);
  });
});
