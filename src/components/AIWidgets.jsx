// Reusable AI widgets used by the in-app features (tafsir, hifz helper, Q&A).
import React, { useState, useRef } from 'react';
import { isAIReady, chatComplete, resolveActiveAI } from '../lib/aiClient.js';
import { trackAIInteraction, AI_USE_CASE } from '../lib/analytics.js';

// A small button that, on click, runs buildPrompt() through the active AI and shows the answer
// in a collapsible panel. getConfig() returns the current AI config (so it is always fresh).
// `useCase` (AI_USE_CASE.*) tags the interaction for the outcome-rate metric.
export function AIAssistButton({ label = '✨ توضیح با هوش مصنوعی', title, getConfig, buildPrompt, compact, useCase = AI_USE_CASE.TAFSIR }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const abortRef = useRef(null);

  const ready = isAIReady(getConfig());

  const run = async () => {
    setOpen(true); setErr(''); setText(''); setLoading(true);
    try {
      const active = resolveActiveAI(getConfig());
      if (!active) throw new Error('هوش مصنوعی پیکربندی نشده است (تنظیمات → هوش مصنوعی).');
      const p = buildPrompt();
      const messages = [];
      if (p.system) messages.push({ role: 'system', content: p.system });
      messages.push({ role: 'user', content: p.user });
      abortRef.current = new AbortController();
      const out = await chatComplete(active.provider, active.key, active.model, messages, { maxTokens: p.maxTokens, temperature: p.temperature, signal: abortRef.current.signal });
      setText(out || '(پاسخی دریافت نشد)');
      trackAIInteraction(useCase);
    } catch (e) {
      setErr(e?.message || 'خطا در ارتباط با هوش مصنوعی');
    } finally { setLoading(false); }
  };

  return (
    <span className="ai-assist">
      <button type="button" className={compact ? 'btn-icon ai-btn' : 'btn-secondary ai-btn'} title={title || label}
        aria-label={title || label} aria-expanded={open} aria-haspopup="dialog"
        onClick={() => { if (!open) run(); else setOpen(false); }}>
        {compact ? '✨' : label}
      </button>
      {open && (
        <div className="ai-panel" dir="rtl">
          {!ready && !loading && !text && !err && (
            <p className="help-text">برای استفاده، در «تنظیمات → هوش مصنوعی» کلید و مدل را تنظیم کنید.</p>
          )}
          {loading && <p className="ai-loading">⏳ در حال پردازش…</p>}
          {err && <p className="ai-err">{err}</p>}
          {text && <div className="ai-answer">{text}</div>}
          <div className="ai-panel-actions">
            {text && <button className="btn-icon" title="کپی" onClick={() => navigator.clipboard?.writeText(text)}>📋</button>}
            {!loading && (text || err) && <button className="btn-icon" title="تلاش دوباره" onClick={run}>🔄</button>}
            <button className="btn-icon" title="بستن" onClick={() => setOpen(false)}>✕</button>
          </div>
        </div>
      )}
    </span>
  );
}

// A simple chat box for free-form Quran Q&A.
export function AIChat({ getConfig, buildPrompt }) {
  const [history, setHistory] = useState([]); // {role, content}
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const ready = isAIReady(getConfig());

  const send = async () => {
    const q = input.trim(); if (!q || loading) return;
    setErr(''); setInput('');
    const next = [...history, { role: 'user', content: q }];
    setHistory(next); setLoading(true);
    try {
      const active = resolveActiveAI(getConfig());
      if (!active) throw new Error('هوش مصنوعی پیکربندی نشده است (تنظیمات → هوش مصنوعی).');
      const p = buildPrompt({ question: q });
      const messages = [{ role: 'system', content: p.system }, ...history, { role: 'user', content: q }];
      const out = await chatComplete(active.provider, active.key, active.model, messages, { maxTokens: p.maxTokens });
      setHistory((h) => [...h, { role: 'assistant', content: out || '(پاسخی دریافت نشد)' }]);
      trackAIInteraction(AI_USE_CASE.QA);
    } catch (e) {
      setErr(e?.message || 'خطا');
      setHistory((h) => h.slice(0, -1));
      setInput(q);
    } finally { setLoading(false); }
  };

  return (
    <div className="ai-chat" dir="rtl" role="region" aria-label="گفت‌وگوی پرسش‌وپاسخ با هوش مصنوعی">
      {!ready && <p className="help-text">برای پرسش‌وپاسخ، در «تنظیمات → هوش مصنوعی» کلید و مدل را تنظیم کنید.</p>}
      <div className="ai-chat-log" role="log" aria-live="polite">
        {history.length === 0 && <p className="help-text">سوال خود دربارهٔ قرآن را بنویسید…</p>}
        {history.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role === 'user' ? 'me' : 'bot'}`}>{m.content}</div>
        ))}
        {loading && <div className="ai-msg bot ai-loading">⏳ …</div>}
      </div>
      {err && <p className="ai-err" role="alert">{err}</p>}
      <div className="ai-chat-input">
        <input type="text" value={input} placeholder="پرسش خود دربارهٔ قرآن را بنویسید و Enter بزنید…" aria-label="متن سوال شما"
          disabled={!ready || loading}
          onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
        <button className="btn-primary" disabled={!ready || loading || !input.trim()} onClick={send}>ارسال</button>
      </div>
    </div>
  );
}
