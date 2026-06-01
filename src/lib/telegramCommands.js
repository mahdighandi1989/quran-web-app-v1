// In-app Telegram command responder. While the app is open and Telegram is enabled, this
// long-polls getUpdates and answers the bot's commands + menu buttons directly from the
// browser — so the bot works WITHOUT deploying the server (best-effort; the page must be open).
//
// It only handles updates from the user's own chat ids (primary + devices). It is mutually
// exclusive with a webhook: if the bot server has set a webhook, getUpdates returns 409 and we
// back off (the server then handles everything instead).
//
// The browser already holds the live data (full ayah dataset, sessions, the user's AI key), so
// search / review / practice / hifz / tafsir / ask all run here against real data.
import {
  getUpdates, sendMessage, setupBotMenu, TELEGRAM_REPLY_KEYBOARD,
  TELEGRAM_NOTIFICATION_TYPES, parseReminderCommand,
} from './telegram.js';
import { joinTokens } from './format.js';
import { normAR, eq, getSimilarity } from './arabic.js';
import { isAIReady, askAI } from './aiClient.js';
import { tafsirPrompt, hifzPrompt, qaPrompt } from './aiTasks.js';

// Bump this whenever the in-app command set changes; /version reports it so you can confirm the
// deployed site is actually running the latest code.
export const BOT_VERSION = '2026-06-inapp2 (lenient practice grading + skip)';

const uid = () => Math.random().toString(36).slice(2, 10);
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const isSkip = (t) => /^(رد|skip|\/skip|نمیدانم|نمی‌دانم|بلد نیستم|بلدنیستم|؟|\?)$/i.test(String(t || '').trim());

// Leading emojis of the persistent menu buttons — used to tell a "button tap / command" apart
// from a plain answer while an interactive session (practice / search / ask) is pending.
const MENU_LABELS = ['📊', '📈', '📝', '🧠', '✨', '💬', '🗓', '⏰', '⚙️', '❓', '🔎', '🔁'];
const isCommandOrButton = (t) => t.startsWith('/') || MENU_LABELS.some((e) => t.startsWith(e));

/* ------------------------------ text formatting ------------------------------ */
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

/* --------------------------- dataset / search / review ----------------------- */
// Compact card for one raw dataset ayah, with display (diacritics) + plain text.
export function ayahCard(a) {
  const full = joinTokens(a.tokens_with_diacritics?.length ? a.tokens_with_diacritics : a.tokens);
  const plain = joinTokens(a.tokens_plain?.length ? a.tokens_plain : a.tokens);
  return { s: a.surah_number, a: a.ayah_number, n: a.surah_name || '', full: full || plain, plain: plain || full };
}
// Search the dataset: "surah:ayah" / "surah ayah" exact, or normalized text contains.
export function searchDataset(dataset, query, limit = 6) {
  const q = String(query || '').trim();
  const m = q.match(/^(\d{1,3})\s*[:：]?\s*(\d{1,3})$/);
  const cards = (dataset || []).map(ayahCard).filter((c) => c.full || c.plain);
  if (m) { const s = +m[1], a = +m[2]; return cards.filter((c) => c.s === s && c.a === a).slice(0, limit); }
  const nq = normAR(q);
  if (!nq) return [];
  return cards.filter((c) => normAR(c.full).includes(nq) || normAR(c.plain).includes(nq)).slice(0, limit);
}
// Most-mistaken ayahs (with text) from past sessions, worst first.
export function topMistakeCards(dataset, sessions, limit = 50) {
  const wrong = new Map();
  for (const sess of sessions || []) for (const w of sess.wrongItems || []) {
    const k = `${w.surah}:${w.ayah}`; wrong.set(k, (wrong.get(k) || 0) + 1);
  }
  const byKey = new Map();
  for (const a of dataset || []) byKey.set(`${a.surah_number}:${a.ayah_number}`, a);
  return [...wrong.entries()].sort((x, y) => y[1] - x[1])
    .map(([k, count]) => { const a = byKey.get(k); return a ? { ...ayahCard(a), wrong: count } : null; })
    .filter(Boolean).slice(0, limit);
}
const fmtHits = (hits) => hits.map((h) => `📖 <b>${h.n || h.s}:${h.a}</b>\n«${h.full || h.plain}»`).join('\n\n');

