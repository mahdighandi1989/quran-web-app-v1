// Telegram bot webhook server — TWO-WAY control of the Quran app from Telegram.
//
// It holds the bot TOKEN securely (env var, never in the browser) and reads/writes the same
// Firestore the web app uses, so /status, /progress, /today return REAL data and /remind
// writes a reminder the app then honours. The persistent bottom menu maps to these commands.
//
// Zero runtime deps except firebase-admin. Node 18+ (built-in http + global fetch).
//
// Deploy as its own service (Render Web Service / VPS / Cloud Run). Env:
//   TELEGRAM_BOT_TOKEN=<from @BotFather>                         (required)
//   TELEGRAM_WEBHOOK_SECRET=<random>                             (recommended)
//   FIREBASE_SERVICE_ACCOUNT=<service-account JSON, one line>    (for Firestore; or use
//                                                                 GOOGLE_APPLICATION_CREDENTIALS)
//   PORT=3001
// Then register the webhook once:
//   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR-HOST/webhook&secret_token=<SECRET>"
import http from 'node:http';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const PORT = Number(process.env.PORT || 3001);
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';

if (!TOKEN) console.warn('[telegram-bot] TELEGRAM_BOT_TOKEN not set — replies will fail until you set it.');

/* ----------------------------- Firestore (Admin) ----------------------------- */
let db = null;
async function initFirestore() {
  try {
    const admin = await import('firebase-admin');
    const A = admin.default || admin;
    if (!A.apps.length) {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (raw) A.initializeApp({ credential: A.credential.cert(JSON.parse(raw)) });
      else A.initializeApp(); // GOOGLE_APPLICATION_CREDENTIALS / default creds
    }
    db = A.firestore();
    console.log('[telegram-bot] Firestore connected.');
  } catch (e) {
    console.warn('[telegram-bot] Firestore not configured (' + e.message + '). Data commands will be limited.');
    db = null;
  }
}

// Resolve an incoming chat id to a user (uid + their telegram config) via the allChatIds index.
async function resolveUser(chatId) {
  if (!db) return null;
  const q = await db.collection('telegramConfigs').where('allChatIds', 'array-contains', String(chatId)).limit(1).get();
  if (q.empty) return null;
  return { uid: q.docs[0].id, config: q.docs[0].data() };
}
async function getAppState(uid) {
  if (!db) return null;
  const snap = await db.collection('appState').doc(uid).get();
  return snap.exists ? snap.data() : null;
}
async function addReminder(uid, reminder) {
  const refDoc = db.collection('telegramConfigs').doc(uid);
  const snap = await refDoc.get();
  const cfg = snap.exists ? snap.data() : {};
  const reminders = Array.isArray(cfg.reminders) ? cfg.reminders : [];
  reminders.push({ id: Math.random().toString(36).slice(2, 10), enabled: true, ...reminder });
  await refDoc.set({ ...cfg, reminders }, { merge: true });
}

