// «🔗 اتصالِ امن» — proves a Telegram chat belongs to THIS account before the server bot answers it or
// sends it reminders (server/telegramLink.mjs). The app asks the server for a one-time code; the chat
// sends `/start <code>` to the bot (or opens the t.me link); the server records the link. Typing a chat
// id into the settings is no longer enough for the server bot — anyone could type someone else's.
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/inspectionApi.js';

export const requestLinkCode = () => api('/api/telegram/link-code', { method: 'POST', body: {} });
export const listLinks = () => api('/api/telegram/links');

export default function TelegramLink({ user, chatIds = [] }) {
  const [links, setLinks] = useState(null);
  const [code, setCode] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => listLinks().then((d) => setLinks(d.links || [])).catch((e) => setErr(e.message)), []);
  useEffect(() => { if (user) load(); }, [user, load]);
  if (!user) return null;
  const linked = new Set((links || []).map((l) => String(l.chatId)));
  const ids = [...new Set(chatIds.filter(Boolean).map(String))];
  const get = async () => {
    setBusy(true); setErr('');
    try { setCode(await requestLinkCode()); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <section className="tg-block" data-testid="tg-link">
      <h4>🔗 اتصالِ امن به باتِ برنامه</h4>
      <p className="help-text">
        باتِ سرور فقط به چتی جواب می‌دهد و یادآوری می‌فرستد که مالکیتش ثابت شده باشد. دکمه را بزنید و پیوند را در تلگرام
        باز کنید (یا <code>/start کد</code> را برای بات بفرستید). کد ۱۵ دقیقه و فقط یک بار معتبر است.
      </p>
      <div className="tg-actions">
        <button className="btn-secondary" disabled={busy} onClick={get}>{busy ? '...' : '🔗 اتصالِ امنِ این حساب'}</button>
        <button className="btn-secondary" onClick={load}>↻ وضعیت</button>
      </div>
      {code && (
        <p className="tg-code" data-testid="tg-link-code">
          {code.deepLink ? <a href={code.deepLink} target="_blank" rel="noopener noreferrer">باز کردن در تلگرام</a> : null}
          {' '}یا بفرستید: <code dir="ltr">/start {code.code}</code>
        </p>
      )}
      {ids.length > 0 && links && (
        <ul className="tg-linked">
          {ids.map((id) => <li key={id}><code>{id}</code> — {linked.has(id) ? '✓ تأییدشده' : '✗ تأییدنشده (باتِ سرور به آن جواب نمی‌دهد)'}</li>)}
        </ul>
      )}
      {err && <p className="tg-warn">{err}</p>}
    </section>
  );
}
