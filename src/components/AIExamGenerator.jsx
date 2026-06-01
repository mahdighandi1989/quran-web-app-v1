// AI-powered exam-question generator (Exam tab). Picks ayahs from the dataset (optionally a
// surah), asks the model for strict-JSON questions, then renders a self-check quiz.
import React, { useState } from 'react';
import { isAIReady, resolveActiveAI, chatComplete } from '../lib/aiClient.js';
import { examGenPrompt, parseJsonArray } from '../lib/aiTasks.js';

const toFa = (n) => String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);

export default function AIExamGenerator({ getConfig, dataset = [], surahOptions = [] }) {
  const [surah, setSurah] = useState('');
  const [count, setCount] = useState(5);
  const [type, setType] = useState('mcq');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [questions, setQuestions] = useState(null);
  const [answers, setAnswers] = useState({});
  const [revealed, setRevealed] = useState(false);
  const ready = isAIReady(getConfig());

  const pickAyahs = () => {
    let pool = dataset;
    if (surah) pool = dataset.filter((a) => String(a.surah_number) === String(surah));
    const withText = pool.filter((a) => (a.tokens_with_diacritics || a.tokens_plain || a.tokens || []).length);
    const src = withText.length ? withText : pool;
    const shuffled = src.slice().sort(() => Math.random() - 0.5).slice(0, Math.min(40, Math.max(count * 3, 10)));
    return shuffled.map((a) => ({
      surah: a.surah_number, surahName: a.surah_name, ayah: a.ayah_number,
      text: (a.tokens_with_diacritics || a.tokens_plain || a.tokens || []).join(' '),
    }));
  };

  const generate = async () => {
    setErr(''); setQuestions(null); setAnswers({}); setRevealed(false); setLoading(true);
    try {
      const active = resolveActiveAI(getConfig());
      if (!active) throw new Error('هوش مصنوعی پیکربندی نشده است (تنظیمات → هوش مصنوعی).');
      const ayahs = pickAyahs();
      if (!ayahs.length) throw new Error('آیه‌ای برای ساخت سوال یافت نشد. ابتدا دیتاست را بارگذاری کنید.');
      const p = examGenPrompt({ ayahs, count, type });
      const out = await chatComplete(active.provider, active.key, active.model,
        [{ role: 'system', content: p.system }, { role: 'user', content: p.user }],
        { maxTokens: p.maxTokens, temperature: p.temperature });
      const arr = parseJsonArray(out).slice(0, count);
      if (!arr.length) throw new Error('خروجی مدل قابل‌خواندن نبود. دوباره تلاش کنید یا مدل دیگری انتخاب کنید.');
      setQuestions(arr);
    } catch (e) { setErr(e?.message || 'خطا'); } finally { setLoading(false); }
  };

  const score = questions && revealed && type === 'mcq'
    ? questions.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0)
    : null;

  return (
    <div className="card">
      <h2 className="card-title">🤖 ساخت آزمون با هوش مصنوعی</h2>
      {!ready && <p className="help-text">برای استفاده، در «تنظیمات → هوش مصنوعی» کلید و مدل را تنظیم کنید.</p>}
      <div className="exam-start-controls">
        <div className="form-group-inline"><label>سوره:</label>
          <select className="form-select" value={surah} onChange={(e) => setSurah(e.target.value)}>
            <option value="">همه</option>
            {surahOptions.map(([num, name]) => <option key={num} value={num}>{name}</option>)}
          </select>
        </div>
        <div className="form-group-inline"><label>تعداد:</label>
          <input type="number" min={1} max={15} value={count} onChange={(e) => setCount(Math.max(1, Math.min(15, +e.target.value || 5)))} className="form-input-small" />
        </div>
        <div className="form-group-inline"><label>نوع:</label>
          <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="mcq">چهارگزینه‌ای</option>
            <option value="fill">جای‌خالی</option>
          </select>
        </div>
        <button className="btn-primary" disabled={!ready || loading} onClick={generate}>{loading ? '⏳ در حال ساخت…' : 'بساز'}</button>
      </div>

      {err && <p className="ai-err" style={{ marginTop: '.6rem' }}>{err}</p>}

      {questions && (
        <div style={{ marginTop: '1rem' }}>
          {questions.map((q, i) => (
            <div key={i} className="ai-quiz-q">
              <p className="ai-quiz-stem"><b>{toFa(i + 1)}.</b> {q.q} {q.ref && <span className="help-text">({q.ref})</span>}</p>
              {type === 'mcq' && Array.isArray(q.choices) ? (
                <div className="ai-quiz-choices">
                  {q.choices.map((c, ci) => {
                    const chosen = answers[i] === ci;
                    const correct = revealed && ci === q.answer;
                    const wrong = revealed && chosen && ci !== q.answer;
                    return (
                      <button key={ci} className={`ai-choice ${chosen ? 'chosen' : ''} ${correct ? 'correct' : ''} ${wrong ? 'wrong' : ''}`}
                        disabled={revealed} onClick={() => setAnswers((a) => ({ ...a, [i]: ci }))}>
                        {c}{correct ? ' ✓' : ''}{wrong ? ' ✗' : ''}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="ai-quiz-fill">
                  {revealed ? <span className="badge-pill" style={{ background: '#dcfce7', color: '#166534' }}>پاسخ: {q.answer}</span>
                    : <span className="help-text">جای خالی را در ذهن پر کنید، سپس «نمایش پاسخ‌ها».</span>}
                </div>
              )}
            </div>
          ))}
          <div className="card-actions" style={{ marginTop: '.6rem', display: 'flex', gap: '.5rem' }}>
            {!revealed ? <button className="btn-primary" onClick={() => setRevealed(true)}>نمایش پاسخ‌ها</button>
              : <button className="btn-secondary" onClick={generate}>آزمون جدید</button>}
            {score != null && <span className="badge-pill" style={{ background: 'var(--primary-color-light)', color: 'var(--primary-color)', alignSelf: 'center' }}>نمره: {toFa(score)}/{toFa(questions.length)}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