/* ------------------------------ command routing ------------------------------ */
// Decide the reply for one text message. Pure (no I/O) so it can be unit-tested.
// Returns one of:
//   null                              -> ignore
//   { text, menu }                    -> just send text
//   { text, menu, addReminder }       -> + persist a reminder
//   { text, menu, setGoal }           -> + set the daily goal (number)
//   { text, menu, patchConfig }       -> + merge into the telegram config
//   { defer: '<kind>', ...args }      -> async/interactive; executed by the responder
export function buildCommandReply(text, { appState, dataset = [] } = {}) {
  const t = String(text || '').trim();
  if (!t) return null;
  const is = (cmd, label) => t === cmd || t.startsWith(cmd + ' ') || t === label;

  if (is('/start')) return { text: 'به بات «مرکز حفظ قرآن» خوش آمدید 👋\nاز منوی پایین استفاده کن. (/help)', menu: true };
  if (is('/version')) return { text: `🛠 نسخهٔ بات (داخل برنامه): ${BOT_VERSION}`, menu: true };
  if (is('/help', '❓ راهنما')) return {
    text: '<b>دستورها:</b>\n'
      + '📊 /status • 📈 /progress • 🗓 /today\n'
      + '📝 /practice (مثال <code>/practice 2 5</code>) • 🔁 /review\n'
      + '🔎 /search (مثال <code>/search 2:255</code>)\n'
      + '🧠 /hifz • ✨ /tafsir • 💬 /ask (هوش مصنوعی)\n'
      + '⏰ /remind <code>HH:MM متن</code> • 🎯 /goal <code>30</code>\n'
      + '🔔 /notif <code>exam_result off</code> • ⚙️ /settings',
    menu: true,
  };

  if (is('/status', '📊 وضعیت')) return { text: fmtStatus(appState), menu: true };
  if (is('/progress', '📈 پیشرفت')) return { text: fmtProgress(appState), menu: true };
  if (is('/today', '🗓 امروز')) return { text: fmtToday(appState), menu: true };
  if (is('/settings', '⚙️ تنظیمات')) return { text: '⚙️ مدیریت کامل اعلان‌ها از تب تلگرام در برنامه است.\nخاموش/روشنِ سریع: <code>/notif exam_result off</code>', menu: true };

  if (is('/remind', '⏰ یادآوری')) {
    const parsed = parseReminderCommand(t);
    if (!parsed) return { text: 'قالب درست: <code>/remind 08:00 صبح‌گاهی را بخوان</code>', menu: true };
    return { text: `✅ یادآوری ثبت شد: ساعت ${parsed.time} — ${parsed.text}`, menu: true, addReminder: parsed };
  }

  if (is('/goal')) {
    const n = parseInt(t.replace(/^\/goal\b/i, '').trim(), 10);
    if (!n || n < 1) return { text: 'قالب: <code>/goal 30</code> (تعداد آیه/سوال در روز)', menu: true };
    const v = Math.min(500, n);
    return { text: `🎯 هدف روزانه روی ${v} تنظیم شد. (در برنامه هم اعمال می‌شود)`, menu: true, setGoal: v };
  }

  if (is('/notif')) {
    const parts = t.replace(/^\/notif\b/i, '').trim().split(/\s+/).filter(Boolean);
    const types = TELEGRAM_NOTIFICATION_TYPES.map((x) => x.key);
    if (parts.length < 2 || !types.includes(parts[0]) || !['on', 'off'].includes(parts[1]))
      return { text: 'قالب: <code>/notif exam_result off</code>\nانواع: ' + types.join('، '), menu: true };
    const enabled = parts[1] === 'on';
    return { text: `✅ اعلان «${parts[0]}» ${enabled ? 'روشن' : 'خاموش'} شد.`, menu: true, patchConfig: { notifications: { [parts[0]]: { enabled } } } };
  }

  // search: with a query -> immediate results (sync); bare -> await a follow-up message.
  if (is('/search', '🔎 جستجو')) {
    const q = t.replace(/^\/search\b/i, '').replace(/^🔎\s*جستجو/, '').trim();
    if (!q) return { defer: 'search-await' };
    const hits = searchDataset(dataset, q);
    if (!hits.length) return { text: 'موردی یافت نشد. (نمونه: <code>/search 2:255</code> یا بخشی از متن آیه)', menu: true };
    return { text: fmtHits(hits), menu: true };
  }

  // interactive / async commands -> executed by the responder (need state or the AI key)
  if (is('/practice', '📝 تمرین')) return { defer: 'practice', args: t.replace(/^\/practice\b/i, '').replace(/^📝\s*تمرین/, '').trim() };
  if (is('/review', '🔁 مرور اشتباهات')) return { defer: 'review', args: t.replace(/^\/review\b/i, '').replace(/^🔁\s*مرور اشتباهات/, '').trim() };
  if (is('/tafsir', '✨ تفسیر')) return { defer: 'tafsir' };
  if (is('/hifz', '🧠 حفظ')) return { defer: 'hifz' };
  if (is('/ask', '💬 پرسش')) {
    const q = t.replace(/^\/ask\b/i, '').replace(/^💬\s*پرسش/, '').trim();
    return q ? { defer: 'ask', query: q } : { defer: 'ask-await' };
  }

  return { text: 'دستور ناشناخته. /help', menu: true };
}

