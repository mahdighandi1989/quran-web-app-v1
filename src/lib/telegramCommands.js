// In-app Telegram command responder. While the app is open and Telegram is enabled, this
// long-polls getUpdates and answers /status, /progress, /today, /remind, /settings, /help —
// so the bot's commands and bottom menu work WITHOUT deploying the server (best-effort).
//
// It only handles updates from the user's own chat ids (primary + devices). It is mutually
// exclusive with a webhook: if the bot server has set a webhook, getUpdates returns 409 and we
// stop (the server then handles everything instead).
import { getUpdates, sendMessage, TELEGRAM_REPLY_KEYBOARD, parseReminderCommand } from './telegram.js';

const uid = () => Math.random().toString(36).slice(2, 10);

function fmtStatus(st) {
  if (!st) return 'هنوز داده‌ای ثبت نشده. کمی در برنامه فعالیت کنید.';
  return '📊 <b>وضعیت برنامه</b>\n'
    + `• آیات دیتاست: ${st.dataset?.ayahs ?? 0}\n`
    + `• صفحات: ${st.pages ?? 0}\n`
    + `• نشان‌شده: ${st.flagged ?? 0}\n`
    + `• کل جلسات: ${st.sessions?.total ?? 0}`;
}
function fmtProgress(st) {
  const s = st && st.sessions;
  if (!s) return 'هنوز پیشرفتی ثبت نشده.';
  return '📈 <b>پیشرفت حفظ</b>\n'
    + `• دقت کلی: ${s.accuracyPct ?? 0}%\n`
    + `• درست/غلط: ${s.totalCorrect ?? 0} / ${s.totalWrong ?? 0}\n`
    + `• جلسات ۷ روز اخیر: ${s.last7Days ?? 0}`;
}
function fmtToday(st) {
  const t = st && st.sessions && st.sessions.today;
  if (!t) return '🗓 امروز هنوز جلسه‌ای ثبت نشده.';
  return `🗓 <b>خلاصهٔ امروز</b>\n• جلسات: ${t.sessions}\n• درست: ${t.correct}\n• غلط: ${t.wrong}`;
}

// Decide the reply for one text message. Pure (no I/O) so it can be unit-tested.
// Returns { text } or { text, addReminder:{time,text} } or null (ignore).
export function buildCommandReply(text, { appState } = {}) {
  const t = String(text || '').trim();
  if (!t) return null;
  const is = (cmd, label) => t === cmd || t.startsWith(cmd + ' ') || t === label;

  if (is('/start')) return { text: 'به بات «مرکز حفظ قرآن» خوش آمدید 👋\nاز منوی پایین استفاده کنید.', menu: true };
  if (is('/help', '❓ راهنما')) return { text: 'دستورها:\n/status وضعیت\n/progress پیشرفت\n/today امروز\n/remind <code>HH:MM متن</code>\n/settings تنظیمات', menu: true };
  if (is('/status', '📊 وضعیت')) return { text: fmtStatus(appState), menu: true };
  if (is('/progress', '📈 پیشرفت')) return { text: fmtProgress(appState), menu: true };
  if (is('/today', '🗓 امروز')) return { text: fmtToday(appState), menu: true };
  if (is('/settings', '⚙️ تنظیمات')) return { text: '⚙️ مدیریت اعلان‌ها از تب تلگرام در برنامه انجام می‌شود.', menu: true };
  if (is('/remind', '⏰ یادآوری')) {
    const parsed = parseReminderCommand(t);
    if (!parsed) return { text: 'قالب درست: <code>/remind 08:00 صبح‌گاهی را بخوان</code>', menu: true };
    return { text: `✅ یادآوری ثبت شد: ساعت ${parsed.time} — ${parsed.text}`, menu: true, addReminder: parsed };
  }
  return { text: 'دستور ناشناخته. /help', menu: true };
}

// Start the responder. getConfig()/getAppState() return the latest values; onAddReminder(r)
// persists a reminder created via /remind. Returns a stop() function.
export function startTelegramResponder({ getConfig, getAppState, onAddReminder, onWebhookConflict }) {
  let stopped = false;
  let offset = undefined;
  let timer = null;

  const ownChatIds = (cfg) => {
    const ids = new Set();
    if (cfg && cfg.primaryChatId) ids.add(String(cfg.primaryChatId));
    for (const d of (cfg && cfg.devices) || []) if (d && d.chatId) ids.add(String(d.chatId));
    return ids;
  };

  async function tick() {
    if (stopped) return;
    const cfg = getConfig();
    if (!cfg || !cfg.enabled || !cfg.botToken) { schedule(4000); return; }
    try {
      const updates = await getUpdates(cfg.botToken, offset, 0);
      for (const u of updates || []) {
        offset = u.update_id + 1;
        const msg = u.message;
        if (!msg || !msg.text) continue;
        const chatId = String(msg.chat.id);
        if (!ownChatIds(cfg).has(chatId)) continue; // only respond to the owner's chats
        const reply = buildCommandReply(msg.text, { appState: getAppState() });
        if (!reply) continue;
        if (reply.addReminder && onAddReminder) {
          try { onAddReminder({ id: uid(), enabled: true, ...reply.addReminder }); } catch {}
        }
        await sendMessage(cfg.botToken, chatId, reply.text,
          reply.menu ? { replyMarkup: TELEGRAM_REPLY_KEYBOARD } : {}).catch(() => {});
      }
      schedule(1500);
    } catch (e) {
      // 409 = a webhook is set (the server owns updates). Back off and let the server handle it.
      const conflict = e && /409|conflict|webhook/i.test(e.message || '');
      if (conflict && onWebhookConflict) onWebhookConflict();
      schedule(conflict ? 60000 : 8000);
    }
  }
  function schedule(ms) { if (!stopped) timer = setTimeout(tick, ms); }

  tick();
  return function stop() { stopped = true; if (timer) clearTimeout(timer); };
}
