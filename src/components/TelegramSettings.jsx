// Telegram integration panel for the Settings tab.
// Outbound features run entirely in the browser (send notifications, validate token, detect
// chat id, configure the bot's persistent menu, reminders while the app is open). Two-way
// control (commands FROM Telegram) needs the bot webhook server in server/telegram-bot.mjs.
import React, { useState } from 'react';
import {
  getMe, detectChatIds, setupBotMenu, sendMessage, notify,
  TELEGRAM_NOTIFICATION_TYPES, DEFAULT_TELEGRAM, resolveRecipients,
} from '../lib/telegram.js';

const uid = () => Math.random().toString(36).slice(2, 10);

export default function TelegramSettings({ settings, setSettings, sessions = [], dataset = [], pageStructure = [] }) {
  const tg = (settings && settings.telegram) || DEFAULT_TELEGRAM;
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null); // { kind: 'ok'|'err', text }
  const [detected, setDetected] = useState(null);
  const [newDevice, setNewDevice] = useState({ label: '', chatId: '' });
  const [newReminder, setNewReminder] = useState({ time: '08:00', text: '' });

  const patchTg = (patch) => setSettings((s) => ({ ...s, telegram: { ...s.telegram, ...patch } }));
  const setNotif = (key, field, val) =>
    setSettings((s) => ({
      ...s,
      telegram: {
        ...s.telegram,
        notifications: {
          ...s.telegram.notifications,
          [key]: { ...(s.telegram.notifications?.[key] || {}), [field]: val },
        },
      },
    }));

  const ok = (text) => setMsg({ kind: 'ok', text });
  const err = (e) => setMsg({ kind: 'err', text: typeof e === 'string' ? e : (e?.message || 'خطا') });

  async function run(name, fn) {
    setBusy(name); setMsg(null);
    try { await fn(); } catch (e) { err(e); } finally { setBusy(''); }
  }

  const validateToken = () => run('validate', async () => {
    const me = await getMe(tg.botToken);
    ok(`توکن معتبر است ✓ — بات: @${me.username} (${me.first_name})`);
  });

  const detect = () => run('detect', async () => {
    const list = await detectChatIds(tg.botToken);
    setDetected(list);
    if (!list.length) err('هیچ گفتگویی پیدا نشد. ابتدا در تلگرام به بات پیام «/start» بدهید، سپس دوباره تلاش کنید.');
    else ok(`${list.length} گفتگو پیدا شد — یکی را به‌عنوان chat ID انتخاب کنید.`);
  });

  const sendTest = () => run('test', async () => {
    const recips = resolveRecipients(tg);
    if (!recips.length) { err('ابتدا chat ID اصلی یا یک دستگاه اضافه کنید.'); return; }
    await Promise.all(recips.map((id) => sendMessage(tg.botToken, id, '✅ پیام آزمایشی از «مرکز حفظ قرآن».', { silent: false })));
    ok(`پیام آزمایشی به ${recips.length} مقصد ارسال شد.`);
  });

  const sendStatus = () => run('status', async () => {
    const text =
      '📊 <b>وضعیت برنامه</b>\n' +
      `• آیات دیتاست: ${dataset.length}\n` +
      `• صفحات حفظ: ${pageStructure.length}\n` +
      `• جلسات ثبت‌شده: ${sessions.length}\n` +
      `• زمان: ${new Date().toLocaleString('fa-IR')}`;
    const r = await notify(tg, 'daily_summary', text);
    if (r.skipped) err('اعلان «خلاصهٔ روزانه» غیرفعال است یا مقصدی تنظیم نشده.');
    else ok(`وضعیت به ${r.sent}/${r.total} مقصد ارسال شد.`);
  });

  const applyMenu = () => run('menu', async () => {
    await setupBotMenu(tg.botToken);
    ok('منوی دستورات بات تنظیم شد. در تلگرام دکمهٔ «منو» را ببینید. (برای عملکرد دکمه‌ها سرور بات لازم است.)');
  });

  const addDevice = () => {
    if (!newDevice.chatId.trim()) return;
    patchTg({ devices: [...(tg.devices || []), { id: uid(), label: newDevice.label.trim() || 'دستگاه', chatId: newDevice.chatId.trim(), enabled: true }] });
    setNewDevice({ label: '', chatId: '' });
  };
  const removeDevice = (id) => patchTg({ devices: (tg.devices || []).filter((d) => d.id !== id) });
  const toggleDevice = (id, en) => patchTg({ devices: (tg.devices || []).map((d) => d.id === id ? { ...d, enabled: en } : d) });

  const addReminder = () => {
    if (!newReminder.text.trim()) return;
    patchTg({ reminders: [...(tg.reminders || []), { id: uid(), time: newReminder.time, text: newReminder.text.trim(), enabled: true }] });
    setNewReminder({ time: '08:00', text: '' });
  };
  const removeReminder = (id) => patchTg({ reminders: (tg.reminders || []).filter((r) => r.id !== id) });
  const toggleReminder = (id, en) => patchTg({ reminders: (tg.reminders || []).map((r) => r.id === id ? { ...r, enabled: en } : r) });

  return (
    <div className="telegram-settings card" dir="rtl">
      <h3>🤖 اعلان‌ها و تعامل تلگرام</h3>

      <label className="form-group" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={!!tg.enabled} onChange={(e) => patchTg({ enabled: e.target.checked })} />
        <span>فعال‌سازی یکپارچه‌سازی تلگرام</span>
      </label>

      {/* --- Bot token + chat id --- */}
      <fieldset className="tg-section">
        <legend>اتصال بات</legend>
        <p className="help-text" style={{ color: '#b45309' }}>
          ⚠️ توکن بات یک «سِکرت» است و در این نسخهٔ بدون‌سرور در مرورگر شما ذخیره می‌شود
          (در repo کامیت نمی‌شود). برای استفادهٔ اشتراکی/امن، توکن را در سرور بات نگه‌دارید.
        </p>
        <div className="form-group">
          <label>توکن بات (BotFather)</label>
          <input type="password" autoComplete="off" placeholder="123456:ABC-..." value={tg.botToken || ''}
            onChange={(e) => patchTg({ botToken: e.target.value.trim() })} />
        </div>
        <div className="form-group">
          <label>Chat ID اصلی (شما)</label>
          <input type="text" placeholder="مثلاً 123456789" value={tg.primaryChatId || ''}
            onChange={(e) => patchTg({ primaryChatId: e.target.value.trim() })} />
        </div>
        <div className="tg-actions">
          <button className="btn-secondary" disabled={!tg.botToken || busy} onClick={validateToken}>{busy === 'validate' ? '...' : 'اعتبارسنجی توکن'}</button>
          <button className="btn-secondary" disabled={!tg.botToken || busy} onClick={detect}>{busy === 'detect' ? '...' : 'تشخیص Chat ID'}</button>
        </div>
        {detected && detected.length > 0 && (
          <div className="tg-detected">
            {detected.map((d) => (
              <button key={d.id} className="btn-chip" onClick={() => { patchTg({ primaryChatId: d.id }); setDetected(null); ok(`Chat ID روی ${d.id} (${d.title}) تنظیم شد.`); }}>
                {d.title} — <code>{d.id}</code>
              </button>
            ))}
          </div>
        )}
      </fieldset>

      {/* --- Other devices --- */}
      <fieldset className="tg-section">
        <legend>دستگاه‌ها / مقصدهای دیگر</legend>
        {(tg.devices || []).map((d) => (
          <div key={d.id} className="tg-row">
            <input type="checkbox" checked={d.enabled !== false} onChange={(e) => toggleDevice(d.id, e.target.checked)} />
            <span className="tg-row-label">{d.label}</span>
            <code>{d.chatId}</code>
            <button className="btn-danger-sm" onClick={() => removeDevice(d.id)}>حذف</button>
          </div>
        ))}
        <div className="tg-row">
          <input type="text" placeholder="برچسب" value={newDevice.label} onChange={(e) => setNewDevice((n) => ({ ...n, label: e.target.value }))} />
          <input type="text" placeholder="Chat ID" value={newDevice.chatId} onChange={(e) => setNewDevice((n) => ({ ...n, chatId: e.target.value }))} />
          <button className="btn-secondary" onClick={addDevice}>افزودن دستگاه</button>
        </div>
      </fieldset>

      {/* --- Notification types --- */}
      <fieldset className="tg-section">
        <legend>کدام اعلان‌ها ارسال شوند؟</legend>
        <table className="tg-table">
          <thead><tr><th>نوع</th><th>فعال</th><th>بی‌صدا</th></tr></thead>
          <tbody>
            {TELEGRAM_NOTIFICATION_TYPES.map((t) => {
              const cfg = (tg.notifications && tg.notifications[t.key]) || {};
              return (
                <tr key={t.key}>
                  <td>{t.label}</td>
                  <td><input type="checkbox" checked={cfg.enabled !== false} onChange={(e) => setNotif(t.key, 'enabled', e.target.checked)} /></td>
                  <td><input type="checkbox" checked={!!cfg.silent} onChange={(e) => setNotif(t.key, 'silent', e.target.checked)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </fieldset>

      {/* --- Reminders --- */}
      <fieldset className="tg-section">
        <legend>یادآوری‌ها (وقتی برنامه باز است)</legend>
        {(tg.reminders || []).map((r) => (
          <div key={r.id} className="tg-row">
            <input type="checkbox" checked={r.enabled !== false} onChange={(e) => toggleReminder(r.id, e.target.checked)} />
            <code>{r.time}</code>
            <span className="tg-row-label">{r.text}</span>
            <button className="btn-danger-sm" onClick={() => removeReminder(r.id)}>حذف</button>
          </div>
        ))}
        <div className="tg-row">
          <input type="time" value={newReminder.time} onChange={(e) => setNewReminder((n) => ({ ...n, time: e.target.value }))} />
          <input type="text" placeholder="متن یادآوری" value={newReminder.text} onChange={(e) => setNewReminder((n) => ({ ...n, text: e.target.value }))} />
          <button className="btn-secondary" onClick={addReminder}>افزودن یادآوری</button>
        </div>
        <p className="help-text">یادآوری‌های زمان‌بسته به مرورگرِ بازِ برنامه فرستاده می‌شوند. برای یادآوری وقتی برنامه بسته است، سرور بات لازم است.</p>
      </fieldset>

      {/* --- Bot menu + actions --- */}
      <fieldset className="tg-section">
        <legend>عملیات</legend>
        <div className="tg-actions">
          <button className="btn-primary" disabled={!tg.botToken || busy} onClick={sendTest}>{busy === 'test' ? '...' : 'ارسال پیام آزمایشی'}</button>
          <button className="btn-secondary" disabled={!tg.botToken || busy} onClick={sendStatus}>{busy === 'status' ? '...' : 'ارسال وضعیت فعلی'}</button>
          <button className="btn-secondary" disabled={!tg.botToken || busy} onClick={applyMenu}>{busy === 'menu' ? '...' : 'تنظیم منوی بات'}</button>
        </div>
      </fieldset>

      {msg && (
        <div className={msg.kind === 'ok' ? 'tg-ok' : 'tg-err'} role="status">{msg.text}</div>
      )}

      <p className="help-text" style={{ marginTop: 12 }}>
        کنترل دوطرفه (اجرای دستورها از داخل تلگرام و عملکرد دکمه‌های منو) نیازمند راه‌اندازی
        «سرور بات» است — راهنما در <code>server/telegram-bot.mjs</code> و <code>TO-DO/</code>.
      </p>
    </div>
  );
}