// Start the responder. The get* callbacks return the latest live values; the on* callbacks
// persist a change made from Telegram. Returns a stop() function.
export function startTelegramResponder({
  getConfig, getAppState, getDataset, getSessions, getAI,
  onAddReminder, onSetGoal, onPatchConfig, onWebhookConflict,
}) {
  let stopped = false;
  let offset = undefined;
  let timer = null;
  let menuSynced = false;
  const pendings = new Map(); // chatId -> { kind, ... } interactive session

  const ds = () => (getDataset ? getDataset() : []) || [];
  const ownChatIds = (cfg) => {
    const ids = new Set();
    if (cfg && cfg.primaryChatId) ids.add(String(cfg.primaryChatId));
    for (const d of (cfg && cfg.devices) || []) if (d && d.chatId) ids.add(String(d.chatId));
    return ids;
  };
  const send = (token, chatId, text, menu = true) =>
    sendMessage(token, chatId, text, menu ? { replyMarkup: TELEGRAM_REPLY_KEYBOARD } : {}).catch(() => {});

  // Pick an ayah from the pool, hide its second half, store it on the session, and ask for it.
  async function sendQuestion(token, chatId, sess) {
    const card = pickRandom(sess.pool);
    const words = (card.full || card.plain || '').split(/\s+/).filter(Boolean);
    const hideFrom = Math.max(1, Math.ceil(words.length / 2));
    sess.card = card;
    sess.rest = words.slice(hideFrom).join(' '); // hidden continuation (accepted as correct)
    pendings.set(chatId, sess);
    await send(token, chatId, `📝 <b>تمرین ${sess.done + 1}/${sess.total}</b> — ادامهٔ آیه را بنویس (یا کلِ آیه):\n«${words.slice(0, hideFrom).join(' ')} …»\n<code>${card.n || card.s}:${card.a}</code>\n<i>اگر بلد نیستی بنویس «رد» تا جواب را ببینی.</i>`);
  }

  // Run a prompt with the user's configured AI; returns { text } or { error }.
  async function runAI(prompt) {
    const cfg = getAI ? getAI() : null;
    if (!isAIReady(cfg)) return { error: '🧠 برای این قابلیت، در برنامه → تنظیمات → هوش مصنوعی، کلید و مدل را تنظیم کن.' };
    try { return { text: await askAI(cfg, prompt) }; }
    catch (e) { return { error: '⚠️ خطای هوش مصنوعی: ' + (e?.message || '') }; }
  }

  async function handleMessage(token, chatId, rawText) {
    const t = String(rawText || '').trim();
    const sess = pendings.get(chatId);

    // 1) A pending interactive session consumes the next *plain* message.
    if (sess && !isCommandOrButton(t)) {
      if (sess.kind === 'practice') {
        const card = sess.card;
        const full = card.full || card.plain;
        const skip = isSkip(t);
        const sim = Math.max(getSimilarity(t, full), getSimilarity(t, card.plain), sess.rest ? getSimilarity(t, sess.rest) : 0);
        const ok = !skip && (eq(t, card.plain) || eq(t, full) || sim >= 0.8);
        sess.done += 1; if (ok) sess.correct += 1;
        const pct = Math.round(sim * 100);
        const head = skip ? '⏭ رد شد. پاسخ درست:'
          : ok ? `✅ آفرین! درست بود (${pct}٪ تطابق).`
          : `❌ نزدیک بود (${pct}٪). پاسخ درست:`;
        const fb = `${head}\n«${full}»\n— ${card.n || card.s}:${card.a}`;
        if (sess.done >= sess.total) {
          pendings.delete(chatId);
          const score = sess.total ? Math.round((sess.correct / sess.total) * 100) : 0;
          return send(token, chatId, `${fb}\n\n🏁 <b>پایان تمرین</b> — ${sess.correct}/${sess.total} درست (${score}٪).`);
        }
        await send(token, chatId, fb);
        return sendQuestion(token, chatId, sess);
      }
      if (sess.kind === 'search') {
        pendings.delete(chatId);
        const hits = searchDataset(ds(), t);
        return send(token, chatId, hits.length ? fmtHits(hits) : 'موردی یافت نشد.');
      }
      if (sess.kind === 'ask') {
        pendings.delete(chatId);
        await send(token, chatId, '⏳ …');
        const r = await runAI(qaPrompt({ question: t }));
        return send(token, chatId, r.text || r.error);
      }
    }

    // 2) Command / button routing.
    const reply = buildCommandReply(t, { appState: getAppState ? getAppState() : null, dataset: ds() });
    if (!reply) return;

    if (reply.defer) {
      if (reply.defer === 'search-await') { pendings.set(chatId, { kind: 'search' }); return send(token, chatId, '🔎 سوره:آیه (مثل 2:255) یا بخشی از متن آیه را بنویس:'); }
      if (reply.defer === 'ask-await') { pendings.set(chatId, { kind: 'ask' }); return send(token, chatId, '💬 سوالت دربارهٔ قرآن را بنویس:'); }
      if (reply.defer === 'ask') {
        await send(token, chatId, '⏳ …');
        const r = await runAI(qaPrompt({ question: reply.query }));
        return send(token, chatId, r.text || r.error);
      }
      if (reply.defer === 'tafsir' || reply.defer === 'hifz') {
        const cards = ds().map(ayahCard).filter((c) => c.full || c.plain);
        if (!cards.length) return send(token, chatId, 'برای این قابلیت، اول در برنامه دیتاست آیات را بارگذاری کن (و یک‌بار وارد شو).');
        const card = pickRandom(cards);
        await send(token, chatId, reply.defer === 'tafsir' ? '⏳ در حال آماده‌سازی تفسیر…' : '⏳ در حال آماده‌سازی نکات حفظ…');
        const prompt = (reply.defer === 'tafsir' ? tafsirPrompt : hifzPrompt)({ surahName: card.n, ayahNumber: card.a, ayahText: card.full });
        const r = await runAI(prompt);
        if (r.error) return send(token, chatId, r.error);
        const head = reply.defer === 'tafsir'
          ? `✨ <b>تفسیر</b> (${card.n || card.s}:${card.a})\n«${card.full}»\n\n`
          : `🧠 <b>کمک حفظ</b> (${card.n || card.s}:${card.a})\n\n`;
        return send(token, chatId, head + r.text);
      }
      if (reply.defer === 'practice' || reply.defer === 'review') {
        let pool;
        if (reply.defer === 'review') {
          pool = topMistakeCards(ds(), getSessions ? getSessions() : []);
          if (!pool.length) return send(token, chatId, 'هنوز آیهٔ پرخطایی ثبت نشده. کمی تمرین کن تا اینجا پر شود. 🌿');
        } else {
          pool = ds().map(ayahCard).filter((c) => c.full || c.plain);
          if (!pool.length) return send(token, chatId, 'برای تمرین، اول در برنامه دیتاست آیات را بارگذاری کن (و یک‌بار وارد شو).');
        }
        const args = (reply.args || '').split(/\s+/).filter(Boolean);
        const surahArg = args.find((x) => /^\d+$/.test(x) && +x >= 1 && +x <= 114);
        if (reply.defer === 'practice' && surahArg) { const f = pool.filter((c) => String(c.s) === String(surahArg)); if (f.length) pool = f; }
        const countArg = args.find((x) => x !== surahArg && /^\d+$/.test(x));
        const total = Math.max(1, Math.min(10, parseInt(countArg, 10) || (reply.defer === 'review' ? Math.min(5, pool.length) : 5)));
        return sendQuestion(token, chatId, { kind: 'practice', pool, total, done: 0, correct: 0 });
      }
      return;
    }

    if (reply.addReminder && onAddReminder) { try { onAddReminder({ id: uid(), enabled: true, ...reply.addReminder }); } catch { /* ignore */ } }
    if (reply.setGoal != null && onSetGoal) { try { onSetGoal(reply.setGoal); } catch { /* ignore */ } }
    if (reply.patchConfig && onPatchConfig) { try { onPatchConfig(reply.patchConfig); } catch { /* ignore */ } }
    return send(token, chatId, reply.text, reply.menu);
  }

  async function tick() {
    if (stopped) return;
    const cfg = getConfig();
    if (!cfg || !cfg.enabled || !cfg.botToken) { schedule(4000); return; }
    // Refresh the "/" slash-command menu once per run so the new commands show up in Telegram.
    if (!menuSynced) { menuSynced = true; setupBotMenu(cfg.botToken).catch(() => {}); }
    try {
      const updates = await getUpdates(cfg.botToken, offset, 0);
      for (const u of updates || []) {
        offset = u.update_id + 1;
        const msg = u.message;
        if (!msg || !msg.text) continue;
        const chatId = String(msg.chat.id);
        if (!ownChatIds(cfg).has(chatId)) continue; // only respond to the owner's chats
        await handleMessage(cfg.botToken, chatId, msg.text);
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
