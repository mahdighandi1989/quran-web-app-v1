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
import { resolveAI, chat as aiChat, prompts as aiPrompts } from './ai.mjs';

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
async function getAiConfig(uid) {
  if (!db) return null;
  const snap = await db.collection('aiConfigs').doc(uid).get();
  return snap.exists ? snap.data() : null;
}
async function getQuranSample(uid) {
  if (!db) return [];
  const snap = await db.collection('quranSamples').doc(uid).get();
  return (snap.exists && Array.isArray(snap.data().ayahs)) ? snap.data().ayahs : [];
}

// Per-chat ephemeral session for the interactive practice/hifz flow (in-memory).
const botSessions = new Map();
const norm = (s) => String(s || '')
  .replace(/[ً-ٰٟۖ-ۭـ‌‏]/g, '')
  .replace(/[آأإٱ]/g, 'ا').replace(/[يى]/g, 'ی')
  .replace(/ك/g, 'ک').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

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
    [{ text: '📝 تمرین' }, { text: '🧠 حفظ' }],
    [{ text: '✨ تفسیر' }, { text: '💬 پرسش' }],
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
  { command: 'practice', description: 'تمرین: آیه را کامل کن' },
  { command: 'hifz', description: 'حفظ: نکات حفظ یک آیه' },
  { command: 'tafsir', description: 'تفسیر/معنی یک آیه (هوش مصنوعی)' },
  { command: 'ask', description: 'پرسش‌وپاسخ قرآنی (هوش مصنوعی)' },
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
// Build a practice question for a random ayah in the session pool, store it (with running
// score), and send it. Used by /practice for chained, scored questions.
async function sendPracticeQuestion(chatId, sess) {
  const ayah = sess.pool[Math.floor(Math.random() * sess.pool.length)];
  const words = (ayah.t || ayah.p || '').split(/\s+/);
  const hideFrom = Math.max(1, Math.ceil(words.length / 2));
  const prompt = words.slice(0, hideFrom).join(' ');
  sess.ayah = ayah; sess.awaiting = true;
  botSessions.set(chatId, sess);
  await reply(chatId, `📝 <b>تمرین ${sess.done + 1}/${sess.total}</b> — ادامهٔ آیه را بنویس:\n«${prompt} …»\n<code>${ayah.n || ayah.s}:${ayah.a}</code>`, { reply_markup: MENU });
}

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
      '<b>دستورها:</b>\n' +
      '📊 /status وضعیت • 📈 /progress پیشرفت • 🗓 /today امروز\n' +
      '📝 /practice تمرین (آیه را کامل کن) — مثال: <code>/practice 2 5</code> (سوره ۲، ۵ سوال)\n' +
      '🧠 /hifz نکات حفظ (هوش مصنوعی)\n' +
      '✨ /tafsir تفسیر/معنی (هوش مصنوعی)\n' +
      '💬 /ask پرسش‌وپاسخ قرآنی (هوش مصنوعی)\n' +
      '⏰ /remind <code>HH:MM متن</code> یادآوری • ⚙️ /settings',
      { reply_markup: MENU });
  }

  const user = await resolveUser(chatId);
  if (!user) return reply(chatId, linkHint(chatId), { reply_markup: MENU });

  // Run AI for the user with a friendly fallback if not configured.
  const runAI = async (messages, opts) => {
    const ai = resolveAI(await getAiConfig(user.uid));
    if (!ai) { await reply(chatId, '🧠 برای این قابلیت ابتدا در برنامه → تنظیمات → هوش مصنوعی، کلید و مدل را تنظیم کنید.', { reply_markup: MENU }); return null; }
    try { return await aiChat(ai, messages, opts); }
    catch (e) { await reply(chatId, '⚠️ خطای هوش مصنوعی: ' + (e?.message || ''), { reply_markup: MENU }); return null; }
  };

  // If a practice answer is awaited, grade it, keep score, and chain the next question.
  const sess = botSessions.get(chatId);
  if (sess && sess.mode === 'practice' && sess.awaiting && !text.startsWith('/') && !/^[📊📈📝🧠✨💬🗓⏰⚙️❓]/.test(text)) {
    const ok = norm(text) === norm(sess.ayah.p || sess.ayah.t);
    sess.done += 1; if (ok) sess.correct += 1;
    const full = sess.ayah.t || sess.ayah.p;
    const fb = (ok ? '✅ آفرین! درست بود.' : '❌ نزدیک بود. پاسخ درست:') + `\n«${full}»\n— ${sess.ayah.n || sess.ayah.s}:${sess.ayah.a}`;
    if (sess.done >= sess.total) {
      botSessions.delete(chatId);
      const pct = sess.total ? Math.round((sess.correct / sess.total) * 100) : 0;
      return reply(chatId, `${fb}\n\n🏁 <b>پایان تمرین</b> — ${sess.correct}/${sess.total} درست (${pct}%).\nبرای تمرین دوباره: 📝 تمرین`, { reply_markup: MENU });
    }
    await reply(chatId, fb);
    return sendPracticeQuestion(chatId, sess);
  }

  if (isCmd('/status', '📊 وضعیت'))   return reply(chatId, fmtStatus(await getAppState(user.uid)), { reply_markup: MENU });
  if (isCmd('/progress', '📈 پیشرفت')) return reply(chatId, fmtProgress(await getAppState(user.uid)), { reply_markup: MENU });
  if (isCmd('/today', '🗓 امروز'))     return reply(chatId, fmtToday(await getAppState(user.uid)), { reply_markup: MENU });

  // Practice: optional "/practice <surah> <count>"; chains `count` ayahs and keeps score.
  if (isCmd('/practice', '📝 تمرین')) {
    const ayahs = await getQuranSample(user.uid);
    if (!ayahs.length) return reply(chatId, 'برای تمرین، ابتدا در برنامه دیتاست آیات را بارگذاری کنید (و یک‌بار وارد شوید تا همگام شود).', { reply_markup: MENU });
    const args = text.replace(/^\/practice\b/i, '').replace(/^📝\s*تمرین/, '').trim().split(/\s+/).filter(Boolean);
    const surahArg = args.find((x) => /^\d+$/.test(x) && +x >= 1 && +x <= 114);
    const countArg = args.find((x) => x !== surahArg && /^\d+$/.test(x));
    let pool = ayahs;
    if (surahArg) { const f = ayahs.filter((a) => String(a.s) === String(surahArg)); if (f.length) pool = f; }
    const total = Math.max(1, Math.min(10, parseInt(countArg, 10) || 5));
    return sendPracticeQuestion(chatId, { mode: 'practice', pool, total, done: 0, correct: 0 });
  }

  // Hifz: AI memorization tips for a random (or specified) ayah.
  if (isCmd('/hifz', '🧠 حفظ')) {
    const ayahs = await getQuranSample(user.uid);
    if (!ayahs.length) return reply(chatId, 'برای حفظ، ابتدا در برنامه دیتاست آیات را بارگذاری کنید.', { reply_markup: MENU });
    const ayah = pickRandom(ayahs);
    await reply(chatId, '⏳ در حال آماده‌سازی نکات حفظ…');
    const out = await runAI(aiPrompts.hifz(ayah), { maxTokens: 700 });
    if (out) return reply(chatId, `🧠 <b>کمک حفظ</b> (${ayah.n || ayah.s}:${ayah.a})\n\n${out}`, { reply_markup: MENU });
    return;
  }

  // Tafsir: AI meaning/tafsir for a random (or specified) ayah.
  if (isCmd('/tafsir', '✨ تفسیر')) {
    const ayahs = await getQuranSample(user.uid);
    if (!ayahs.length) return reply(chatId, 'برای تفسیر، ابتدا در برنامه دیتاست آیات را بارگذاری کنید.', { reply_markup: MENU });
    const ayah = pickRandom(ayahs);
    await reply(chatId, '⏳ در حال آماده‌سازی تفسیر…');
    const out = await runAI(aiPrompts.tafsir(ayah), { maxTokens: 700 });
    if (out) return reply(chatId, `✨ <b>تفسیر</b> (${ayah.n || ayah.s}:${ayah.a})\n«${ayah.t || ayah.p}»\n\n${out}`, { reply_markup: MENU });
    return;
  }

  // Ask: free-form Quran Q&A. "/ask <question>" or the menu button then a follow-up message.
  if (isCmd('/ask', '💬 پرسش')) {
    const q = text.replace(/^\/ask\b/i, '').replace(/^💬\s*پرسش/, '').trim();
    if (!q) { botSessions.set(chatId, { mode: 'ask', awaiting: 'ask' }); return reply(chatId, '💬 سوالت دربارهٔ قرآن را بنویس:', { reply_markup: MENU }); }
    await reply(chatId, '⏳ …');
    const out = await runAI(aiPrompts.qa(q), { maxTokens: 900 });
    if (out) return reply(chatId, out, { reply_markup: MENU });
    return;
  }
  // follow-up message for a pending /ask
  if (sess && sess.awaiting === 'ask' && !text.startsWith('/')) {
    botSessions.delete(chatId);
    await reply(chatId, '⏳ …');
    const out = await runAI(aiPrompts.qa(text), { maxTokens: 900 });
    if (out) return reply(chatId, out, { reply_markup: MENU });
    return;
  }

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

