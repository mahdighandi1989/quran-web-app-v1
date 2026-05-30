// Telegram bot webhook server — enables TWO-WAY control (commands FROM Telegram).
//
// This is the backend the static frontend can't be: it holds the bot TOKEN securely (as an
// env var, never in the browser bundle) and receives Telegram updates via a webhook, so the
// persistent bottom menu and slash-commands actually DO something.
//
// Zero dependencies (Node 18+ built-in http + global fetch). Deploy it as its own small
// service (Render "Web Service", a VPS, Cloud Run, …), then point Telegram at it:
//
//   1) Set env: TELEGRAM_BOT_TOKEN=<from BotFather>, optional TELEGRAM_WEBHOOK_SECRET=<random>
//   2) Start:   node server/telegram-bot.mjs           (listens on $PORT, default 3001)
//   3) Register the webhook (once), replacing the URL with your deployed one:
//      curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR-HOST/webhook&secret_token=<SECRET>"
//
// To control/read REAL app state (sessions, progress, reminders), the bot and the web app
// must share a store. The app already uses Firebase — the clean path is Firestore: have the
// web app mirror its state to Firestore, and read/write it here (see server/README.md).
import http from 'node:http';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const PORT = Number(process.env.PORT || 3001);
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';

if (!TOKEN) console.warn('[telegram-bot] TELEGRAM_BOT_TOKEN is not set — replies will fail until you set it.');

const api = (method) => `https://api.telegram.org/bot${TOKEN}/${method}`;
async function call(method, params) {
  const res = await fetch(api(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return res.json();
}
const reply = (chatId, text, extra = {}) =>
  call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });

// Persistent bottom reply keyboard (the "fixed menu" at the bottom of the chat).
const MENU = {
  keyboard: [
    [{ text: '📊 وضعیت' }, { text: '📈 پیشرفت' }],
    [{ text: '🗓 امروز' }, { text: '⏰ یادآوری' }],
    [{ text: '⚙️ تنظیمات' }, { text: '❓ راهنما' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

// The slash-command menu (the "/" menu button). Safe to call on boot.
const COMMANDS = [
  { command: 'start', description: 'شروع و راهنما' },
  { command: 'status', description: 'وضعیت فعلی برنامه' },
  { command: 'progress', description: 'پیشرفت حفظ' },
  { command: 'today', description: 'خلاصهٔ امروز' },
  { command: 'remind', description: 'تنظیم یادآوری' },
  { command: 'settings', description: 'تنظیمات اعلان‌ها' },
  { command: 'help', description: 'راهنما' },
];

async function handleUpdate(update) {
  const msg = update.message || update.edited_message;
  if (!msg || !msg.text) return;
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  if (text === '/start') {
    return reply(chatId,
      'به بات «مرکز حفظ قرآن» خوش آمدید 👋\n' +
      `Chat ID شما: <code>${chatId}</code> — این را در تنظیمات تلگرامِ برنامه وارد کنید.\n` +
      'از منوی پایین استفاده کنید.', { reply_markup: MENU });
  }
  if (text === '/help' || text === '❓ راهنما') {
    return reply(chatId, 'دستورها: /status /progress /today /remind /settings\nمنوی پایین هم در دسترس است.', { reply_markup: MENU });
  }
  if (text === '/status' || text === '📊 وضعیت') {
    // TODO(app-state): read live data from your shared store (e.g. Firestore). See server/README.md.
    return reply(chatId, '📊 برای نمایش وضعیتِ واقعی، سرور را به Firestoreِ مشترک با برنامه وصل کنید (راهنما در server/README.md).');
  }
  if (text === '/progress' || text === '📈 پیشرفت') {
    return reply(chatId, '📈 پیشرفت حفظ — نیازمند اتصال به دادهٔ برنامه (Firestore).');
  }
  if (text === '/today' || text === '🗓 امروز') {
    return reply(chatId, '🗓 خلاصهٔ امروز — نیازمند اتصال به دادهٔ برنامه.');
  }
  if (text === '/remind' || text === '⏰ یادآوری') {
    return reply(chatId, '⏰ برای ثبت یادآوری، در آینده اینجا متن و زمان را دریافت و ذخیره کنید (Firestore).');
  }
  if (text === '/settings' || text === '⚙️ تنظیمات') {
    return reply(chatId, '⚙️ تنظیمات اعلان‌ها از داخل برنامه (تب تلگرام در تنظیمات) مدیریت می‌شود.');
  }
  return reply(chatId, 'دستور ناشناخته. /help', { reply_markup: MENU });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && (req.url || '').startsWith('/webhook')) {
    if (SECRET && req.headers['x-telegram-bot-api-secret-token'] !== SECRET) {
      res.writeHead(401); return res.end('unauthorized');
    }
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', async () => {
      try { await handleUpdate(JSON.parse(body)); } catch (e) { console.error('[telegram-bot] update error', e); }
      res.writeHead(200); res.end('ok');
    });
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Telegram bot webhook server is running. POST /webhook');
});

// Best-effort: register the slash-command menu on boot (no-op if token missing).
if (TOKEN) call('setMyCommands', { commands: COMMANDS }).catch(() => {});

server.listen(PORT, () => console.log(`[telegram-bot] listening on :${PORT}  (POST /webhook)`));
