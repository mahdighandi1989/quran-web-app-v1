// Telegram integration panel (Settings tab). Per-user config comes in via props (loaded
// from Firestore in App.jsx) — nothing is read from or written to browser localStorage here.
// Outbound features run in the browser; two-way control needs server/telegram-bot.mjs.
import React, { useState } from 'react';
import {
  getMe, detectChatIds, setupBotMenu, sendMessage, notify, resolveRecipients,
  TELEGRAM_NOTIFICATION_TYPES, TELEGRAM_REPLY_KEYBOARD, DEFAULT_TELEGRAM,
} from '../lib/telegram.js';

// Firebase project id (for deep links into the right console). Matches firebase.js fallback.
const FIREBASE_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'quran-app-7566b';

const uid = () => Math.random().toString(36).slice(2, 10);

// Heuristic: does this error mean Firestore isn't ready (not enabled / rules not published /
// permission denied)? Those all need the same one-time setup, so we show the guided steps.
function isFirestoreSetupError(message) {
  return /firestore|permission|insufficient|PERMISSION_DENIED|not been used|disabled|rules|سرور|Firestore/i.test(String(message || ''));
}

// In-page, actionable setup guide shown instead of a vague error when Firestore isn't ready.
function FirestoreSetupGuide({ projectId }) {
  const consoleUrl = projectId
    ? `https://console.firebase.google.com/project/${projectId}/firestore`
    : 'https://console.firebase.google.com/';
  const rulesUrl = projectId
    ? `https://console.firebase.google.com/project/${projectId}/firestore/rules`
    : consoleUrl;
  return (
    <div className="tg-setup">
      <div className="tg-setup-title">⚠️ پایگاه‌دادهٔ سرور (Firestore) هنوز آماده نیست</div>
      <p className="tg-setup-sub">
        تنظیمات تلگرام روی سرور ذخیره می‌شود؛ تا این سه قدمِ یک‌بار انجام نشوند، توکن/شناسه ماندگار نمی‌ماند.
      </p>
      <ol className="tg-setup-steps">
        <li>
          <b>Firestore را بساز/فعال کن:</b>{' '}
          <a href={consoleUrl} target="_blank" rel="noreferrer">Firebase Console → Firestore Database</a>{' '}
          → دکمهٔ <i>Create database</i> (حالت Production).
        </li>
        <li>
          <b>قوانین امنیتی را منتشر کن:</b>{' '}
          در تب <a href={rulesUrl} target="_blank" rel="noreferrer">Rules</a>، محتوای فایل{' '}
          <code>firestore.rules</code> (در ریشهٔ پروژه) را جای‌گذاری و <i>Publish</i> کن
          (هر کاربر فقط دادهٔ خودش).
        </li>
        <li>
          <b>صفحه را تازه‌سازی کن.</b> پس از آن این پیام می‌رود و تنظیمات ماندگار می‌شود.
        </li>
      </ol>
    </div>
  );
}