function buildDailySummaryText(st) {
  const s = st && st.sessions;
  const t = s && s.today;
  const head = '🌅 <b>خلاصهٔ روزانه</b>';
  if (!s) return head + '\nهنوز داده‌ای ثبت نشده. امروز یک تمرین کوتاه را شروع کن! 🌿';
  const todayLine = t ? `امروز: ${t.sessions} جلسه • ${t.correct} درست / ${t.wrong} غلط` : 'امروز هنوز جلسه‌ای ثبت نشده.';
  return head + `\n${todayLine}\nدقت کلی: ${s.accuracyPct ?? 0}% • جلسات ۷ روز اخیر: ${s.last7Days ?? 0}\nیک تمرین تازه را همین حالا شروع کن. 💪`;
}

/* ------------------------------ Reminder scheduler ----------------------------- */
// Every minute, scan all telegram configs and fire any reminder whose local "HH:MM" matches
// the user's current local time (UTC + tzOffsetMinutes). Works even when the app is closed.
// A per-reminder "lastFiredDay" (stored back on the doc) guarantees once-per-day delivery.
function localHHMMAndDay(tzOffsetMinutes) {
  const off = Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes : 0;
  const local = new Date(Date.now() + off * 60000);
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mm = String(local.getUTCMinutes()).padStart(2, '0');
  const day = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
  return { hhmm: `${hh}:${mm}`, day };
}
function recipientsOf(cfg) {
  const ids = [];
  if (cfg.primaryChatId) ids.push(String(cfg.primaryChatId));
  for (const d of cfg.devices || []) if (d && d.chatId && d.enabled !== false) ids.push(String(d.chatId));
  return [...new Set(ids)];
}
let reminderTickBusy = false;
async function reminderTick() {
  if (!db || reminderTickBusy) return;
  reminderTickBusy = true;
  try {
    const snap = await db.collection('telegramConfigs').where('enabled', '==', true).get();
    for (const doc of snap.docs) {
      const cfg = doc.data() || {};
      const recips = recipientsOf(cfg);
      if (!recips.length) continue;
      const { hhmm, day } = localHHMMAndDay(cfg.tzOffsetMinutes);
      const notif = cfg.notifications || {};
      const docPatch = {};

      // 1) per-time reminders
      const reminders = Array.isArray(cfg.reminders) ? cfg.reminders : [];
      const remOff = !!(notif.reminder && notif.reminder.enabled === false);
      const remSilent = !!(notif.reminder && notif.reminder.silent);
      let remChanged = false;
      for (const r of reminders) {
        if (r.enabled === false || remOff) continue;
        if (r.time !== hhmm || r.lastFiredDay === day) continue;
        r.lastFiredDay = day; remChanged = true;
        for (const id of recips) call('sendMessage', { chat_id: id, text: `⏰ یادآوری: ${r.text}`, disable_notification: remSilent }).catch(() => {});
      }
      if (remChanged) docPatch.reminders = reminders;

      // 2) daily summary at the configured local time (once per day)
      const dsOn = !!(notif.daily_summary && notif.daily_summary.enabled);
      if (dsOn && cfg.dailySummaryTime && cfg.dailySummaryTime === hhmm && cfg.dailySummaryDay !== day) {
        const st = await getAppState(doc.id);
        const dsSilent = !!(notif.daily_summary && notif.daily_summary.silent);
        for (const id of recips) call('sendMessage', { chat_id: id, text: buildDailySummaryText(st), parse_mode: 'HTML', disable_notification: dsSilent }).catch(() => {});
        docPatch.dailySummaryDay = day;
      }

      if (Object.keys(docPatch).length) await doc.ref.set(docPatch, { merge: true }).catch(() => {});
    }
  } catch (e) {
    console.warn('[telegram-bot] reminder tick error', e.message);
  } finally { reminderTickBusy = false; }
}

await initFirestore();
if (TOKEN) call('setMyCommands', { commands: COMMANDS }).catch(() => {});
if (db && TOKEN) {
  setInterval(reminderTick, 60 * 1000);
  console.log('[telegram-bot] reminder scheduler started (every 60s)');
}
server.listen(PORT, () => console.log(`[telegram-bot] listening on :${PORT}  (POST /webhook)`));

export { parseReminderCommand, fmtStatus, fmtProgress, fmtToday };
