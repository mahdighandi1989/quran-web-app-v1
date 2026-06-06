// AI provider/key management panel for the Settings tab.
// - signed in: keys persist per-user in Firestore (config comes via props from App).
// - guest: keys live in memory only (App keeps them in state, never writes to Firestore),
//   so someone with their own key can use AI features without logging in.
import React, { useState } from 'react';
import {
  BUILTIN_PROVIDERS, PROVIDER_KINDS, allProviders, getProviderById,
  validateProviderKey, validateModel, isValidProviderBaseUrl, DEFAULT_AI,
} from '../lib/aiProviders.js';

const uid = () => 'p_' + Math.random().toString(36).slice(2, 8);

export default function AISettings({ config, setConfig, user, persisted }) {
  const ai = config || DEFAULT_AI;
  const providers = allProviders(ai);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [newProv, setNewProv] = useState({ name: '', baseUrl: '', kind: 'openai', keyHint: '', models: '' });
  const [newModel, setNewModel] = useState('');
  const [foundModels, setFoundModels] = useState(null);

  const active = getProviderById(ai, ai.activeProvider) || null;
  const patch = (p) => setConfig((c) => ({ ...c, ...p }));
  const setKey = (pid, val) => setConfig((c) => ({ ...c, keys: { ...c.keys, [pid]: val } }));
  const ok = (t) => setMsg({ kind: 'ok', text: t });
  const fail = (e) => setMsg({ kind: 'err', text: typeof e === 'string' ? e : (e?.message || 'خطا') });
  async function run(name, fn) { setBusy(name); setMsg(null); try { await fn(); } catch (e) { fail(e); } finally { setBusy(''); } }

  // models available for the active provider = its base models + user extras
  const modelsFor = (pid) => {
    const p = getProviderById(ai, pid); if (!p) return [];
    const extra = (ai.extraModels && ai.extraModels[pid]) || [];
    return [...new Set([...(p.models || []), ...extra])];
  };

  const validateKey = () => run('key', async () => {
    if (!active) { fail('ابتدا یک پروایدر انتخاب کنید.'); return; }
    const r = await validateProviderKey(active, ai.keys[active.id] || '');
    setFoundModels(r.models || null);
    ok(`کلید معتبر است ✓${r.models && r.models.length ? ` — ${r.models.length} مدل در دسترس` : ''}`);
  });

  const checkModel = () => run('model', async () => {
    if (!active) { fail('ابتدا یک پروایدر انتخاب کنید.'); return; }
    await validateModel(active, ai.keys[active.id] || '', ai.activeModel);
    ok(`مدل «${ai.activeModel}» پاسخ داد ✓`);
  });

  const addCustomProvider = () => run('add', async () => {
    if (!newProv.name.trim() || !newProv.baseUrl.trim()) { fail('نام و آدرس پایه (Base URL) لازم است.'); return; }
    // اعتبارسنجی Base URL: فقط آدرس‌های مطلقِ http(s) پذیرفته می‌شوند تا ورودی‌هایی مانند
    // javascript:، data:، file: یا رشته‌های نامعتبر هرگز ذخیره/فراخوانی نشوند.
    if (!isValidProviderBaseUrl(newProv.baseUrl)) {
      fail('آدرس پایه نامعتبر است. یک URL کامل با http:// یا https:// وارد کنید (مثلاً https://api.example.com/v1).');
      return;
    }
    const prov = {
      id: uid(), custom: true, name: newProv.name.trim(),
      baseUrl: newProv.baseUrl.trim().replace(/\/$/, ''),
      kind: PROVIDER_KINDS.includes(newProv.kind) ? newProv.kind : 'openai',
      keyHint: newProv.keyHint.trim() || 'key...',
      models: newProv.models.split(',').map((s) => s.trim()).filter(Boolean),
      docs: '',
    };
    setConfig((c) => ({ ...c, customProviders: [...(c.customProviders || []), prov], activeProvider: prov.id, activeModel: prov.models[0] || '' }));
    setNewProv({ name: '', baseUrl: '', kind: 'openai', keyHint: '', models: '' });
    ok(`پروایدر «${prov.name}» اضافه شد. حالا کلیدش را وارد و اعتبارسنجی کنید.`);
  });

  const removeProvider = (pid) => setConfig((c) => {
    const keys = { ...c.keys }; delete keys[pid];
    const extraModels = { ...c.extraModels }; delete extraModels[pid];
    return { ...c, customProviders: (c.customProviders || []).filter((p) => p.id !== pid), keys, extraModels,
      activeProvider: c.activeProvider === pid ? '' : c.activeProvider };
  });

  const addModel = () => run('addmodel', async () => {
    if (!active) { fail('ابتدا یک پروایدر انتخاب کنید.'); return; }
    const m = newModel.trim(); if (!m) return;
    // validate before adding (uses the active provider's key)
    await validateModel(active, ai.keys[active.id] || '', m);
    setConfig((c) => ({ ...c, extraModels: { ...c.extraModels, [active.id]: [...new Set([...((c.extraModels || {})[active.id] || []), m])] }, activeModel: m }));
    setNewModel('');
    ok(`مدل «${m}» اعتبارسنجی و اضافه شد ✓`);
  });

  const importFoundModels = () => {
    if (!active || !foundModels) return;
    setConfig((c) => ({ ...c, extraModels: { ...c.extraModels, [active.id]: [...new Set([...((c.extraModels || {})[active.id] || []), ...foundModels])] } }));
    ok(`${foundModels.length} مدل از سرویس به فهرست اضافه شد.`);
  };

  return (
    <div className="tg-card" dir="rtl">
      <div className="tg-head">
        <span className="tg-title">🧠 هوش مصنوعی (کلیدها و مدل‌ها)</span>
        <span className={`tg-badge ${active && ai.keys[active.id] ? 'on' : 'off'}`}>{active && ai.keys[active.id] ? 'پیکربندی‌شده' : 'تنظیم‌نشده'}</span>
      </div>

      {persisted ? (
        <p className="help-text">کلیدها روی سرور و مخصوص حساب «{user?.displayName || user?.email || 'شما'}» ذخیره می‌شوند و فقط پس از ورود دیده می‌شوند.</p>
      ) : (
        <p className="tg-warn">⚠️ شما وارد نشده‌اید: کلید فقط در همین نشست مرورگر نگه‌داری می‌شود و <b>ذخیره نمی‌شود</b>. برای ذخیرهٔ دائمی و امن، وارد حساب شوید.</p>
      )}

      <section className="tg-block">
        <h4>انتخاب پروایدر و مدل</h4>
        <div className="tg-field">
          <label>پروایدر</label>
          <select className="form-select" value={ai.activeProvider || ''} onChange={(e) => { const pid = e.target.value; const ms = modelsFor(pid); patch({ activeProvider: pid, activeModel: ms[0] || '' }); setFoundModels(null); setMsg(null); }}>
            <option value="">— انتخاب کنید —</option>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}{p.custom ? ' (سفارشی)' : ''}</option>)}
          </select>
        </div>

        {active && (
          <>
            <div className="tg-field">
              <label>کلید API {active.keyHint ? `(${active.keyHint})` : ''}</label>
              <div style={{ display: 'flex', gap: '.4rem' }}>
                <input type={showKey ? 'text' : 'password'} autoComplete="off" placeholder={active.keyHint || 'key...'} value={ai.keys[active.id] || ''} onChange={(e) => setKey(active.id, e.target.value.trim())} style={{ flex: 1 }} />
                <button className="btn-secondary" type="button" onClick={() => setShowKey((s) => !s)}>{showKey ? 'پنهان' : 'نمایش'}</button>
              </div>
              {active.docs && <p className="help-text">دریافت کلید: <a href={active.docs} target="_blank" rel="noreferrer">{active.docs}</a></p>}
            </div>

            <div className="tg-field">
              <label>مدل</label>
              <select className="form-select" value={ai.activeModel || ''} onChange={(e) => patch({ activeModel: e.target.value })}>
                <option value="">— انتخاب مدل —</option>
                {modelsFor(active.id).map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="tg-actions">
              <button className="btn-primary" disabled={!ai.keys[active.id] || busy} onClick={validateKey}>{busy === 'key' ? '...' : 'اعتبارسنجی کلید'}</button>
              <button className="btn-secondary" disabled={!ai.keys[active.id] || !ai.activeModel || busy} onClick={checkModel}>{busy === 'model' ? '...' : 'تست مدل'}</button>
              {foundModels && foundModels.length > 0 && <button className="btn-secondary" onClick={importFoundModels}>افزودن {foundModels.length} مدلِ یافت‌شده</button>}
              {active.custom && <button className="tg-x" onClick={() => removeProvider(active.id)}>حذف پروایدر</button>}
            </div>

            <div className="tg-add" style={{ marginTop: '.6rem' }}>
              <input type="text" placeholder="افزودن مدل جدید (مثلاً gpt-4o)" value={newModel} onChange={(e) => setNewModel(e.target.value)} />
              <button className="btn-secondary" disabled={!newModel.trim() || busy} onClick={addModel}>{busy === 'addmodel' ? '...' : 'اعتبارسنجی و افزودن مدل'}</button>
            </div>
          </>
        )}
      </section>

      <section className="tg-block">
        <h4>افزودن پروایدر سفارشی (سازگار با OpenAI/Anthropic/Gemini)</h4>
        <div className="tg-add">
          <input type="text" placeholder="نام" value={newProv.name} onChange={(e) => setNewProv((n) => ({ ...n, name: e.target.value }))} />
          <input type="text" placeholder="Base URL (مثلاً https://api.example.com/v1)" value={newProv.baseUrl} onChange={(e) => setNewProv((n) => ({ ...n, baseUrl: e.target.value }))} />
        </div>
        <div className="tg-add" style={{ marginTop: '.4rem' }}>
          <select className="form-select" value={newProv.kind} onChange={(e) => setNewProv((n) => ({ ...n, kind: e.target.value }))} style={{ flex: '0 0 10rem' }}>
            <option value="openai">سازگار با OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
          </select>
          <input type="text" placeholder="مدل‌ها (با کاما جدا کنید)" value={newProv.models} onChange={(e) => setNewProv((n) => ({ ...n, models: e.target.value }))} />
          <button className="btn-secondary" disabled={busy} onClick={addCustomProvider}>{busy === 'add' ? '...' : 'افزودن'}</button>
        </div>
        <p className="help-text">پس از افزودن، آن را از فهرست پروایدرها انتخاب کنید، کلیدش را وارد و «اعتبارسنجی کلید» را بزنید (اعتبارسنجی خودکار است).</p>
      </section>

      {msg && <div className={`tg-banner ${msg.kind === 'ok' ? 'ok' : 'err'}`}>{msg.text}</div>}

      <p className="help-text tg-foot">
        🔒 درخواست‌های هوش مصنوعی از طریق یک «پراکسی بک‌اند» امن ارسال می‌شوند و کلیدِ ذخیره‌شده روی سرور
        هرگز در مرورگر یا network tab دیده نمی‌شود. کاربران مهمان (واردنشده) هم می‌توانند با کلید موقتِ همین
        نشست از هوش مصنوعی استفاده کنند. جزئیات راه‌اندازی پراکسی در <code>server/README.md</code> آمده است.
      </p>
    </div>
  );
}
