// Telegram Bot API integration (outbound, browser-side).
//
// SECURITY: a Telegram bot TOKEN grants full control of the bot. In this static frontend it
// is entered by the user at runtime and kept in browser/Drive storage only — it is NEVER
// committed to the repo. For a shared/production deployment, move the token to the bot
// server (server/telegram-bot.mjs) instead of the browser.
//
// SCOPE: this module is everything the browser can do directly — validate the token, send
// (loud/silent) messages to one or many chats, detect chat IDs, and configure the bot's
// persistent command menu. Receiving commands / controlling the app FROM Telegram needs a
// webhook server (see server/telegram-bot.mjs); the menu set here will *appear* in Telegram
// but tapping its buttons only does something once that server is running.

const api = (token, method) => `https://api.telegram.org/bot${token}/${method}`;

// Parse a "/remind HH:MM <text>" style command (also accepts the "⏰ یادآوری HH:MM <text>"
// menu label). Pure + shared with the bot server. Returns { time:"HH:MM", text } or null.
export function parseReminderCommand(input) {
  const s = String(input || '').replace(/^\/remind\b/i, '').replace(/^⏰\s*یادآوری/i, '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})\s+(.+)$/);
  if (!m) return null;
  const h = Number(m[1]), mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return { time: `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, text: m[3].trim() };
}

// Notification categories the app can push. Each is independently enable/disable-able and
// can be loud or silent (Telegram's disable_notification) per the user's settings.
export const TELEGRAM_NOTIFICATION_TYPES = [
  { key: 'session_complete', label: 'پایان جلسهٔ تمرین/حفظ' },
  { key: 'exam_result',      label: 'نتیجهٔ آزمون' },
  { key: 'critical_error',   label: 'خطاهای بحرانی برنامه' },
  { key: 'drive_sync',       label: 'وضعیت همگام‌سازی گوگل‌درایو' },
  { key: 'reminder',         label: 'یادآوری‌ها' },
  { key: 'daily_summary',    label: 'خلاصهٔ روزانه' },
  { key: 'new_login',        label: 'ورود جدید به حساب' },
];

// Persistent command menu (the "/" menu in Telegram). Acting on these requires the webhook server.
export const TELEGRAM_BOT_COMMANDS = [
  { command: 'start',    description: 'شروع و راهنما' },
  { command: 'status',   description: 'وضعیت فعلی برنامه' },
  { command: 'progress', description: 'پیشرفت حفظ' },
  { command: 'today',    description: 'خلاصهٔ امروز' },
  { command: 'remind',   description: 'تنظیم یادآوری' },
  { command: 'settings', description: 'تنظیمات اعلان‌ها' },
  { command: 'help',     description: 'راهنما' },
];

// Default per-type notification config used when none is saved yet.
export const DEFAULT_TELEGRAM = {
  enabled: false,
  botToken: '',
  primaryChatId: '',
  tzOffsetMinutes: null, // minutes to ADD to UTC for the user's local time (filled by the app)
  dailySummaryTime: '',  // "HH:MM" local; when set + daily_summary enabled, the bot sends a daily report
  devices: [],     // [{ id, label, chatId, enabled }]
  reminders: [],   // [{ id, time:"HH:MM", text, enabled }]
  notifications: {
    session_complete: { enabled: true, silent: false },
    exam_result:      { enabled: true, silent: false },
    critical_error:   { enabled: true, silent: false },
    drive_sync:       { enabled: false, silent: true },
    reminder:         { enabled: true, silent: false },
    daily_summary:    { enabled: false, silent: true },
    new_login:        { enabled: false, silent: true },
  },
};

// Build the {type, text} for a finished practice/exam session (pure; shared with App + tested).
export function buildSessionEndMessage(session) {
  const s = session || {};
  const correct = (s.correctItems && s.correctItems.length) || 0;
  const wrong = (s.wrongItems && s.wrongItems.length) || 0;
  const graded = correct + wrong;
  const pct = graded ? Math.round((correct / graded) * 100) : 0;
  const isExam = /exam|mcq_exam/.test(s.mode || '') || /exam/.test(s.examType || '');
  const type = isExam ? 'exam_result' : 'session_complete';
  const title = isExam ? '📝 <b>نتیجهٔ آزمون</b>' : '✅ <b>پایان جلسهٔ تمرین</b>';
  const text = `${title}\n`
    + `• درست: ${correct}\n• غلط: ${wrong}\n`
    + (graded ? `• دقت: ${pct}%\n` : '')
    + `• تعداد: ${s.size ?? graded}\n`
    + `• زمان: ${new Date(s.end || Date.now()).toLocaleString('fa-IR')}`;
  return { type, text };
}

async function tgCall(token, method, params) {
  if (!token) throw new Error('توکن بات تلگرام تنظیم نشده است.');
  const res = await fetch(api(token, method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {}),
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON error body */ }
  if (!data || !data.ok) {
    const desc = (data && data.description) || `HTTP ${res.status}`;
    const err = new Error(desc); err.telegram = data; throw err;
  }
  return data.result;
}

// Validate a token / fetch the bot's identity.
export const getMe = (token) => tgCall(token, 'getMe');

// Long-poll updates from a given offset (used by the in-app responder when no webhook server
// is running). NOTE: getUpdates and a webhook are mutually exclusive — if the bot server has
// set a webhook, this returns a 409 and the in-app responder backs off.
export const getUpdates = (token, offset, timeout = 0) =>
  tgCall(token, 'getUpdates', { offset, timeout, allowed_updates: ['message'] });

// Persistent bottom reply keyboard ("fixed menu"). It appears once a message is sent with it.
// The buttons send their label text back to the bot; acting on a tap needs the webhook server.
export const TELEGRAM_REPLY_KEYBOARD = {
  keyboard: [
    [{ text: '📊 وضعیت' }, { text: '📈 پیشرفت' }],
    [{ text: '🗓 امروز' }, { text: '⏰ یادآوری' }],
    [{ text: '⚙️ تنظیمات' }, { text: '❓ راهنما' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

// Send one message. silent=true => no notification sound; replyMarkup => attach a keyboard.
export const sendMessage = (token, chatId, text, { silent = false, replyMarkup } = {}) =>
  tgCall(token, 'sendMessage', {
    chat_id: chatId, text, parse_mode: 'HTML', disable_notification: !!silent,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });

// Detect chats that have messaged the bot, so the user can pick their chat id.
export async function detectChatIds(token) {
  const updates = await tgCall(token, 'getUpdates', { limit: 50 });
  const seen = new Map();
  for (const u of updates || []) {
    const chat = (u.message && u.message.chat) || (u.edited_message && u.edited_message.chat);
    if (chat && !seen.has(chat.id)) {
      const title = chat.title
        || [chat.first_name, chat.last_name].filter(Boolean).join(' ')
        || chat.username || String(chat.id);
      seen.set(chat.id, { id: String(chat.id), title });
    }
  }
  return [...seen.values()];
}

// Configure the bot's persistent command menu + the menu button.
export async function setupBotMenu(token, commands = TELEGRAM_BOT_COMMANDS) {
  await tgCall(token, 'setMyCommands', { commands });
  await tgCall(token, 'setChatMenuButton', { menu_button: { type: 'commands' } });
  return true;
}

// All chat ids to notify: primary + enabled devices (deduped).
export function resolveRecipients(tg) {
  const ids = [];
  if (tg && tg.primaryChatId) ids.push(String(tg.primaryChatId));
  for (const d of (tg && tg.devices) || []) {
    if (d && d.chatId && d.enabled !== false) ids.push(String(d.chatId));
  }
  return [...new Set(ids)];
}

// Should a notification of this type be sent right now?
export function shouldNotify(tg, type) {
  if (!tg || !tg.enabled || !tg.botToken) return false;
  const t = tg.notifications && tg.notifications[type];
  if (t && t.enabled === false) return false;
  return resolveRecipients(tg).length > 0;
}

// Send a typed notification to every recipient, honoring the per-type silent flag.
export async function notify(tg, type, text) {
  if (!shouldNotify(tg, type)) return { sent: 0, skipped: true };
  const silent = !!(tg.notifications && tg.notifications[type] && tg.notifications[type].silent);
  const recipients = resolveRecipients(tg);
  const results = await Promise.allSettled(
    recipients.map((id) => sendMessage(tg.botToken, id, text, { silent })),
  );
  return { sent: results.filter((r) => r.status === 'fulfilled').length, total: recipients.length };
}
