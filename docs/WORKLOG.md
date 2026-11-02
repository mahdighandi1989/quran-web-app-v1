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

## (۲) 2026-11-02 — «نظارت و سرکشی» و ناظرِ خودکار

- [OWNER] «نظارت و سرکشی مثلِ Detective-1/ALLIN1، متناسب با Vite + Firebase + سرورِ نود: کادر روی هر صفحه + متن + پیوست؛
  پیوست هنگامِ آپلود به متن؛ status جدا از outcome؛ fixed بی‌تصویرِ بعد رد؛ تیک فقط مالک؛ برگهٔ غیرِادمین با تأییدِ ادمین؛
  حذفِ برگه ممنوع؛ صفِ فوری؛ حسابِ ناظر با SUPERVISOR_PASSWORD فقط در Render؛ دو Routine؛ PROMPT نسخه‌دار + archive/RUNLOG/OPEN_ITEMS؛
  شش قاعده؛ بازرسیِ بدبینانه و اجرایی؛ داده‌های موجود دست نخورد.»
- [FINDING] Detective-1 خوانده شد (models_inspection، routers/inspection، scripts/supervisor، PROMPT/URGENT_PROMPT). ALLIN1 خوانده نشد
  (Detective خودش «از روی ALLIN1» ساخته شده و مشخصات کامل بود).
- [DECISION] API روی سرویسِ موجودِ نود (`quran-telegram-bot`) و ذخیره در **همان Firestore** با Admin SDK؛ مجموعه‌های `inspection*` با
  default-deny ِ قواعد به روی مرورگر بسته‌اند و همهٔ نقش‌ها در سرور تعیین می‌شود. ردشده‌ها: (الف) نوشتنِ مستقیم از مرورگر با
  firestore.rules — قاعدهٔ «fixed بی‌تصویر رد»، «فایلِ نخوانده»، «ناظر تیک نزند» را نمی‌شود با rules مطمئن پیاده کرد؛ (ب) سرویسِ تازه
  روی Render — هزینه و یک سرویسِ دیگر برای نگه‌داشتن؛ (ج) بک‌اندِ پایتونیِ `backend/` — در production اجرا نمی‌شود.
- [DECISION] حسابِ ناظر بی‌گوگل: `SUPERVISOR_PASSWORD` ⇒ توکنِ HMAC ِ ۱۲ساعته (`Authorization: Supervisor …`)، ۵ ورودِ ناموفق/۱۵ دقیقه.
  مدیر = ایمیلِ **تأییدشده** در `ADMIN_EMAILS`. ردشده: custom token ِ Firebase برای ناظر (به محدودیتِ referrer ِ کلیدِ وب گیر می‌کند)؛
  نوشتنِ ایمیلِ مدیر در کد (قاعدهٔ امنیت).
- [DECISION] بایت‌ها در Firestore تکه‌های ۷۰۰KB (سقفِ ۱MiB سند و ۱۰MiB batch؛ دیسکِ Render با هر دیپلوی پاک می‌شود)؛ سقفِ پیوست ۲۰MB.
  استخراج: متن/کد، docx/xlsx/pptx، odt/ods/odp، epub، rtf، zip (تو در تو)، PDF با `unpdf@1.4.0` (بی‌وابستگی). صوت/ویدیو رونویسی ندارد ⇒
  `unsupported` و ناظر باید خودِ فایل را باز کند (OPEN_ITEMS ۲). ردشده: Google Drive (درایو در این اپ مالِ هر کاربر است، سرور
  دسترسی ندارد).
- [CHANGE] سرور: `server/inspection.mjs`، `server/lib/{auth,extract,zip,inspectionStore}.mjs`، اتصال در `telegram-bot.mjs`، `unpdf` در
  `server/package.json` (+ `server/package-lock.json`)، تست‌ها `server/test/`. فرانت: `src/components/InspectionLayer.jsx` (دکمهٔ «📝 نظارت»،
  کادرکشی، هایلایتِ نارنجی/سبز/آبی، عکسِ ناحیه با `html-to-image`)، `src/components/InspectionBoard.jsx` (تبِ «نظارت»، `/inspection`)،
  `src/lib/inspectionApi.js`، `src/lib/inspectionGeometry.js`، `src/App.jsx`. ناظر: `scripts/supervisor/{client,inspection,deploys,prod_check,screenshot}.py`،
  `docs/supervisor/*`. env: `ADMIN_EMAILS`، `SUPERVISOR_PASSWORD`، `ALLOWED_ORIGINS`، `VITE_INSPECTION_API_URL` در render.yaml و .env.example.
- [CHANGE] Render (سرویسِ `quran-telegram-bot`): `SUPERVISOR_PASSWORD` (تصادفی، مستقیم روی Render، هیچ‌جا چاپ نشد) و `ADMIN_EMAILS` افزوده شد.
- [CHANGE] روتین‌ها: دورِ کامل `trig_01UvNwtggi9d2xP4MtszJGpo` (دوشنبه/پنجشنبه ۰۴:۴۷ دبی، روشن)، صفِ فوری `trig_01Ut8dq6SDo5RG8pJiDrRStr`
  (ساعتی، **خاموش**). هر دو `sources: []` ساخته شدند (ابزار مخزن نمی‌گیرد).
- [VERIFY] `node --test`: ۱۵/۱۵ (نقش‌ها، ورودِ ناظر و محدودیتِ نرخ، pending/triage، fixed بی‌تصویر/بی‌کامیت/بی‌place/بی‌وابستگی رد، تیکِ ناظر ۴۰۳،
  زونکن، DELETE ⇒ ۴۰۵، بدهیِ خواندن تا آخرین نویسه + تصویرِ بازنشده، صفِ فوری با claim و بازگشت به جای قبلی، ویرایشِ فقط سمتِ خود، دسترسیِ
  تصویر، استخراجِ docx/xlsx/zip/pdf). vitest ۳۱۳/۳۱۳. جریانِ واقعیِ ناظر روی سرورِ محلی (حافظه): whoami ⇒ pull (خروج ۴) ⇒ urgent (۵) ⇒
  fixed بی‌عکس رد ⇒ با عکس/کامیت/place پذیرفته ⇒ تیکِ مالک ⇒ file ⇒ زونکنِ ۱. Chromium: `/inspection` برای مهمان «ابتدا وارد شوید» و دکمهٔ
  نظارت پنهان؛ `screenshot.py` روی production کار کرد.
- [BLOCKED] (مالک) هر دو روتین در claude.ai › Routines › Edit › «Select a repository» ⇒ `mahdighandi1989/quran-web-app-v1` ⇒ Save؛ سپس صفِ فوری را روشن کند.
- [TODO] پس از دیپلو: `prod_check.py` روی production (Firestore واقعی، ورودِ ناظر). دیده‌نشده تا این لحظه: UI ِ واردشده (ورودِ گوگل در
  محیطِ خودکار ممکن نیست) — مالک باید یک برگهٔ آزمایشی ثبت کند.
> **امضا:** `Claude Code` · 2026-11-02 · node --test 15/15، vitest 313/313، build، pytest، جریانِ کاملِ ناظر روی سرورِ محلی، Chromium