// Shared reminder parser (mirrors src/lib/telegram.js parseReminderCommand — kept inline so
// the server folder can be deployed on its own).
function parseReminderCommand(input) {
  const s = String(input || '').replace(/^\/remind\b/i, '').replace(/^⏰\s*یادآوری/i, '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})\s+(.+)$/);
  if (!m) return null;
  const h = Number(m[1]), mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return { time: `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, text: m[3].trim() };
}

/* ------------------------------ Telegram helpers ----------------------------- */
async function call(method, params) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
  });
  return res.json();
}
const reply = (chatId, text, extra = {}) => call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });

const MENU = {
  keyboard: [
    [{ text: '📊 وضعیت' }, { text: '📈 پیشرفت' }],
    [{ text: '🗓 امروز' }, { text: '⏰ یادآوری' }],
    [{ text: '⚙️ تنظیمات' }, { text: '❓ راهنما' }],
  ],
  resize_keyboard: true, is_persistent: true,
};
const COMMANDS = [
  { command: 'start', description: 'شروع و راهنما' },
  { command: 'status', description: 'وضعیت فعلی برنامه' },
  { command: 'progress', description: 'پیشرفت حفظ' },
  { command: 'today', description: 'خلاصهٔ امروز' },
  { command: 'remind', description: 'تنظیم یادآوری (HH:MM متن)' },
  { command: 'settings', description: 'تنظیمات اعلان‌ها' },
  { command: 'help', description: 'راهنما' },
];

const linkHint = (chatId) =>
  `حساب شما هنوز به برنامه متصل نشده.\nChat ID شما: <code>${chatId}</code>\n` +
  'در برنامه وارد شوید → تنظیمات → تب تلگرام → این Chat ID را وارد و فعال کنید.';

function fmtStatus(st) {
  if (!st) return 'هنوز داده‌ای از برنامه همگام نشده. یک بار وارد برنامه شوید.';
  return '📊 <b>وضعیت برنامه</b>\n'
    + `• آیات دیتاست: ${st.dataset?.ayahs ?? 0}\n`
    + `• صفحات: ${st.pages ?? 0}\n`
    + `• نشان‌شده: ${st.flagged ?? 0}\n`
    + `• کل جلسات: ${st.sessions?.total ?? 0}\n`
    + `• آخرین به‌روزرسانی: ${st.updatedAt ? new Date(st.updatedAt).toLocaleString('fa-IR') : '—'}`;
}
function fmtProgress(st) {
  if (!st || !st.sessions) return 'هنوز پیشرفتی ثبت نشده.';
  const s = st.sessions;
  return '📈 <b>پیشرفت حفظ</b>\n'
    + `• دقت کلی: ${s.accuracyPct ?? 0}%\n`
    + `• درست/غلط: ${s.totalCorrect ?? 0} / ${s.totalWrong ?? 0}\n`
    + `• جلسات ۷ روز اخیر: ${s.last7Days ?? 0}\n`
    + `• آخرین جلسه: ${s.lastSessionAt ? new Date(s.lastSessionAt).toLocaleString('fa-IR') : '—'}`;
}
function fmtToday(st) {
  const t = st?.sessions?.today;
  if (!t) return '🗓 امروز هنوز جلسه‌ای ثبت نشده.';
  return '🗓 <b>خلاصهٔ امروز</b>\n'
    + `• جلسات: ${t.sessions}\n• درست: ${t.correct}\n• غلط: ${t.wrong}`;
}

/* -------------------------------- Update handler ----------------------------- */
async function handleUpdate(update) {
  const msg = update.message || update.edited_message;
  if (!msg || !msg.text) return;
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const isCmd = (c, label) => text === c || text.startsWith(c + ' ') || text === label;

  if (isCmd('/start')) {
    return reply(chatId,
      'به بات «مرکز حفظ قرآن» خوش آمدید 👋\n' + linkHint(chatId) + '\nسپس از منوی پایین استفاده کنید.',
      { reply_markup: MENU });
  }
  if (isCmd('/help', '❓ راهنما')) {
    return reply(chatId,
      'دستورها:\n/status وضعیت\n/progress پیشرفت\n/today امروز\n/remind <code>HH:MM متن</code> یادآوری\n/settings تنظیمات',
      { reply_markup: MENU });
  }

  const user = await resolveUser(chatId);
  if (!user) return reply(chatId, linkHint(chatId), { reply_markup: MENU });

  if (isCmd('/status', '📊 وضعیت'))   return reply(chatId, fmtStatus(await getAppState(user.uid)), { reply_markup: MENU });
  if (isCmd('/progress', '📈 پیشرفت')) return reply(chatId, fmtProgress(await getAppState(user.uid)), { reply_markup: MENU });
  if (isCmd('/today', '🗓 امروز'))     return reply(chatId, fmtToday(await getAppState(user.uid)), { reply_markup: MENU });

  if (isCmd('/settings', '⚙️ تنظیمات')) {
    const n = (user.config && user.config.notifications) || {};
    const on = Object.entries(n).filter(([, v]) => v && v.enabled !== false).map(([k]) => k);
    return reply(chatId, '⚙️ اعلان‌های فعال: ' + (on.length ? on.join('، ') : 'هیچ') + '\nمدیریت کامل از تب تلگرام در برنامه.', { reply_markup: MENU });
  }

  if (isCmd('/remind', '⏰ یادآوری')) {
    const parsed = parseReminderCommand(text);
    if (!parsed) return reply(chatId, 'قالب درست: <code>/remind 08:00 صبح‌گاهی را بخوان</code>', { reply_markup: MENU });
    if (!db) return reply(chatId, 'ذخیرهٔ یادآوری نیازمند اتصال Firestore در سرور است.', { reply_markup: MENU });
    await addReminder(user.uid, parsed);
    return reply(chatId, `✅ یادآوری ثبت شد: ساعت ${parsed.time} — ${parsed.text}`, { reply_markup: MENU });
  }

  return reply(chatId, 'دستور ناشناخته. /help', { reply_markup: MENU });
}

/* ----------------------------------- Server ---------------------------------- */
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

await initFirestore();
if (TOKEN) call('setMyCommands', { commands: COMMANDS }).catch(() => {});
server.listen(PORT, () => console.log(`[telegram-bot] listening on :${PORT}  (POST /webhook)`));

export { parseReminderCommand, fmtStatus, fmtProgress, fmtToday };
