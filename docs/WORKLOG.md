# WORKLOG — دفترِ کار

> **قالب.** هر کار یک بخشِ تازه **در انتهای** همین فایل (جدیدترین پایین؛ هیچ ورودیِ قبلی پاک نمی‌شود):
>
> ```
> ## (شماره) YYYY-MM-DD — عنوانِ کوتاه
> - [OWNER] خواستهٔ مالک (نقلِ کوتاه)
> - [FINDING] چیزی که دیده/اندازه گرفته شد (با مدرک: فرمان، خروجی، کامیت)
> - [DECISION] تصمیم — چرا؛ گزینه‌های ردشده: … (و چرا)
> - [CHANGE] چه عوض شد (فایل‌ها)
> - [VERIFY] چگونه سنجیده شد (تست، بیلد، production)
> - [REVERT] اگر برگشت لازم شد، چطور
> - [CORRECTION] اصلاحِ ادعای غلطِ قبلی (به شمارهٔ آن ارجاع بده)
> - [TODO] / [BLOCKED] چه ماند و چرا؛ چه از مالک لازم است
> > **امضا:** `agent-id` · YYYY-MM-DD · یک خط: چگونه راستی‌آزمایی شد
> ```

## (۱) 2026-11-02 — زیرساختِ مستندات و ارسالِ خودکار

- [OWNER] «مستندسازی و ارسالِ خودکار مثلِ Detective-1: CLAUDE.md/AGENTS.md، scripts/ship.sh، hook ِ Stop، WORKLOG،
  جزوهٔ زنده، experiences الزام‌آور، docs_gate؛ بعد از هر کار خودت ship کن و مستقیم به main برو؛ prompt/ دست نزن؛
  هیچ قابلیتی حذف نمی‌شود؛ health ping مدرک نیست.» (پیامِ هماهنگ‌کنندهٔ مالک، 2026-11-02)
- [FINDING] خوانده‌شده در ریپو: README.md، server/README.md، render.yaml، package.json، server/package.json،
  firestore.rules، .gitignore، .env.example، static.json، vite/vitest config، pyproject.toml، experiences/README.md،
  TO-DO/، src/main.jsx، src/routes.jsx، src/lib/firebase.js، src/App.jsx (بخشِ ورود/درایو/تلگرام/AI)، server/telegram-bot.mjs،
  server/ai-proxy.mjs، server/ai.mjs، فهرستِ کاملِ فایل‌ها و git log. از Detective-1: CLAUDE.md، AGENTS.md، ship.sh،
  docs_gate.py، hook ِ Stop، docs/supervisor/*، models_inspection.py، routers/inspection.py (مسیرها و نگهبان‌ها)، scripts/supervisor/*.
- [FINDING] پایه پیش از هر تغییر: `npx vitest run` ⇒ ۳۰ فایل / ۳۰۴ تست سبز؛ `npm run build` سبز (هشدار: bundle ‏۹۲۷KB > 500KB)؛
  `pytest` سبز (پس از نصبِ pytest). مستنداتی مثلِ CLAUDE.md/AGENTS.md/WORKLOG/ship.sh وجود نداشت؛ `experiences/` فقط README داشت.
- [FINDING] Render (فقط‌خواندنی از API): `quran-web-app` (static) آخرین deploy ِ live `83ea0fc` در 2026-06-06 — کامیت‌های بعدی main
  فقط `prompt/` و یک workflow ِ حذف‌شده را عوض کرده‌اند، پس کدِ live با main یکی است. `quran-telegram-bot` live روی `7893f53`
  با پلنِ **starter (پولی)** درحالی‌که render.yaml می‌گوید `plan: free`. سرویس‌ها دستی ساخته شده‌اند (نه blueprint): بیلدِ سایت
  `npx vite build --base=/ && echo '/* /index.html 200' > dist/_redirects` است و هیچ rewrite ِ Render ندارد ⇒ `/settings` با
  HTTP 404 جواب می‌دهد و فقط ترفندِ `public/404.html` مرورگر را برمی‌گرداند. هشدارِ «Payment failed» از API دیده نمی‌شود.
- [FINDING] امنیت/حریم: اسکریپتِ «Inspector Bridge» در `index.html` پشتِ `VITE_ENABLE_INSPECTOR_BRIDGE` است، اما دو کپیِ **بی‌شرط** در
  `src/main.jsx` و `src/App.jsx` دارد و در bundle ِ production هست (`grep` روی dist) — console/fetch/XHR را هوک می‌کند و در iframe با
  `postMessage(…,'*')` به والد می‌فرستد. README خلافش را می‌گوید. (رفع در بخشِ ۳.)
- [DECISION] ship.sh: vitest + build + `node --test server/test/` + pytest + docs_gate + چکِ «سورسِ پنهان‌شده با .gitignore»؛
  push با retry، ادغامِ main و بدونِ force. گزینه‌های ردشده: GitHub Actions به‌جای اسکریپت (مالک گفته خودت بفرست؛ Actions در این
  ریپو ابزارِ بیرونیِ مالک را اجرا می‌کرد) · کپیِ عینیِ ship ِ Detective (بک‌اندِ پایتونی و Next ندارد).
- [DECISION] شناسهٔ امضا `Claude Code` (بی‌نامِ مدل) — قاعدهٔ محیط: هیچ شناسهٔ مدلی در چیزی که push می‌شود.
- [CHANGE] تازه: `AGENTS.md`، `CLAUDE.md`، `GEMINI.md`، `scripts/ship.sh`، `scripts/docs_gate.py`، `.claude/hooks/ensure-shipped.sh`،
  `docs/WORKLOG.md`، `docs/handbook/HANDBOOK.md`، `docs/handbook/PROGRESS.md`، دو درس در `experiences/`؛ `experiences/README.md`
  (فیلدِ `agents` و دروازه).
- [BLOCKED] ثبتِ hook در `.claude/settings.json`: ساختنِ این فایل را طبقه‌بندِ ایمنیِ محیطِ Claude Code («خودتغییری») رد کرد. اسکریپتِ hook
  ساخته و با ورودیِ آزمایشی تست شد (`{"decision":"block",…}`)؛ برای فعال‌شدن، مالک باید یک بار اجازهٔ ساختِ `.claude/settings.json` را بدهد
  (یا خودش این فایل را بسازد — متنش در HANDBOOK §9).
- [VERIFY] `python3 scripts/docs_gate.py` و `scripts/ship.sh` (همهٔ مراحل) پیش از push.
> **امضا:** `Claude Code` · 2026-11-02 · vitest 304/304، build، pytest، docs_gate سبز؛ hook با ورودیِ آزمایشی اجرا شد
