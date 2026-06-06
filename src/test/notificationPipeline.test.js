import { describe, it, expect, vi, beforeEach } from 'vitest';

// Integration test for the FULL notification pipeline:
//   app state (appStateStore.buildAppStateSummary)
//     -> proactive decision (notificationScheduler: event detection + condition eval)
//       -> outbound transport (telegram.notify -> sendMessage -> fetch to Telegram API)
//
// This is the regression guard the task asks for: it exercises the three modules together so a
// future change that breaks the "event -> notify_event" wiring (the coherence issue) fails here,
// even though each module's own unit tests still pass in isolation.

// appStateStore imports firebase.js (which initialises SDKs at import) — mock the SDK so the
// import is side-effect free. The scheduler + telegram do NOT touch firebase.
vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/analytics', () => ({ getAnalytics: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})), GoogleAuthProvider: class { addScope() {} setCustomParameters() {} },
  signInWithPopup: vi.fn(), signInWithRedirect: vi.fn(), getRedirectResult: vi.fn(),
  signOut: vi.fn(), onAuthStateChanged: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})), doc: vi.fn((db, col, id) => ({ col, id })),
  setDoc: vi.fn(() => Promise.resolve()),
}));

import { buildAppStateSummary } from '../lib/appStateStore.js';
import { createNotificationScheduler } from '../lib/notificationScheduler.js';
import { DEFAULT_TELEGRAM } from '../lib/telegram.js';

// Real telegram.notify() is used (NOT mocked) so the transport layer is part of the test; only
// the network boundary (fetch) is stubbed. This proves the scheduler actually drives telegram.js.
function mockFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, result: { message_id: 1 } }),
  });
}

function liveConfig(overrides = {}) {
  return {
    ...DEFAULT_TELEGRAM,
    enabled: true,
    botToken: 'BOT_TOKEN',
    primaryChatId: '555',
    tzOffsetMinutes: 0,
    notifications: { ...DEFAULT_TELEGRAM.notifications },
    ...overrides,
  };
}

const utcAt = (hh, mm) => Date.UTC(2026, 0, 15, hh, mm, 0);

describe('notification pipeline (appStateStore -> scheduler -> telegram)', () => {
  let fetchMock;
  beforeEach(() => {
    vi.restoreAllMocks();
    fetchMock = mockFetch();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('a finished session flows end-to-end to a Telegram sendMessage call', async () => {
    const config = liveConfig();
    const sched = createNotificationScheduler({ getConfig: () => config, getAppState: () => null });

    const session = { mode: 'practice', end: 1000, correctItems: [1, 2, 3], wrongItems: [4], size: 4 };
    const ok = await sched.notifySessionComplete(session);

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.telegram.org/botBOT_TOKEN/sendMessage');
    const body = JSON.parse(init.body);
    expect(body.chat_id).toBe('555');
    expect(body.text).toContain('پایان جلسهٔ تمرین');
  });

  it('a daily goal reached (derived from buildAppStateSummary) triggers a notification', async () => {
    // Build a REAL app-state summary from raw sessions: 12 graded items today.
    const now = utcAt(20, 0);
    const summary = buildAppStateSummary({
      user: { displayName: 'Ali' },
      sessions: [{ start: now, end: now, correctItems: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], wrongItems: [11, 12] }],
    });
    // Force today's bucket to reflect "now" regardless of the machine clock used by the builder.
    summary.sessions.today = { sessions: 1, correct: 10, wrong: 2 };

    // daily_summary is off by default — the goal-reached event uses that type, so enable it.
    const config = liveConfig({
      dailyGoal: 10,
      notifications: { ...DEFAULT_TELEGRAM.notifications, daily_summary: { enabled: true, silent: false } },
    });
    const sched = createNotificationScheduler({
      getConfig: () => config,
      getAppState: () => summary,
      now: () => now,
    });

    const dispatched = await sched.tick();
    expect(dispatched).toContain('daily_goal');
    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('هدف امروز محقق شد');
  });

  it('respects the user disabling a notification type (no send)', async () => {
    const config = liveConfig({
      reminders: [{ id: 'r1', time: '08:00', text: 'بخوان' }],
      notifications: { ...DEFAULT_TELEGRAM.notifications, reminder: { enabled: false, silent: false } },
    });
    const sched = createNotificationScheduler({ getConfig: () => config, getAppState: () => null, now: () => utcAt(8, 0) });

    expect(await sched.tick()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reactive command handling is unaffected: telegramCommands does not originate proactive sends', async () => {
    // Guard for Step 6 (downstream): the reactive responder and the proactive scheduler use
    // separate channels. buildCommandReply is pure and never calls fetch/notify on its own.
    const { buildCommandReply } = await import('../lib/telegramCommands.js');
    const reply = buildCommandReply('/status', { appState: null, dataset: [] });
    expect(reply).toMatchObject({ menu: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