export default function TelegramSettings({
  config, setConfig, loaded = true, loadError = '', saving = false, user,
  sessions = [], dataset = [], pageStructure = [],
}) {
  const tg = config || DEFAULT_TELEGRAM;
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [bot, setBot] = useState(null);
  const [detected, setDetected] = useState(null);
  const [newDevice, setNewDevice] = useState({ label: '', chatId: '' });
  const [newReminder, setNewReminder] = useState({ time: '08:00', text: '' });

  const patch = (p) => setConfig((c) => ({ ...c, ...p }));
  const setNotif = (key, field, val) =>
    setConfig((c) => ({
      ...c,
      notifications: { ...c.notifications, [key]: { ...(c.notifications?.[key] || {}), [field]: val } },
    }));

  const ok = (text) => setMsg({ kind: 'ok', text });
  const fail = (e) => setMsg({ kind: 'err', text: typeof e === 'string' ? e : (e?.message || 'خطا') });
  async function run(name, fn) { setBusy(name); setMsg(null); try { await fn(); } catch (e) { fail(e); } finally { setBusy(''); } }

  const recipients = resolveRecipients(tg);
  const connected = !!(tg.enabled && tg.botToken && recipients.length);

  const validate = () => run('validate', async () => {
    const me = await getMe(tg.botToken); setBot(me);
    ok(`توکن معتبر است ✓ — @${me.username}`);
  });
  const detect = () => run('detect', async () => {
    const list = await detectChatIds(tg.botToken); setDetected(list);
    if (!list.length) fail('گفتگویی پیدا نشد. ابتدا در تلگرام به بات «/start» بفرستید، بعد دوباره بزنید.');
    else ok(`${list.length} گفتگو پیدا شد — یکی را انتخاب کنید.`);
  });
  const sendTest = () => run('test', async () => {
    if (!recipients.length) { fail('ابتدا Chat ID اصلی یا یک دستگاه اضافه کنید.'); return; }
    await Promise.all(recipients.map((id) =>
      sendMessage(tg.botToken, id, '✅ پیام آزمایشی از «مرکز حفظ قرآن».', { replyMarkup: TELEGRAM_REPLY_KEYBOARD })));
    ok(`ارسال شد به ${recipients.length} مقصد (منوی پایین هم فعال شد).`);
  });
  const sendStatus = () => run('status', async () => {
    const text = '📊 <b>وضعیت برنامه</b>\n'
      + `• آیات دیتاست: ${dataset.length}\n• صفحات: ${pageStructure.length}\n`
      + `• جلسات: ${sessions.length}\n• زمان: ${new Date().toLocaleString('fa-IR')}`;
    const r = await notify(tg, 'daily_summary', text);
    if (r.skipped) fail('اعلان «خلاصهٔ روزانه» غیرفعال است یا مقصدی ندارید.');
    else ok(`وضعیت به ${r.sent}/${r.total} مقصد ارسال شد.`);
  });
  const applyMenu = () => run('menu', async () => {
    await setupBotMenu(tg.botToken);
    if (recipients.length) {
      await sendMessage(tg.botToken, recipients[0], 'منوی پایین فعال شد ✅ (برای عملکرد دکمه‌ها سرور بات لازم است).', { replyMarkup: TELEGRAM_REPLY_KEYBOARD });
    }
    ok('منوی دستورها و منوی پایین تنظیم شد. در تلگرام ببینید.');
  });

  const addDevice = () => {
    if (!newDevice.chatId.trim()) return;
    patch({ devices: [...(tg.devices || []), { id: uid(), label: newDevice.label.trim() || 'دستگاه', chatId: newDevice.chatId.trim(), enabled: true }] });
    setNewDevice({ label: '', chatId: '' });
  };
  const removeDevice = (id) => patch({ devices: (tg.devices || []).filter((d) => d.id !== id) });
  const toggleDevice = (id, en) => patch({ devices: (tg.devices || []).map((d) => d.id === id ? { ...d, enabled: en } : d) });

  const addReminder = () => {
    if (!newReminder.text.trim()) return;
    patch({ reminders: [...(tg.reminders || []), { id: uid(), time: newReminder.time, text: newReminder.text.trim(), enabled: true }] });
    setNewReminder({ time: '08:00', text: '' });
  };
  const removeReminder = (id) => patch({ reminders: (tg.reminders || []).filter((r) => r.id !== id) });
  const toggleReminder = (id, en) => patch({ reminders: (tg.reminders || []).map((r) => r.id === id ? { ...r, enabled: en } : r) });

  if (!loaded) {
    return (
      <div className="tg-card" dir="rtl">
        <div className="tg-head"><span className="tg-title">🤖 اعلان‌ها و تعامل تلگرام</span></div>
        <p className="help-text">در حال بارگذاری تنظیمات از سرور…</p>
      </div>
    );
  }

  return (
    <div className="tg-card" dir="rtl">
      <div className="tg-head">
        <span className="tg-title">🤖 اعلان‌ها و تعامل تلگرام</span>
        <span className={`tg-badge ${connected ? 'on' : 'off'}`}>{connected ? 'متصل' : 'غیرفعال'}</span>
      </div>
      <p className="help-text">
        تنظیمات این بخش روی سرور و مخصوص حساب «{user?.displayName || user?.email || 'شما'}» ذخیره می‌شود — چیزی در مرورگر نگه‌داری نمی‌شود.
        {saving && <span className="tg-saving"> • در حال ذخیره…</span>}
      </p>
      {/* If anything points to Firestore not being ready, show the guided 3-step setup instead
          of a vague error. Otherwise show the plain error banner. */}
      {loadError && (isFirestoreSetupError(loadError)
        ? <FirestoreSetupGuide projectId={FIREBASE_PROJECT_ID} />
        : <div className="tg-banner err">{loadError}</div>)}

      <label className="tg-switch">
        <input type="checkbox" className="toggle" checked={!!tg.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
        <span>فعال‌سازی یکپارچه‌سازی تلگرام</span>
      </label>

      <section className="tg-block">
        <h4>اتصال بات</h4>
        <p className="tg-warn">⚠️ توکن یک سِکرت است؛ فقط روی سرور (Firestore) و مخصوص حساب شما ذخیره می‌شود.</p>
        <div className="tg-field">
          <label>توکن بات (BotFather)</label>
          <input type="password" autoComplete="off" placeholder="123456:ABC-..." value={tg.botToken || ''} onChange={(e) => { patch({ botToken: e.target.value.trim() }); setBot(null); }} />
        </div>
        <div className="tg-field">
          <label>Chat ID اصلی (شما)</label>
          <input type="text" inputMode="numeric" placeholder="مثلاً 123456789" value={tg.primaryChatId || ''} onChange={(e) => patch({ primaryChatId: e.target.value.trim() })} />
        </div>
        <div className="tg-actions">
          <button className="btn-secondary" disabled={!tg.botToken || busy} onClick={validate}>{busy === 'validate' ? '...' : 'اعتبارسنجی توکن'}</button>
          <button className="btn-secondary" disabled={!tg.botToken || busy} onClick={detect}>{busy === 'detect' ? '...' : 'تشخیص Chat ID'}</button>
          {bot && <span className="tg-bot">@{bot.username}</span>}
        </div>
        {detected && detected.length > 0 && (
          <div className="tg-chips">
            {detected.map((d) => (
              <button key={d.id} className="tg-chip" onClick={() => { patch({ primaryChatId: d.id }); setDetected(null); ok(`Chat ID = ${d.id} (${d.title})`); }}>
                {d.title} — <code>{d.id}</code>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="tg-block">
        <h4>دستگاه‌ها / مقصدهای دیگر</h4>
        {(tg.devices || []).length === 0 && <p className="help-text">دستگاهی اضافه نشده.</p>}
        {(tg.devices || []).map((d) => (
          <div key={d.id} className="tg-item">
            <input type="checkbox" className="toggle" checked={d.enabled !== false} onChange={(e) => toggleDevice(d.id, e.target.checked)} />
            <span className="tg-item-main">{d.label} <code>{d.chatId}</code></span>
            <button className="tg-x" onClick={() => removeDevice(d.id)}>حذف</button>
          </div>
        ))}
        <div className="tg-add">
          <input type="text" placeholder="برچسب" value={newDevice.label} onChange={(e) => setNewDevice((n) => ({ ...n, label: e.target.value }))} />
          <input type="text" placeholder="Chat ID" value={newDevice.chatId} onChange={(e) => setNewDevice((n) => ({ ...n, chatId: e.target.value }))} />
          <button className="btn-secondary" onClick={addDevice}>افزودن</button>
        </div>
      </section>

      <section className="tg-block">
        <h4>کدام اعلان‌ها ارسال شوند؟</h4>
        <div className="tg-notif-head"><span>نوع</span><span>فعال</span><span>بی‌صدا</span></div>
        {TELEGRAM_NOTIFICATION_TYPES.map((t) => {
          const cfg = (tg.notifications && tg.notifications[t.key]) || {};
          return (
            <div key={t.key} className="tg-notif-row">
              <span className="tg-notif-label">{t.label}</span>
              <input type="checkbox" className="toggle" checked={cfg.enabled !== false} onChange={(e) => setNotif(t.key, 'enabled', e.target.checked)} />
              <input type="checkbox" className="toggle" checked={!!cfg.silent} onChange={(e) => setNotif(t.key, 'silent', e.target.checked)} />
            </div>
          );
        })}
        <div className="tg-field" style={{ marginTop: '.7rem' }}>
          <label>⏱ ساعت ارسال «خلاصهٔ روزانه» (اختیاری — توسط سرور بات)</label>
          <input type="time" value={tg.dailySummaryTime || ''} onChange={(e) => patch({ dailySummaryTime: e.target.value })} style={{ maxWidth: '10rem' }} />
          <p className="help-text">اگر ساعتی تنظیم کنید و «خلاصهٔ روزانه» را فعال کرده باشید، هر روز سرِ این ساعت گزارش پیشرفت برایتان ارسال می‌شود (نیازمند اجرای سرور بات).</p>
        </div>
      </section>

      <section className="tg-block">
        <h4>یادآوری‌ها <small>(وقتی برنامه باز است)</small></h4>
        {(tg.reminders || []).length === 0 && <p className="help-text">یادآوری‌ای ثبت نشده.</p>}
        {(tg.reminders || []).map((r) => (
          <div key={r.id} className="tg-item">
            <input type="checkbox" className="toggle" checked={r.enabled !== false} onChange={(e) => toggleReminder(r.id, e.target.checked)} />
            <span className="tg-item-main"><code>{r.time}</code> {r.text}</span>
            <button className="tg-x" onClick={() => removeReminder(r.id)}>حذف</button>
          </div>
        ))}
        <div className="tg-add">
          <input type="time" value={newReminder.time} onChange={(e) => setNewReminder((n) => ({ ...n, time: e.target.value }))} />
          <input type="text" placeholder="متن یادآوری" value={newReminder.text} onChange={(e) => setNewReminder((n) => ({ ...n, text: e.target.value }))} />
          <button className="btn-secondary" onClick={addReminder}>افزودن</button>
        </div>
      </section>

      <section className="tg-block">
        <h4>عملیات</h4>
        <div className="tg-actions">
          <button className="btn-primary" disabled={!tg.botToken || busy} onClick={sendTest}>{busy === 'test' ? '...' : 'پیام آزمایشی + منو'}</button>
          <button className="btn-secondary" disabled={!tg.botToken || busy} onClick={sendStatus}>{busy === 'status' ? '...' : 'ارسال وضعیت'}</button>
          <button className="btn-secondary" disabled={!tg.botToken || busy} onClick={applyMenu}>{busy === 'menu' ? '...' : 'تنظیم منوی بات'}</button>
        </div>
      </section>

      {msg && (msg.kind === 'err' && isFirestoreSetupError(msg.text)
        ? <FirestoreSetupGuide projectId={FIREBASE_PROJECT_ID} />
        : <div className={`tg-banner ${msg.kind === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>)}

      <p className="help-text tg-foot">
        💬 وقتی این صفحه <b>باز</b> باشد و تلگرام فعال باشد، دستورها و دکمه‌های منوی پایین
        (وضعیت، پیشرفت، امروز، یادآوری…) همین‌جا پاسخ داده می‌شوند. برای پاسخ‌دهی <b>همیشگی</b>
        (حتی وقتی برنامه بسته است) «سرور بات» را اجرا کنید — راهنما در <code>server/README.md</code>.
      </p>
    </div>
  );
}
