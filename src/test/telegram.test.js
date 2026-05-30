import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getMe, sendMessage, notify, shouldNotify, resolveRecipients, parseReminderCommand,
  buildSessionEndMessage, TELEGRAM_NOTIFICATION_TYPES, DEFAULT_TELEGRAM,
} from '../lib/telegram.js';

function mockFetch(result, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 400,
    json: async () => ({ ok, result, description: ok ? undefined : 'Bad Request' }),
  });
}

describe('telegram service (outbound)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('getMe posts to the bot API and returns the result', async () => {
    const f = mockFetch({ id: 1, username: 'QuranApp2026_bot', first_name: 'Quran' });
    vi.stubGlobal('fetch', f);
    const me = await getMe('TOKEN');
    expect(me.username).toBe('QuranApp2026_bot');
    expect(f.mock.calls[0][0]).toContain('https://api.telegram.org/botTOKEN/getMe');
  });

  it('sendMessage sets disable_notification when silent', async () => {
    const f = mockFetch({ message_id: 1 });
    vi.stubGlobal('fetch', f);
    await sendMessage('T', '123', 'hi', { silent: true });
    const body = JSON.parse(f.mock.calls[0][1].body);
    expect(body).toMatchObject({ chat_id: '123', text: 'hi', disable_notification: true });
  });

  it('throws a descriptive error when the API returns ok:false', async () => {
    vi.stubGlobal('fetch', mockFetch(null, false));
    await expect(getMe('T')).rejects.toThrow(/Bad Request/);
  });

  it('throws when no token is provided', async () => {
    await expect(getMe('')).rejects.toThrow();
  });

  it('resolveRecipients includes primary + enabled devices, deduped', () => {
    const tg = {
      primaryChatId: '1',
      devices: [{ chatId: '2', enabled: true }, { chatId: '3', enabled: false }, { chatId: '1', enabled: true }],
    };
    expect(resolveRecipients(tg)).toEqual(['1', '2']);
  });

  it('shouldNotify respects master enable, type enable, token and recipients', () => {
    const base = { enabled: true, botToken: 'T', primaryChatId: '1', notifications: { reminder: { enabled: true } } };
    expect(shouldNotify(base, 'reminder')).toBe(true);
    expect(shouldNotify({ ...base, enabled: false }, 'reminder')).toBe(false);
    expect(shouldNotify({ ...base, botToken: '' }, 'reminder')).toBe(false);
    expect(shouldNotify({ ...base, primaryChatId: '', devices: [] }, 'reminder')).toBe(false);
    expect(shouldNotify({ ...base, notifications: { reminder: { enabled: false } } }, 'reminder')).toBe(false);
  });

  it('notify sends to all recipients and reports counts', async () => {
    const f = mockFetch({ message_id: 1 });
    vi.stubGlobal('fetch', f);
    const tg = {
      enabled: true, botToken: 'T', primaryChatId: '1',
      devices: [{ chatId: '2', enabled: true }],
      notifications: { reminder: { enabled: true, silent: false } },
    };
    const r = await notify(tg, 'reminder', 'hello');
    expect(r).toMatchObject({ sent: 2, total: 2 });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('notify skips (no send) when integration is disabled', async () => {
    const f = mockFetch({});
    vi.stubGlobal('fetch', f);
    const r = await notify({ enabled: false }, 'reminder', 'x');
    expect(r.skipped).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });

  it('exposes the notification-type registry and default config', () => {
    expect(TELEGRAM_NOTIFICATION_TYPES.length).toBeGreaterThanOrEqual(5);
    expect(DEFAULT_TELEGRAM.notifications).toHaveProperty('reminder');
    expect(DEFAULT_TELEGRAM.enabled).toBe(false);
  });
});

describe('buildSessionEndMessage', () => {
  it('classifies a practice session and reports accuracy', () => {
    const r = buildSessionEndMessage({ mode: 'practiceWrong', size: 3, correctItems: [1, 2], wrongItems: [1], end: 0 });
    expect(r.type).toBe('session_complete');
    expect(r.text).toContain('پایان جلسهٔ تمرین');
    expect(r.text).toContain('دقت: 67%'); // 2/3
  });
  it('classifies an exam session as exam_result', () => {
    expect(buildSessionEndMessage({ mode: 'exam' }).type).toBe('exam_result');
    expect(buildSessionEndMessage({ examType: 'mcq_exam' }).type).toBe('exam_result');
    expect(buildSessionEndMessage({ mode: 'exam' }).text).toContain('نتیجهٔ آزمون');
  });
  it('omits accuracy when nothing was graded', () => {
    const r = buildSessionEndMessage({ mode: 'practice' });
    expect(r.text).not.toContain('دقت:');
  });
});

describe('parseReminderCommand', () => {
  it('parses "/remind HH:MM text"', () => {
    expect(parseReminderCommand('/remind 08:00 صبح بخوان')).toEqual({ time: '08:00', text: 'صبح بخوان' });
  });
  it('accepts the "⏰ یادآوری HH:MM text" menu label and pads the hour', () => {
    expect(parseReminderCommand('⏰ یادآوری 9:05 مرور')).toEqual({ time: '09:05', text: 'مرور' });
  });
  it('rejects invalid time or missing text', () => {
    expect(parseReminderCommand('/remind 25:00 x')).toBeNull();
    expect(parseReminderCommand('/remind 08:99 x')).toBeNull();
    expect(parseReminderCommand('/remind 08:00')).toBeNull();
    expect(parseReminderCommand('hello')).toBeNull();
    expect(parseReminderCommand('')).toBeNull();
  });
});
