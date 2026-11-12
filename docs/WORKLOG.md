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

## (۳) 2026-11-02 — بررسیِ ذخیره‌سازی، امنیت و ورود/مدیر + اصلاح‌ها

- [OWNER] «ذخیره‌سازی درست کار می‌کند؟ تناقض‌ها، ضعف‌ها، امنیت (rules، کلیدها، CORS، rate limit، بات، ai-proxy، ورودی‌ها)؛ مسیرِ
  ورود و نقشِ ادمین را از سر تا ته تست و رفع کن.»
- [FINDING] production پس از دیپلوی ِ (۲): هر دو سرویس روی `5d3f5c0` live؛ `/api/me` ⇒ Firestore وصل، ADMIN_EMAILS و SUPERVISOR_PASSWORD
  تنظیم؛ `inspection.py whoami/pull/urgent` روی production کدِ ۰ (صف خالی). `prod_check.py` سه مشکلِ واقعی داد (پایین).
- [FINDING] قواعدِ Firestore **منتشر شده‌اند**: خواندنِ بی‌احراز از `appState/…`، `telegramConfigs`، `aiConfigs`، `inspectionReports` ⇒ 403.
  دامنهٔ سایت در Authorized domains ِ Firebase هست. کلیدِ وب ِ Firebase **محدودیتِ referrer ندارد** (درخواستِ بی‌referrer ⇒ 200) — TO-DO ِ قبلیِ مالک.
- [FINDING] امنیت — رفع شد: (الف) **SSRF** در پراکسیِ AI: آدرسِ پایهٔ مهمان (و پروایدرِ سفارشیِ ذخیره‌شده) هر جایی را fetch می‌کرد؛
  production با `http://169.254.169.254` ⇒ 502 (یعنی تلاش کرد). (ب) CORS ِ پراکسی `*` بود و rate limit نداشت. (ج) پاسخ‌های بات با
  `parse_mode: HTML` متنِ AI/آیه/یادآوری را بی‌escape می‌فرستادند ⇒ یک `<` کلِ پیام را بی‌صدا رد می‌کرد (هم سرور، هم پاسخ‌گوی داخلِ
  مرورگر). (د) Inspector Bridge در `main.jsx`، `App.jsx` و `public/404.html` بی‌شرط بود (هوکِ console/fetch/XHR و postMessage به والد).
- [FINDING] امنیت — گزارش، رفع‌نشده (ساختاری): هر کاربر می‌تواند chat id ِ **دیگری** را در سندِ خودش بگذارد؛ بات با `array-contains … limit(1)`
  آن چت را به حسابِ تصادفی وصل می‌کند (اتصال بی‌اثباتِ مالکیت). راهِ درست: کدِ تأییدِ یک‌بار مصرف از `/start`. `storage-health` تعدادِ
  ادعاهای تکراری را می‌شمارد. Drive scope کامل (`drive`) است، نه `drive.file` — تغییرش بی‌آزمونِ واقعی ممکن است پشتیبان‌های موجود را نامرئی کند.
- [FINDING] ذخیره‌سازی — رفع شد: (الف) هنگامِ ورود نسخهٔ درایو **جایگزینِ** جلسه‌ها و نشان‌شده‌های محلی می‌شد ⇒ تمرینی که بیرونِ همگامی
  ثبت شده بود از دست می‌رفت. (ب) دو «هدفِ روزانه»: اسلایدر `settings.dailyGoal` و `telegramConfigs.dailyGoal` (اعلانِ «هدف محقق شد» و `/goal`
  بات) — دومی پیش‌فرض نداشت ⇒ اعلانِ هدف **هرگز** فعال نمی‌شد و `/goal` در برنامه اعمال نمی‌شد با اینکه بات می‌گفت «اعمال می‌شود».
  (ج) پانویسِ برنامه می‌گفت «تمامِ داده‌ها در مرورگر» درحالی‌که درایو/Firestore هم هست.
- [FINDING] ذخیره‌سازی — گزارش: `saveTelegramConfig` کلِ سند را `setDoc` می‌کند و بات با merge می‌نویسد؛ پنجرهٔ رقابتِ کوچک (ویرایشِ هم‌زمانِ
  کاربر و `/remind`). `localStorage` جلسه‌ها را به ۸۰ تای آخر می‌بُرد (کاملش در درایو). بررسیِ تجمیعیِ دادهٔ production را با کلیدِ
  service account از محیطِ خودم طبقه‌بندِ ایمنی رد کرد (درست) ⇒ به‌جایش endpoint ِ فقط‌خواندنی و فقط‌تجمیعیِ `/api/inspection/storage-health`
  (مدیر/ناظر) روی خودِ سرور ساخته شد؛ `prod_check` آن را می‌خواند.
- [FINDING] ورود: popup ⇒ در صورتِ شکست redirect؛ چون دامنهٔ اپ ≠ authDomain، redirect در مرورگرهای امروزی ممکن است بی‌کاربر برگردد و
  اپ بی‌صدا دوباره «ورود» نشان می‌داد. توضیحِ `firebase.js` با کد تناقض داشت (می‌گفت Drive در ورود خواسته نمی‌شود؛ می‌شود). مدیر پیش از
  این در کد وجود نداشت.
- [DECISION] SSRF: نگهبان در `server/lib/netguard.mjs` و در **خودِ** `chat()` ِ `ai.mjs` (پراکسی و بات هر دو) — https، بی‌اعتبارنامه در URL،
  همهٔ آدرس‌های resolveشده عمومی. ردشده: فهرستِ سفیدِ میزبان‌ها (قابلیتِ «پروایدرِ سفارشی» را حذف می‌کرد — قاعدهٔ «هیچ قابلیتی حذف نمی‌شود»).
- [DECISION] Drive: اجتماعِ جلسه‌ها با id و نشان‌شده‌ها با کلید؛ نشانگرِ همگام = نسخهٔ درایو تا ادغام آپلود شود. ردشده: «محلی برنده»
  (دستگاهِ کهنه درایو را بازنویسی می‌کرد)؛ ادغامِ دیتاست (حجیم و جایگزینی‌اش عمدی است).
- [DECISION] Bridge قرنطینه شد، حذف نشد (پشتِ همان پرچمِ `VITE_ENABLE_INSPECTOR_BRIDGE`؛ 404.html با `window.__ENABLE_INSPECTOR_BRIDGE__`).
- [CHANGE] `server/lib/netguard.mjs` (تازه)، `server/ai-proxy.mjs` (CORS per-request از `ALLOWED_ORIGINS`، ۳۰ درخواست/دقیقه/IP، SSRF)، `server/ai.mjs`،
  `server/telegram-bot.mjs` (`esc()` + لاگِ ردِ تلگرام، BUILD_TAG build8، storage-health)، `server/inspection.mjs` (`storageHealth`)،
  `src/lib/telegramCommands.js` (`escapeHtml`)، `src/lib/drive.js` (`mergeSessions`/`mergeFlags`)، `src/App.jsx` (ادغامِ درایو، یکی‌کردنِ هدف، پیامِ
  شکستِ redirect، نشانِ «👑 مدیر» از `/api/me`، پانویس)، `src/lib/firebase.js` (`[CORRECTION]` ِ توضیح)، `src/main.jsx`، `public/404.html`،
  `scripts/supervisor/prod_check.py`، README. تست‌ها: `server/test/security.test.mjs`، `src/test/driveMerge.test.js`، `src/test/adminRole.test.jsx`،
  افزوده به `inspectorBridge.regression.test.js`، `telegramCommands.test.js`، `server/test/inspection.test.mjs`.
- [VERIFY] node --test ۲۲/۲۲؛ vitest (همه)؛ build؛ bundle ِ production دیگر «Inspector Bridge» ندارد (grep روی dist). پس از دیپلو: `prod_check.py`.
- [TODO] (مالک) محدودکردنِ کلیدِ وب در Google Cloud (HTTP referrer = دامنهٔ سایت)؛ تصمیم دربارهٔ تأییدِ مالکیتِ chat id؛ rewrite ِ `/*` در Render.
> **امضا:** `Claude Code` · 2026-11-02 · node --test 22/22، vitest، build، grep ِ bundle، probeهای فقط‌خواندنیِ Firestore/Auth روی production

## (۴) 2026-11-02 — ناسازگاریِ مستندات با واقعیتِ Render + تأییدِ production

- [FINDING] پس از دیپلو ِ `21a6026`: `prod_check.py` ⇒ پراکسیِ AI آدرسِ داخلی را با ۴۰۰ رد کرد (بی‌fetch)، bundle بی‌Inspector Bridge، وبهوک
  بی‌secret ⇒ ۴۰۱، جریانِ ناظر سالم، `storage-health`: ۱ سندِ تلگرام با فهرستِ chat id ِ هم‌گام، ۰ ادعای تکراری، ۰ سندِ بی‌کاربر، ۲ کاربرِ Auth،
  `quranSamples` ‏≈۲۶۷KB (زیرِ ۱MB). تنها مشکلِ باقی P3: پیوندِ مستقیم ⇒ HTTP 404 (rewrite در Render نیست).
- [CORRECTION] `render.yaml` می‌گفت `plan: free`؛ سرویسِ واقعی starter است و هر دو سرویس دستی ساخته شده‌اند (blueprint آن‌ها را نمی‌راند).
  توضیحِ سرِ `telegram-bot.mjs` («فقط firebase-admin») و README ِ سرور هم با واقعیت هم‌خوان شد.
- [CHANGE] `render.yaml`، `server/README.md`، `server/telegram-bot.mjs` (فقط توضیح).
> **امضا:** `Claude Code` · 2026-11-02 · deploys.py (هر دو live روی 21a6026) و prod_check.py روی production

## (۵) 2026-11-02 — بازبینیِ مستقلِ کدِ «نظارت» و رفعِ یافته‌ها

- [FINDING] یک بازبینِ مستقل (زیرعاملِ Claude Code، فقط‌خواندنی، با اسکریپتِ آزمایشی) این‌ها را **بازتولید** کرد: (۱) zip ِ ۴۰KB با ۱۲ مدخلِ
  هم‌داده و اندازهٔ اعلام‌شدهٔ دروغ ⇒ ۱٫۶GB RAM (هر کاربرِ واردشده می‌توانست سرور را OOM کند)؛ (۲) XSS ِ ذخیره‌شده: پیوستِ `text/html`/SVG
  به‌صورتِ `blob:` در **همان origin** باز می‌شد (دسترسی به نشستِ ورودِ مدیر)، و `spot.path` ِ `javascript:` در پیوندِ صفحه؛ (۳) دورزدنِ ضدِ SSRF با
  `[::ffff:7f00:1]`، `[::ffff:a9fe:a9fe]`، `[::7f00:1]`، `[64:ff9b::7f00:1]` و با redirect ِ ۳۰۲؛ (۴) متنِ استخراج‌شدهٔ بزرگ در سندِ Firestore (سقفِ
  ۱MiB) ⇒ ۵۰۰ پس از ذخیرهٔ بایت‌ها؛ (۵) محدودیتِ ورودِ ناظر با `X-Forwarded-For` ِ جعلی دور زده می‌شد؛ (۶) فارسیِ شکسته بینِ تکه‌های بدنه (`body += chunk`)؛
  بدنه‌های ۸–۳۰MB پیش از احراز خوانده می‌شد؛ (۷) `file_ids` ِ نامعتبر ⇒ ۵۰۰ پس از ثبتِ یادداشت (تکرار با retry)؛ (۸) شمارهٔ زونکن بیرون از تراکنش
  و چکِ «پیوستِ نخوانده» بیرون از تراکنش؛ (۹) snapshot ِ تلگرام در میانهٔ debounce اسلایدرِ هدف را برمی‌گرداند؛ (۱۰) اسکریپتِ پایتون برای HTML/قطعِ
  جریان کدِ ۱ و traceback می‌داد نه ۳؛ (۱۱) ریزها: `editNote` روی سندِ ناپدید ۵۰۰، بدنهٔ `null` ۵۰۰، نامِ مدل/پروایدر در `/status` بی‌escape.
  تأییدشده‌ها: دسترسیِ متقابلِ کاربران، نقش‌های ناظر و دورزدنِ بدهیِ خواندن **سالم** بودند.
- [CHANGE] `server/lib/zip.mjs` (بایتِ واقعی، ردِ offset ِ تکراری)، `server/lib/extract.mjs` (سقفِ متن حینِ آرشیو)، `server/lib/netguard.mjs` (تجزیهٔ
  کاملِ IPv6: mapped/compat/NAT64/6to4)، `server/ai.mjs` (`redirect: 'error'`)، `server/ai-proxy.mjs` (`clientIp` = آخرین hop، بدنه با Buffer،
  `null` ⇒ `{}`)، `server/inspection.mjs` (متن در blob ِ `text_<id>`، `files_rev` و ۴۰۹، اعتبارسنجیِ `file_ids`، زونکن با `updateMeta` ِ تراکنشی،
  احراز پیش از خواندنِ بدنه، محدودیتِ سراسریِ ورودِ ناظر، `spot.path` فقط نسبی)، `server/lib/{auth,inspectionStore}.mjs`، `server/telegram-bot.mjs`،
  `src/components/InspectionBoard.jsx` + `src/lib/inspectionApi.js` (پیوست فقط دانلود با `application/octet-stream`)، `src/App.jsx` (هدف فقط وقتی
  مقدارِ سرور واقعاً عوض شده)، `scripts/supervisor/{inspection,client}.py`. تست: `server/test/review-fixes.test.mjs` (۹ آزمونِ بازگشتی).
- [TODO] بازمانده با دلیل: DNS rebinding (بینِ resolve و fetch) بدونِ dispatcher ِ اختصاصی کامل بسته نمی‌شود؛ ریسکِ باقی‌مانده کم است چون
  redirect بسته و https اجباری است. `mergeFlags` نشانی را که در دستگاهِ دیگر برداشته شده برمی‌گرداند (تاریخچهٔ حذف نداریم) — ترجیح داده شد
  نشانِ اضافه به‌جای ازدست‌رفتنِ نشان. `listReports` ۱۰۰۰ برگهٔ آخر را می‌خواند.
> **امضا:** `Claude Code` · 2026-11-02 · node --test 31/31 (۹ بازگشتیِ تازه)، vitest، build، pytest، docs_gate

## (۶) 2026-11-02 — فعال‌شدنِ hook ِ Stop

- [OWNER] «اجازه می‌دهم .claude/settings.json را با محتوای docs/claude/settings.example.json بسازی و با scripts/ship.sh بفرستی.»
- [FINDING] `docs/claude/settings.example.json` در ریپو (و روی main) **وجود نداشت**. محتوایی که پیش‌تر در HANDBOOK §9 پیشنهاد شده بود (فقط
  hook ِ Stop، بی‌هیچ مجوزِ اضافه) همان خواستهٔ مالک است.
- [CHANGE] ساخته شد: `docs/claude/settings.example.json` (مرجع) و `.claude/settings.json` (کپیِ همان). HANDBOOK §9 مورد ۱ بسته شد.
- [VERIFY] `jq` فرمانِ hook را پیدا کرد؛ اجرای hook با کارِ کامیت‌نشده `{"decision":"block",…}` داد. hook از سشنِ بعدیِ Claude Code (یا پس از
  باز کردنِ `/hooks`) بارگذاری می‌شود.
> **امضا:** `Claude Code` · 2026-11-02 · jq روی settings.json، اجرای مستقیمِ hook، ship.sh

## (۷) 2026-11-03 — تأییدِ مالکیتِ chat ِ تلگرام، بررسیِ Drive scope، وضعیتِ هدفِ روزانه و ادغامِ درایو

- [OWNER] (از راهِ هماهنگ‌کنندهٔ مالک) «قوانین Firestore منتشر شد و کلیدِ وب ِ Firebase به دامنهٔ سایت و ۷ API محدود شد. ۱) ریسکِ ثبتِ
  chat id در حسابِ دیگران را با تأییدِ مالکیت ببند. ۲) Drive scope را اگر بی‌ازدست‌رفتنِ داده می‌شود کوچک کن، وگرنه فقط مستند کن.
  ۳) هدفِ روزانه و ادغامِ درایو را اگر رفع نشده رفع کن. ۴) تست، ship، WORKLOG، OPEN_ITEMS. ۵) گزارشِ کوتاه.»
- [FINDING] (۳) پیش‌تر رفع شده بود و روی main است: ادغامِ جلسه‌ها/نشان‌ها هنگامِ ورود (`mergeSessions`/`mergeFlags`، ۲۱a6026) و یک هدفِ
  روزانه با آینه در تلگرام و محافظتِ debounce (`tgGoalSeenRef`، ۳۲۰۲۵c5). تست‌ها: `driveMerge.test.js`. کارِ تازه‌ای لازم نبود.
- [FINDING] (۱) بات chat را با `where('allChatIds','array-contains',…).limit(1)` به حساب وصل می‌کرد و `reminderTick` به هر chat id ِ تایپ‌شده
  پیام می‌فرستاد ⇒ هر کسی با تایپِ chat id ِ دیگری دادهٔ خودش را به او نشان می‌داد و برایش یادآوری می‌فرستاد. مسیرِ ارسالِ داخلِ مرورگر با
  **توکنِ باتِ خودِ کاربر** است و تلگرام خودش مانع است (چتِ قربانی بات را start نکرده)، پس آن مسیر آسیب‌پذیر نبود.
- [DECISION] (۱) کدِ یک‌بارمصرف: برنامه (کاربرِ واردشده) `POST /api/telegram/link-code` ⇒ کد ۱۵ دقیقه‌ای + پیوندِ `t.me/<bot>?start=<code>`؛
  chat با `/start <code>` آن را مصرف می‌کند (خواندن و حذف در یک تراکنش) ⇒ `telegramLinks/{chatId}={uid}`. پاسخ‌گوییِ بات و یادآوری/خلاصهٔ
  سرور **فقط** به چتِ پیوندشده. مجموعه‌ها (`telegramLinkCodes`، `telegramLinks`، `telegramMeta`) را فقط سرور می‌نویسد؛ default-deny ِ
  قواعدِ منتشرشده مرورگر را بیرون نگه می‌دارد ⇒ **نیازی به انتشارِ دوبارهٔ قواعد نیست** و سندِ `telegramConfigs` ِ کاربران دست نمی‌خورد.
  مهاجرتِ یک‌باره: chat id ای که پیش از این تغییر **فقط یک** حساب ثبت کرده بود پیوند می‌شود (بات ِ مالک بی‌وقفه کار می‌کند)؛ chat ِ
  مورد ادعای چند حساب پیوند **نمی‌شود**. ردشده‌ها: فیلدِ `verified` داخلِ `telegramConfigs` (کاربر می‌تواند سندِ خودش را بنویسد ⇒ قواعد
  باید عوض شوند)؛ «اعتماد در اولین پیام» (همان حمله را برای چتِ تازه باز می‌گذاشت)؛ حذفِ مسیرِ قدیمی بی‌مهاجرت (بات ِ مالک قطع می‌شد).
- [FINDING] (۲) Drive scope — **تغییر داده نشد.** `drive.file` فقط فایل‌هایی را نشان می‌دهد که همین برنامه ساخته یا کاربر با آن باز کرده.
  `doDriveSync` پشتیبان را با `files.list` و نام پیدا می‌کند و اگر نیابد **فایلِ تازه از دادهٔ محلی می‌سازد**. اگر `quran_backup_full.json` ِ فعلی
  با کلاینتِ OAuth ِ دیگری ساخته یا دستی بارگذاری شده باشد، زیرِ `drive.file` نامرئی می‌شود و کاربر «داده‌اش را گم‌شده» می‌بیند (فایلِ قدیمی
  پاک نمی‌شود ولی دیگر خوانده نمی‌شود). بی‌توکنِ حسابِ واقعی نمی‌توان سنجید فایل را کدام کلاینت ساخته. طرحِ پیشنهادیِ مرحله‌ای: (الف) زیرِ همین
  scope، فایل را با `appProperties.quranApp=backup-v1` علامت بزن و id را در `localStorage` نگه دار؛ (ب) scope ِ ورود را `drive.file` کن، و اگر
  فایل پیدا نشد **نساز**، بلکه یک بار با `driveProvider` (scope ِ کامل) پیدا و محتوایش را در فایلی که خودِ برنامه می‌سازد کپی کن (فایلِ قدیمی بماند)؛
  (ج) پس از اینکه همهٔ کاربران مهاجرت کردند، `driveProvider` را هم به `drive.file` ببر. اجرا با تأییدِ مالک و آزمونِ یک حسابِ واقعی.
- [CHANGE] `server/telegramLink.mjs` (تازه)، `server/telegram-bot.mjs` (resolveUser با پیوند، `/start <code>`، `reminderTick` فقط به چتِ تأییدشده،
  API ِ `/api/telegram/link-code` و `/api/telegram/links`، مهاجرتِ یک‌باره، BUILD_TAG build9)، `server/inspection.mjs` (شمارشِ `telegramLinks` در
  storage-health)، `src/components/TelegramLink.jsx` (تازه) در `TelegramSettings.jsx`. تست: `server/test/telegramLink.test.mjs` (۶)، `src/test/TelegramLink.test.jsx` (۲).
- [VERIFY] node --test ۳۷/۳۷، vitest ۳۲۵/۳۲۵، build، pytest، docs_gate؛ پس از دیپلو: `prod_check` (+ `telegramLinks`).
- [TODO] (مالک) یک بار در تنظیمات › تلگرام «🔗 اتصالِ امنِ این حساب» را بزنید اگر کنارِ chat id ِ شما «✗ تأییدنشده» آمد. Drive scope: تصمیم.
> **امضا:** `Claude Code` · 2026-11-03 · node --test 37/37، vitest 325/325، build، pytest، docs_gate

## (۸) 2026-11-03 — هم‌ترازیِ «نظارت و سرکشی» با Detective-1

- [OWNER] (از راهِ هماهنگ‌کننده) «مقایسه با Detective-1 (InspectionBoard.tsx، InspectionGroup.tsx، routers/inspection.py) نشان داد این‌ها نیست:
  ۱) درخواستِ عمومی ۲) نوارِ وضعیتِ ناظر (آخرین دور، دورِ بعدی، آخرین دورِ کامل، «ناظرِ فوری مدتی است سر نزده»، زمانِ رسیدن برای برگهٔ فوری)
  ۳) رفتن به همان‌جا ۴) جستجو ۵) تازه‌سازیِ خودکار و پیامِ «ناظر روی موردهای فوری کار کرد» ۶) درصدِ خواندنِ پیوست و هر نوع فایل
  ۷) inspection_view.py و requirements.txt.»
- [FINDING] خوانده شد (کامل، در Detective-1 روی main): `frontend/src/components/InspectionBoard.tsx` (۹۰۷ خط: درخواستِ عمومی، NextRoundChip،
  FullRoundChip، polling ِ ۲۰ثانیه‌ای فقط وقتِ فوری + focus، بنرِ «کار کرد»، sheetHref، درصدِ خواندن)، `InspectionGroup.tsx`، `routers/inspection.py`
  (‏`_knock`/`_rounds`)، `services/supervisor_rounds.py`، `scripts/supervisor/inspection_view.py`، `requirements.txt`.
- [DECISION] دورها **اندازه‌گیری** می‌شوند، نه نوشته در کد (همان اصلِ Detective): `claimUrgent` و `queue` ِ ناظر ضربان می‌زنند
  (`inspectionMeta/rounds`، تراکنشی، ۱۲ تای آخر)؛ پیش‌فرض تا اولین ضربان: دقیقهٔ ۲۳ و `47 0 * * 1,4` (UTC) = زمان‌بندیِ روتین‌ها
  (env: `SUPERVISOR_URGENT_MINUTE`، `SUPERVISOR_FULL_CRON`). ردشده: خواندنِ زمان‌بندی از API ِ روتین‌ها (سرور به آن دسترسی ندارد).
- [DECISION] `InspectionGroup.tsx` («دستهٔ منتخب و اشراف ِ کاربران» با امتیازِ فعالیت) **پورت نشد**: این پروژه سامانهٔ مجوز/فعالیتِ کاربر ندارد؛
  معادلِ آن این‌جا «برگهٔ غیرِمدیر تا پذیرشِ مدیر به ناظر نمی‌رسد» + سقفِ ۳ معوق/۱۰ در روز است (درخواست هم آن را نخواسته بود).
- [DECISION] پیوست: «هر نوع فایل» از قبل بود؛ سقف ۲۰MB ماند (Detective ۱۰۰MB): بایت‌ها در Firestore‌اند و Firestore هزینه/سقفِ نوشتن دارد.
  رونویسیِ صوت/ویدیو (Gemini در Detective) نیامد: کلید ندارد؛ ناظر صریح «نشنیدم» می‌گوید.
- [CHANGE] سرور: `server/lib/rounds.mjs` (تازه)، `server/inspection.mjs` (ضربان، `GET /api/inspection/rounds`، `rounds` در فهرست، `next_round` پس از فوری،
  `spot.general`، `read_percent`/`fully_read`). فرانت: `src/components/InspectionBoard.jsx` (RoundsBar، درخواستِ عمومی، جستجو، polling + بنر،
  «رفتن به همان‌جا»، درصدِ خواندن، پیامِ نوبت/زمانِ رسیدن)، `src/components/InspectionLayer.jsx` (`?insp=<n>` ⇒ روشن، اسکرول، چشمک)،
  `src/lib/inspectionApi.js`. ناظر: `scripts/supervisor/inspection_view.py` و `requirements.txt` (تازه، از Detective با Chromium ِ `/opt` و سقفِ
  zip)، `inspection.py` (دیدنی‌ها در QUEUE، درخواستِ عمومی)، `docs/supervisor/PROMPT.md` v2 (v1 در `archive/`)، `docs/supervisor/README.md`.
- [VERIFY] node --test ۴۲/۴۲ (۵ تازه: دورها، ضربان، درخواستِ عمومی + فوری، درصدِ خواندن)، vitest ۳۳۱/۳۳۱ (۶ تازه: نوارِ دورها، پیامِ فوری،
  پیوندِ رفتن، جستجو + درخواستِ عمومی، درصدِ خواندن، polling و بنر)، pytest (+۳: ZIP بی‌فرار، صوت)، جریانِ محلیِ ناظر: درخواستِ عمومی + ZIP ⇒
  `pull` (خروجِ ۴) با «👁 همهٔ محتوای آرشیو باز شد» و `rounds` با `full.last_seen`.
> **امضا:** `Claude Code` · 2026-11-03 · node 42/42، vitest 331/331، pytest، جریانِ محلیِ ناظر؛ دیپلو در گزارشِ بعدی

## (۹) 2026-11-03 — صفِ فوری «هر ۳ ساعت» است نه ساعتی؛ ثبتِ هر اجرای صفِ فوری در RUNLOG

- [OWNER] (از راهِ هماهنگ‌کنندهٔ مالک) «صفحهٔ /inspection، متن‌ها و ثابت‌های سرور و مستندات می‌گویند صفِ فوری "هر ساعت" اجرا می‌شود؛
  واقعیت: روتینِ `trig_01Ut8dq6SDo5RG8pJiDrRStr` با cron ِ `23 */3 * * *` (UTC) = هر ۳ ساعت در دقیقهٔ ۲۳ (۰۴:۲۳، ۰۷:۲۳، … دبی)؛ دورِ کامل
  `trig_01UvNwtggi9d2xP4MtszJGpo` دوشنبه/پنجشنبه ۰۴:۴۷ دبی. همه را درست کن (اگر "دورِ بعدی" با ۶۰ دقیقه حساب می‌شود ⇒ ۱۸۰ یا اندازه‌گیری‌شده، با تست).»
- [OWNER] «روتینِ فوری هر اجرا را در `docs/supervisor/RUNLOG.md` ثبت کند — حتی صفِ خالی (یک سطر با زمانِ UTC و دبی، برگه‌ها، کامیت، نتیجه) —
  و push کند؛ "صفِ خالی ⇒ بی‌پیام" بماند؛ دیپلو ِ بی‌پایان نسازد؛ با docs_gate سازگار باشد. نسخهٔ URGENT_PROMPT بالا برود و قبلی بایگانی شود.»
- [OWNER] به برگه‌های ۲ تا ۶ و API ِ production دست نزن (اجرای 21:23 UTC آن‌ها را برمی‌دارد)؛ push بینِ 21:20 و 21:35 UTC نه.
- [FINDING] grep (فارسی و انگلیسی: ساعتی، هر ساعت، hourly، ۶۰ دقیقه، 3600، :23): `src/components/InspectionBoard.jsx` («صفِ فوری هر ساعت»)،
  `server/lib/rounds.mjs` (پیش‌فرض `every = 3600` و `atMinute` ِ ساعتی ⇒ ساعت ۱۰:۰۵ «۱۰:۲۳» می‌گفت در حالی که دورِ واقعی ۱۲:۲۳ است؛ و
  آستانهٔ «سر نزده» ۳ × ۶۰ دقیقه ⇒ بعد از یک دورِ خلوتِ عادی هشدارِ کاذب)، `server/inspection.mjs` (`SUPERVISOR_URGENT_MINUTE` ⇒ ساعتی، توضیحِ
  «hourly round»)، `docs/supervisor/README.md` (جدولِ روتین‌ها، «هر ساعت خطا»)، `PROMPT.md` v2 (دو جا)، `URGENT_PROMPT.md` v1 («ساعتی»، «یک ساعتِ
  خلوت»)، `OPEN_ITEMS.md` (۵). CLAUDE.md/AGENTS.md/HANDBOOK/README ادعای ساعتی نداشتند. بایگانی‌ها و ورودی‌های قبلیِ WORKLOG دست نخوردند.
- [FINDING] دیپلو: سایتِ استاتیک (`quran-web-app`) rootDir/buildFilter ندارد (render.yaml؛ سرویس دستی ساخته شده و داشبوردش خوانده نشد —
  فقط endpoint ِ deploys مجاز بود) ⇒ **هر** کامیتِ main، حتی فقط‌مستند، آن را می‌سازد. بات `rootDir: server` ⇒ برای `docs/` دیپلو نمی‌شود.
  `deploys.py` «عقب‌ماندن» را فقط از کامیت‌هایی که مسیرهای خودِ سرویس را عوض کرده‌اند می‌شمارد ⇒ کامیتِ فقط‌RUNLOG ِ رد‌شده P2 نمی‌سازد.
- [FINDING] docs_gate: کامیتی که فقط `RUNLOG.md` را عوض کند WORKLOG/PROGRESS را عوض نمی‌کند ⇒ بررسی‌های ۴ و ۵ همان نتیجهٔ main ِ قبلی را می‌دهند (سبز).
- [DECISION] دورِ بعدیِ فوری: پیش‌فرض از cron (`23 */3 * * *`، env ِ اختیاری `SUPERVISOR_URGENT_CRON`؛ `SUPERVISOR_URGENT_MINUTE` ِ قدیمی فقط
  دقیقهٔ همان آهنگِ ۳ساعته را جابه‌جا می‌کند) و پس از ضربان‌ها **اندازه‌گیری‌شده**: دوره فقط از ضربان‌های نزدیکِ دقیقهٔ معمولِ شروع (±۵) و
  فاصله‌های ≥ ۳۰ دقیقه (چند claim در یک اجرا دوره را کوتاه نکند)، گرد به ساعتِ کامل و قفل روی دقیقهٔ مشاهده‌شده؛ «سر نزده» = ۳ × همان دوره.
  ردشده: ثابتِ ۱۸۰ دقیقه به‌جای ۶۰ (باز با عوض‌شدنِ روتین بی‌صدا غلط می‌شد)؛ خواندن از API ِ روتین‌ها (سرور دسترسی ندارد).
- [DECISION] RUNLOG: بندِ ۸ ِ تازه در `URGENT_PROMPT.md` v2 — **هر** اجرا یک سطرِ `- ⚡ …` در انتهای RUNLOG، کامیتِ جدا که **فقط** RUNLOG را دارد،
  با `[skip render]` در پیام، `docs_gate.py` قبلش، و `git push origin HEAD:main` (rebase در ردشدن، هرگز force). سطرِ RUNLOG از بندِ ۳٫۷ به بندِ ۸ رفت
  (شناسهٔ کامیت لازم دارد). ردشده: `ship.sh` برای هر سطر (تست/بیلدِ کامل هر ۳ ساعت و دیپلو ِ بی‌تغییر)؛ ثبت فقط وقتِ کار (اجرای خالی ردی
  نمی‌گذاشت)؛ WORKLOG برای هر اجرا (شلوغیِ بی‌ارزش؛ دروازه هم نمی‌خواهد). **پرامپتِ خودِ روتین لازم نیست عوض شود** (فقط به این فایل اشاره می‌کند).
- [CHANGE] `server/lib/rounds.mjs` (`DEFAULT_URGENT_CRON`، `parseEveryCron`، `nextRound` با cron)، `server/inspection.mjs` (`URGENT_CRON`)،
  `server/test/rounds.test.mjs` (+۲)، `src/components/InspectionBoard.jsx` («هر ۳ ساعت (دقیقهٔ ۲۳)»، `cadenceFa` در نوارِ دورها)،
  `src/test/inspection.test.jsx` (+۲، +۱ بند)، `docs/supervisor/URGENT_PROMPT.md` v2 (v1 ⇒ `archive/URGENT_PROMPT-v1-2026-11-03.md`)،
  `docs/supervisor/PROMPT.md` v3 (v2 ⇒ `archive/PROMPT-v2-2026-11-03.md`؛ فقط اصلاحِ «ساعتی»)، `docs/supervisor/README.md`، `RUNLOG.md` (سرِ فایل)،
  `OPEN_ITEMS.md` (۵ اصلاح، ۷ و ۸ تازه)، `render.yaml` / `.env.example` / `server/README.md` (env های اختیاری)، HANDBOOK (§۶، §۷، §۹)، PROGRESS،
  `experiences/scheduled-job-cadence-and-run-log.md` (تازه).
- [VERIFY] node --test ۴۴/۴۴، vitest ۳۴ فایل / ۳۳۳ تست، `npm run build`، pytest ۵۳، docs_gate OK. production API صدا زده نشد.
- [TODO] (مالک، اختیاری) نامِ روتین در claude.ai هنوز «(ساعتی)» است ⇒ «(هر ۳ ساعت)». (ناظر) پس از اولین اجرای خالی: سطرِ RUNLOG روی main و
  نبودِ دیپلو ِ تازهٔ سایت برای آن کامیت را بسنج (OPEN_ITEMS ۸).
> **امضا:** `Claude Code` · 2026-11-03 · node 44/44، vitest 333/333، build، pytest 53، docs_gate؛ دیپلو پس از push با Render API ِ deploys

## 2026-11-03 — برگهٔ فوری ۳: نشانگرِ «بارگذاری از درایو…» بی‌نهایت می‌ماند
- [OWNER] پس از ریلود، نشانگر ⏳ بیش از ۱۵ دقیقه می‌ماند و هیچ درخواستی به googleapis.com/drive نمی‌رود؛ انتظار: وضعیتِ روشن + دکمهٔ اتصال، و ادغامِ بی‌خطر.
- [FINDING] بعد از ریلود توکنِ Drive نیست ⇒ `refreshDriveTokenSilently` با `signInWithPopup` بدونِ حرکتِ کاربر صدا زده می‌شود؛ مرورگر پنجره را مسدود می‌کند و promise گاه هرگز settle نمی‌شود ⇒ وضعیت روی `loading` می‌ماند.
- [DECISION] سقفِ ۱۰ ثانیه روی تلاشِ بی‌صدا؛ شکست ⇒ وضعیتِ `reconnect` با پیامِ روشن و دکمهٔ «تلاش مجدد برای اتصال درایو» (حرکتِ کاربر). هیچ آپلودی بدونِ توکن/بدون ادغام انجام نمی‌شود، پس دادهٔ درایو بازنویسی نمی‌شود. ردشده: تلاشِ بی‌نهایت؛ آپلودِ محلی هنگامِ قطع.
- [CHANGE] `src/App.jsx` (Promise.race در refreshDriveTokenSilently؛ شاخهٔ شکست در onAuthStateChanged).
- [TODO] نمایشِ ساعتِ آخرین ذخیره کنارِ «✓ همگام» انجام نشد (جزئی).
> **امضا:** `ناظرِ خودکار (Claude Code routine)` · 2026-11-03 · تست/بیلد با ship.sh

## 2026-11-03 — برگهٔ فوری ۴: گزارشِ جای‌خالی «شما:» واژهٔ درست را نشان می‌داد
- [OWNER] پاسخِ تایپ‌شده («فيها») در گزارش دیده نمی‌شد و درصد (۶۷٪) مبهم بود.
- [FINDING] `typed` درست ذخیره می‌شد؛ `buildWordRuns` در `Diff` متنِ `target` را رنگ می‌کرد نه `typed`. درصد = درست ÷ (درست+غلط) از `Pie` ؛ جای‌خالی‌های باز‌نشده ثبت نمی‌شوند.
- [CHANGE] `src/App.jsx`: Diff واژهٔ کاربر را نشان می‌دهد («—» برای جاافتاده)؛ خلاصهٔ «n درست · n غلط · n بی‌پاسخ» با توضیحِ فرمول زیرِ گزارشِ تمرین. ثبتِ داده تغییر نکرد.
- [TODO] ثبتِ انتخابگرِ دقیقِ کارت به‌جای ریشه در ابزارِ کادرکشی (جزئی، انجام نشد).
> **امضا:** `ناظرِ خودکار (Claude Code routine)` · 2026-11-03 · تست/بیلد با ship.sh

## 2026-11-04 — برگهٔ فوری ۳ (دور دوم): مسیرِ کلیکیِ اتصال درایو هم ⏳ بی‌پایان نماند
- [OWNER] کلیک روی «تلاش مجدد برای اتصال درایو» دوباره ⏳ شد و بیش از ۲۰ ثانیه ماند؛ خواسته: تایم‌اوت/افتادن به redirect، توکنِ بی‌کلیک، ساعتِ آخرین ذخیره.
- [FINDING] `authorizeDrive` (مسیر کلیک) سقف نداشت؛ با popupِ بسته‌شده/ناشناخته (COOP) هرگز settle نمی‌شد.
- [CHANGE] `src/App.jsx`: سقفِ ۴۵ ثانیه روی `authorizeDrive` ⇒ وضعیتِ `reconnect` با پیامِ روشن؛ `popup-blocked`/`internal-error` ⇒ `signInWithRedirect(driveProvider)` (توکن را `getRedirectResult` می‌گیرد)؛ ساعتِ آخرین ذخیره کنارِ «✓ همگام».
- [DECISION] بندِ ۲ (توکنِ بی‌کلیک با refresh token سمتِ سرور یا GIS prompt=none) **انجام نشد**: نیازمندِ OAuth client/secret و ذخیرهٔ refresh token در Firestore (تغییرِ امنیتی و ساختاری) و تصمیمِ مالک است. ردشده: ذخیرهٔ توکن در localStorage (ریسکِ XSS). هیچ آپلودی در مسیرِ شکست انجام نمی‌شود.
- [TODO] (مالک) تأیید کند refresh token سمتِ سرور (Google OAuth code flow روی بات) ساخته شود یا نه.
> **امضا:** `ناظرِ خودکار (Claude Code routine)` · 2026-11-04 · تست/بیلد با ship.sh

## 2026-11-04 — برگهٔ فوری ۳ (دور سوم): توکنِ بی‌کلیکِ درایو با GIS prompt=none
- [OWNER] مالک (از طرفِ هماهنگ‌کننده) گزینهٔ «ب» را انتخاب کرد: GIS token client با `prompt=none` و hint ایمیل، بدونِ client secret/refresh token سمتِ سرور؛ خطا ⇒ دکمهٔ «تلاش مجدد»؛ تازه‌سازیِ بی‌صدا هر ۵۵ دقیقه.
- [CHANGE] `src/lib/gisToken.js` (تازه: `requestDriveTokenSilently`، سقفِ ۸ ثانیه، هرگز throw/آپلود نمی‌کند)؛ `src/App.jsx`: `refreshDriveTokenSilently` اول GIS را امتحان می‌کند و بعد popup قبلی؛ تایمرِ ۵۵ دقیقه‌ای فقط توکن را عوض می‌کند؛ `.env.example`: `VITE_GOOGLE_OAUTH_CLIENT_ID`؛ تست `src/test/gisToken.test.js`.
- [DECISION] بدونِ `VITE_GOOGLE_OAUTH_CLIENT_ID` همه‌چیز null می‌دهد و رفتارِ قبلی (دکمهٔ اتصال) می‌ماند — امن و برگشت‌پذیر. شناسهٔ client در ریپو نبود و حدس نزدم.
- [BLOCKED] (مالک) شناسهٔ «Web client» پروژهٔ Firebase (Google Cloud ‹ Credentials) را در Render روی `quran-web-app` به‌صورت `VITE_GOOGLE_OAUTH_CLIENT_ID` بگذارد و origin سایت را در Authorized JavaScript origins همان client اضافه کند؛ بعد بیلدِ تازه. تا آن موقع توکنِ بی‌کلیک کار نمی‌کند.
> **امضا:** `ناظرِ خودکار (Claude Code routine)` · 2026-11-04 · vitest/بیلد با ship.sh

## 2026-11-04 — «/practice مرورگر را قفل می‌کند» (فوری، از هماهنگ‌کننده)
- [OWNER] «صفحهٔ /practice مرورگر را کاملاً قفل می‌کند… «تمرین» ← «کل آیه» (و یک بار «خالی: اول») ← «فیلتر سوره» = الناس ← اندازهٔ دسته ۴۰ ← «ساخت دستهٔ تمرین» → فریز. حدس: حلقهٔ بی‌پایان وقتی اندازه (۴۰) از تعدادِ آیات (۶) بیشتر است. علت را پیدا و رفع کن، همهٔ حلقه‌های مشابه را ایمن کن (شاید علتِ ۴ سؤال به‌جای ۵ در برگهٔ ۷)، تستِ واحد برای بازهٔ کوچک‌تر از اندازه.»
- [FINDING] «فیلتر سوره» فقط در محدودهٔ «آیات نشان‌شده» است. بازتولید با Playwright (دیتاستِ کوچک با الناس، بی‌آیهٔ نشان‌شده): همین گام‌ها یک `alert("در این بازه کارتی یافت نشد.")` ِ بومی می‌سازد — پنجره‌ای که همهٔ اسکریپت‌های تب را تا «OK» متوقف می‌کند و مرورگرِ خودکار نمی‌بیندش ⇒ «هنگ». **حلقه‌ای نبود:** `proposalDeck` از قبل `slice(0, min(len, size))` بود؛ حلقه‌های `while` ِ دیگر (هم‌ترازیِ توکن‌ها، آمار، هندسهٔ نظارت) همه با شرطِ محدود پایان می‌یابند. علتِ «۴ سؤال به‌جای ۵» (برگهٔ ۷): `generateMcqDeckForTraining` آیهٔ کمتر از ۳ کلمه را بی‌صدا کنار می‌گذارد.
- [CHANGE] `src/lib/practiceDeck.js` (تازه): `buildPracticeCards` (حلقه محدود به خودِ بازه؛ اندازه فقط سقف)، `emptyRangeMessage` (پیامِ دقیق: «در سورهٔ الناس هیچ آیهٔ نشان‌شده‌ای نیست (۰ از ۶ آیه)…»)، `sizeNotice` («این بازه ۶ آیه دارد؛ دستهٔ ۶ کارتی ساخته شد»). `src/App.jsx`: اعلانِ درون‌صفحه‌ایِ غیرمسدودکننده (`notice`، دکمهٔ ×، خودکار پس از ۹ ثانیه جز خطا) و **همهٔ ۱۶ `alert()`** به آن تبدیل شد؛ `proposalDeck` از `buildPracticeCards`؛ آزمونِ تستی (تمرین و از اشتباهات) شمارِ آیه‌های کوتاهِ کنارگذاشته را می‌گوید. `confirm()` ها (تصمیم‌های مخرب) ماندند. تست `src/test/practiceDeck.test.js`.
- [VERIFY] Playwright روی build ِ محلی: همان گام‌ها ⇒ ۰ پنجرهٔ بومی، صفحه پاسخ‌گو، اعلانِ «در سورهٔ الناس هیچ آیهٔ نشان‌شده‌ای نیست (۰ از ۶ آیه)…»؛ محدودهٔ «سوره» الناس با اندازهٔ ۴۰ در «کل آیه» و «خالی: اول» ⇒ دستهٔ ۶ کارتی در ~۰٫۷ ثانیه با اعلانِ «این بازه ۶ آیه دارد». vitest ۳۴۰ سبز (۳۶ فایل)، build سبز.
> **امضا:** `Claude Code` · 2026-11-04 · Playwright (بازتولید و پس از رفع) + vitest + build


## 2026-11-04 — برگهٔ فوری ۷: «آزمون از اشتباهات» (۸ بند)
- [OWNER] تست واقعی (تستی-کلمه، ۵ سؤال): ۱) فقط ۴ سؤال آمد ۲) ترتیب مصحف بود ۳) جوابِ غلط بی‌درنگ رد شد ۴) گزینه‌های انحرافی تصادفی ۵) پایانِ آزمون به تنظیمات تمرین پرت کرد ۶) شمارندهٔ «تصحیح» مبهم ۷) فیلتر سوره ۱۱۴ سوره ۸) درگِ کادر ناقص و گرهٔ ریشه.
- [FINDING] ۱) ساخت از `dataset.filter` بود (ترتیب مصحف) و آیه‌های <۳ کلمه بی‌جایگزین حذف می‌شدند. ۸) `up` در `InspectionLayer` مستطیلِ قدیمیِ state را می‌خواند (یک رندر عقب) ⇒ کادرِ ناقص و گرهٔ ریشه.
- [CHANGE] `src/lib/mistakeExam.js` (تازه، خالص + تست در `src/test/mistakeExam.test.js`): ساختِ دسته به ترتیبِ «بیشترین اشتباه» و پرکردنِ تعداد با اشتباهِ بعدی (آیهٔ ۲کلمه‌ای هم سؤال می‌شود)؛ انحرافی‌ها = کلمه‌های شبیه (فاصلهٔ ویرایشِ رسم‌الخطِ ساده، اولویتِ همان صفحه/سوره، بدونِ هم‌املا) ؛ `correctionCounts` = درست‌جواب‌دادن «پس از» اولین اشتباه؛ `surahsWithMistakes`؛ `summarizeSession` (تلاشِ اول). `src/App.jsx`: جوابِ غلط خودکار رد نمی‌شود — قرمز، پاسخِ درست داخلِ آیهٔ کامل، پخشِ صوتِ آیه، دکمهٔ «بعدی»، و آیه یک بار دیگر در همان جلسه برمی‌گردد؛ آزمونِ تستی در تبِ «آزمون» می‌ماند (`renderMcqCard` مشترک) و پایان کارتِ نتیجه (درست/کل، آیه‌های غلط، «دوباره فقط غلط‌ها») می‌دهد؛ آزمونِ تایپی هم پس از پایان به همین کارت برمی‌گردد؛ فیلترِ سوره فقط سوره‌های دارای اشتباه با تعداد. `InspectionLayer.jsx`: درگ با ref.
- [DECISION] «تصحیح» را تعریف کردم نه حذف (قابلیت نمی‌رود): فقط جوابِ درست پس از اولین اشتباه؛ توضیح در tooltip. رد‌شده: حذفِ شمارنده.
- [DECISION] بازگشتِ آیهٔ غلط فقط یک بار (`retry`) تا حلقهٔ بی‌پایان نشود؛ این برای همهٔ آزمون‌های تستی اعمال می‌شود، نه فقط اشتباهات.
- [VERIFY] vitest ۳۴۷+ سبز، build سبز. عکسِ جریانِ زنده از production/نسخهٔ محلی گرفته نشد (دیتاستِ کامل لازم است) ⇒ جواب `partial`؛ مالک پس از دیپلو یک آزمونِ تستی بزند.
> **امضا:** `ناظرِ خودکار (Claude Code routine)` · 2026-11-04 · vitest + build با ship.sh

## 2026-11-04 — برگهٔ فوری ۱۰: ترتیبِ RTL در حالت‌های «کلمه آخر/اول» (باگ؟ نه — اندازه‌گیری شد)
- [OWNER] «در «نمایش کلمه آخر» کلمهٔ آخر سمتِ راست و جاهای خالی سمتِ چپ است؛ درست: خالی‌ها راست و کلمهٔ آخر انتهای چپ. «کلمات تصادفی» و «کلمه اول» را هم کنترل و تستِ تصویریِ RTL بگذار.»
- [FINDING] روی build ِ محلی با Playwright (دیتاستِ ۳ آیه، `/hifz`) مختصاتِ واقعیِ هر کلمه/جای‌خالی خوانده شد: «کلمه آخر» ⇒ جاهای خالی x=۶۳۰…۷۷۰ (راست) و «الْعَالَمِينَ» x=۵۴۴ (چپ‌ترین)؛ «کلمه اول» ⇒ «الْحَمْدُ» x=۷۹۴ (راست‌ترین) و خالی‌ها سمتِ چپ. یعنی **ترتیب همان ترتیبِ مصحف است**؛ عکسِ خودِ مالک (برگهٔ ۱۰) هم همین را نشان می‌دهد (خالی‌ها راست، «الدِّينِ» چپ). `cloze-container` از اول `direction: rtl` و `getBlanksForMode` فقط اندیس‌های خالی را می‌دهد؛ ترتیبی عوض نمی‌شود. «کلمات تصادفی» فقط مجموعهٔ خالی‌ها را عوض می‌کند، نه جای کلمه‌ها.
- [DECISION] کدِ نمایش را عوض نکردم (تغییر، ترتیبِ درست را خراب می‌کرد). رد‌شده: وارونه‌کردنِ چیدمان. به‌جایش نگهبانِ قابل‌اجرا: `scripts/supervisor/rtl_cloze_check.cjs` (کدِ خروجِ ۱ اگر ترتیب وارونه شود).
- [CHANGE] `scripts/supervisor/rtl_cloze_check.cjs` (تازه). [VERIFY] اجرا روی build ِ محلی: کدِ ۰؛ اسکرین‌شات `cloze_last.png` دیده شد.
> **امضا:** `ناظرِ خودکار (Claude Code routine)` · 2026-11-04 · Playwright محلی + ship.sh

## 2026-11-04 — برگهٔ فوری ۱۱: تمرینِ تایپی — نشانِ آیه، بازخوردِ درست/غلط، پیش‌فرضِ محدوده
- [OWNER] ۱) در تمرینِ تایپیِ «کل آیه» با ترتیبِ تصادفی نشان نیست کدام آیه را باید تایپ کرد (+ اختیاری: آیهٔ قبلی). ۲) «ثبت پاسخ» بی‌درنگ می‌رود بعدی؛ نمی‌گوید درست/غلط، متنِ درست را نشان نمی‌دهد. ۳) برای کاربرِ بی‌آیهٔ نشان‌شده پیش‌فرض «سوره» باشد.
- [FINDING] ۱) برچسبِ «سوره — آیه N» پشتِ `showRef` بود (که همراهِ آن کلِ آیه را هم نشان می‌دهد، یعنی پاسخ) ⇒ بدونِ نمایشِ پاسخ نمی‌شد برچسب دید. ۲) `submitCurrent` فقط `afterSubmitMove` می‌زد. ۳) مقدارِ پیش‌فرضِ کد از قبل «سوره» بود؛ مقدارِ ذخیره‌شدهٔ «flagged» در localStorage بدونِ هیچ آیهٔ نشان‌شده دستهٔ خالی می‌داد.
- [CHANGE] `src/App.jsx`: برچسبِ آیه همیشه نمایان (`data-testid=practice-ayah-ref`)؛ پس از ثبت: درست ⇒ اعلانِ «✓ درست بود» و ادامه؛ غلط ⇒ می‌ماند، پنلِ قرمز با «شما / درست»، پخشِ صوتِ آیه، دکمهٔ «بعدی» (آیه از صفِ تکرار برمی‌گردد) و «تلاش دوباره»؛ «خودکار پر کن» مثلِ قبل رد می‌شود؛ محدودهٔ ذخیره‌شدهٔ «flagged» بی‌آیهٔ نشان‌شده ⇒ «سوره».
- [DECISION] «آیهٔ قبلی به‌عنوان سرنخ» (اختیاریِ برگه) را نساختم: در ترتیبِ تصادفی به طراحیِ گزینه نیاز دارد؛ منتظرِ تأییدِ مالک. رد‌شده: نمایشِ پیش‌فرض (پاسخ لو می‌رود).
- [VERIFY] Playwright روی build ِ محلی: برچسب «الناس — آیه ١»، پنلِ غلط با «درست: قل أعوذ برب الناس»، رادیوی «flagged» تیک نخورد. vitest ۳۴۷ سبز، build سبز.
> **امضا:** `ناظرِ خودکار (Claude Code routine)` · 2026-11-04 · Playwright محلی + ship.sh

## 2026-11-04 — خیلی فوری: پنجره‌های کوچکِ متعددِ ورودِ گوگل در هر بارگذاری
- [OWNER] «با هر بار ورود به اپ چند پنجرهٔ کوچکِ لاگین باز می‌شود». هماهنگ‌کننده روی production: Firebase لاگین است (accounts:lookup / securetoken موفق) ولی توکنِ درایو ذخیره/تازه نمی‌شود؛ `window.open` به `…firebaseapp.com/__/auth/handler` (500×600)، ۴۵ ثانیه تایم‌اوت و دوباره. خواسته: الف) پاپ‌آپِ خودکار در بارگذاری هرگز؛ ب) حداکثر یک پنجره (focus ِ پنجرهٔ باز، close() با تایم‌اوت)؛ پ) توکن با زمانِ انقضا ذخیره و تا معتبر است پاپ‌آپ نه؛ ت) تا `VITE_GOOGLE_OAUTH_CLIENT_ID` نیست، وضعیتِ واقعیِ «درایو وصل نیست — [اتصال]»؛ ث) اگر ممکن است signInWithRedirect.
- [FINDING] سه علت در `src/App.jsx`: (۱) `onAuthStateChanged` بی‌توکنِ همان‌تب (هر بارگذاری در تبِ تازه) ⇒ `refreshDriveTokenSilently` ⇒ چون GIS بی‌شناسهٔ کلاینت `null` می‌داد، `signInWithPopup(driveRefreshProvider)` **بی‌کلیکِ کاربر** — یک پنجره در هر بارگذاری؛ همین مسیر در هر 401 ِ میانِ همگام‌سازی هم؛ (۲) `Promise.race` با تایم‌اوتِ ۴۵/۱۰ ثانیه فقط promise را رها می‌کرد، پنجره باز می‌ماند و تلاشِ بعدی پنجرهٔ دیگری باز می‌کرد؛ (۳) توکن فقط در `sessionStorage` (بی‌انقضا، فقط همان تب).
- [CHANGE] `src/lib/driveAuth.js` (تازه): `saveDriveToken`/`loadDriveToken` (localStorage با `exp` و ایمیلِ حساب؛ ۲ دقیقه حاشیه پیش از انقضا؛ کهنه پاک می‌شود)؛ `singlePopup` (یک promise ِ در جریان؛ درخواستِ دوم پنجرهٔ باز را `focus` و همان promise را برمی‌گرداند؛ دسته‌گیرِ پنجره از `window.open` گرفته و فوراً بازگردانده می‌شود؛ تایم‌اوتِ ۹۰ ثانیه پنجره را `close()` و `drive-popup-timeout` می‌دهد). `App.jsx`: بارگذاری ⇒ توکنِ ذخیره‌شدهٔ معتبر، وگرنه GIS ِ `prompt=none` (بی‌پنجره) فقط اگر شناسهٔ کلاینت هست، وگرنه بی‌درنگ «⚠ درایو وصل نیست — اتصال» (بی‌چرخهٔ «در حال اتصال»)؛ `refreshDriveTokenSilently` دیگر هیچ پاپ‌آپی نمی‌زند (فقط GIS)؛ 401 توکنِ ذخیره‌شده را پاک می‌کند؛ `handleLogin` و `authorizeDrive` (فقط از کلیک) از `singlePopup` می‌گذرند؛ فال‌بکِ redirect فقط وقتی پاپ‌آپ مسدود شد (مثلِ قبل).
- [DECISION] (ث) redirect مسیرِ اصلی **نشد**: اپ روی `onrender.com` است و `authDomain` روی `firebaseapp.com`؛ در مرورگرهایی که ذخیره‌سازیِ شخصِ‌ثالث را جدا می‌کنند نتیجهٔ redirect گم می‌شود (همان خطای «ورود با انتقال … کامل نشد» که اپ از قبل برایش پیام دارد). پاپ‌آپ با کلیک کار می‌کند و اکنون فقط یکی است. **ردشده:** redirect ِ همیشگی (ورودِ ناموفق در Safari/Firefox ِ سخت‌گیر)؛ نگه‌داشتنِ پاپ‌آپِ «بی‌صدا» در بارگذاری با تایم‌اوتِ کوتاه‌تر (همان پنجره‌ها). راهِ بی‌پنجرهٔ واقعی همان شناسهٔ کلاینتِ GIS است (برگهٔ ۳، کارِ مالک).
- [VERIFY] vitest `driveAuth.test.js` (۹: ذخیره/بازیابی/انقضا/حسابِ دیگر؛ پنجرهٔ دوم = focus ِ همان؛ تایم‌اوت پنجره را می‌بندد؛ `window.open` بازگردانده می‌شود؛ نگهبانِ متنی: هر `signInWithPopup` ِ App از `singlePopup` می‌گذرد، مسیرِ تازه‌سازیِ بی‌صدا پاپ‌آپ ندارد، ۴۵۰۰۰ نمانده) + vitest کامل + build در ship.
> **امضا:** `Claude Code` · 2026-11-04 · vitest + build

## 2026-11-04 — «نظارت و سرکشی» هم‌سطحِ کارآگاه و بانک
- [OWNER] «ظاهر و قابلیت‌های کادر ضعیف‌تر است؛ از کدِ کارآگاه (Detective-1) و بانک (ALLIN1) مقایسه کن و بیاور: تیکِ ⚡ فوری/عادی داخلِ فرمِ کادر، انتخابِ عنصرِ دقیق (کوچک‌ترین عنصر زیرِ کادر، نه div ِ ریشه — برگهٔ ۸) و نمایشِ عکسِ کادر، حالتِ Alt، هایلایتِ برگه‌ها، «درخواستِ عمومی»، فیلتر/صفحه‌بندی/شمارندهٔ وضعیت‌ها، جزئیات با پاسخِ ناظر زیرِ هر کارت، پیوست، زنجیرهٔ وابستگی، تأیید/رد/فوری روی کارتِ فهرست، و نمای فهرستیِ مثلِ بانک. سازگاری با روتینِ فوری و داده‌های Firestore حفظ شود.»
- [FINDING] مقایسهٔ فقط‌خواندنیِ سه کد: «درخواستِ عمومی»، زنجیرهٔ وابستگی، پیوست (با درصدِ خواندنِ ناظر) و صفحهٔ برگه‌ها از قبل بود. کمبودها: ⚡ فقط در فرمِ عمومی؛ `anchorFor` از مرکزِ کادر تا کوچک‌ترین عنصری که **کلِ** کادر را بگیرد بالا می‌رفت ⇒ کادری روی چند خواهر به div ِ ریشه می‌رسید؛ عکس فقط هنگامِ ارسال (بی‌پیش‌نمایش، بی‌گرفتنِ دوباره، بی‌چسباندن)؛ پرده هنگامِ حالتِ نظارت کلِ صفحه را می‌گرفت (بی‌Alt)؛ هایلایت بی‌راهنمای موس؛ شمارنده فقط وقتی فیلتری نبود (و سرور شمارش را پس از فیلتر می‌گرفت)؛ بی‌صفحه‌بندی؛ پاسخِ ناظر فقط در پنلِ جزئیات؛ کنش‌ها فقط در پنلِ جزئیات.
- [CHANGE] `inspectionGeometry.js`: `anchorFor` = درونی‌ترین عنصرِ صفحه زیرِ مرکزِ کادر (`elementsFromPoint`، بی‌لایهٔ خودمان و html/body؛ بی‌آن همان رفتارِ قبلی)؛ `containerFor` (رفتارِ قبلی) فقط برای متن؛ `coveredText` (متنِ خودِ عنصر اگر کادر ≥۷۰٪ آن را بپوشاند، وگرنه متنِ نگه‌دارندهٔ کادر). `InspectionLayer.jsx`: حالتِ نظارت ماندگار (`quran.inspection.active`) و **صفحه در آن کار می‌کند**؛ پرده فقط وقتی «مسلح» است (نگه‌داشتنِ Alt یا «✏️ کادر» برای لمسی؛ رهاکردنِ Alt پیش از کشیدن خلع می‌کند؛ Esc یک قدم عقب)؛ عکس بلافاصله پس از کشیدنِ کادر با پیش‌نمایش در فرم، «📷 گرفتنِ دوبارهٔ تصویر»، و Ctrl+V ِ عکسِ واقعی که برنده است؛ تیکِ «⚡ فوری» در فرم برای مدیر (پس از ثبت `setUrgent` و پیامِ نوبت؛ شکستِ فوری جدا گفته می‌شود)؛ راهنمای موس روی هایلایت‌ها (وضعیت، ⚡، عنوان، آخرین پاسخِ ناظر، «جای تقریبی» وقتی عنصر دیگر پیدا نمی‌شود) با `pointer-events:none`؛ بازخوانیِ هایلایت‌ها با focus ِ پنجره. `InspectionBoard.jsx`: کاشی‌های شمارندهٔ شش وضعیت (کلیک = فیلتر)؛ کارت‌های بازشونده (نمای فهرستیِ مثلِ بانک) با تراشهٔ وضعیت، «⚡ در صفِ فوری / در دستِ ناظر / جواب گرفت»، «عمومی»، شمارِ وابستگی، و پیش‌نمایشِ دوخطیِ آخرین پاسخِ ناظر؛ کنش‌های مدیر روی کارت (پذیرش/رد، ✓ تأیید/برداشتنِ تیک، ⚡/لغوِ ⚡)؛ صفحه‌بندی (۵/۱۰/۲۰/۵۰/۱۰۰، ماندگار در `quran.inspection.pageSize`). سرور: `urgent_in_progress` در `publicReport` (ادعا‌شده در مهلتِ ۱۰۰ دقیقه)؛ `GET /api/inspection/urgent` (فقط مدیر/ناظر؛ فقط‌خواندنی، بی‌claim و بی‌ضربان)؛ شمارش‌های `list` پیش از فیلترِ وضعیت.
- [DECISION] قراردادهای روتین (`/urgent/claim`، `/queue`، `spot.general`، نامِ `deps`، بی‌حذف) دست نخوردند؛ فیلدِ تازه فقط مشتق است (چیزی در Firestore نوشته نمی‌شود). **ردشده / ماند:** آپلودِ multipart با نوارِ پیشرفت، افزودنِ کادرِ تازه «ذیلِ» برگهٔ موجود، گروه‌بندیِ پیوست‌ها برحسبِ یادداشت (کارآگاه/بانک دارند؛ قدمِ بعد)؛ حذفِ برگه از کارت (این‌جا قاعدهٔ مالک ممنوع کرده).
- [VERIFY] vitest کامل ۳۶۳ (۷ تستِ تازه: درونی‌ترین عنصر، پرده فقط وقتِ مسلح و Alt/Esc، پیش‌نمایشِ فوریِ عکس و ⚡ ِ فرم ⇒ `setUrgent`، بی‌⚡ برای غیرِمدیر، کاشی/پاسخ/کنشِ کارت، صفحه‌بندیِ ماندگار، تراشهٔ فوری) + `node --test` سرور ۴۵ (تستِ تازه: فهرستِ فوری با ترتیب، «در دستِ ناظر» تا پایانِ مهلت، شمارش با فیلتر) + build. بازبینیِ تصویری با حسابِ واقعیِ مدیر روی production انجام نشد (ورودِ گوگل در این ظرف نیست) — پس از دیپلو از مالک/هماهنگ‌کننده.
> **امضا:** `Claude Code` · 2026-11-04 · vitest + node --test + build

## 2026-11-04 — فوری: «Choose an account» در هر «اتصال درایو» و «⏳ بارگذاری» ِ بی‌پایان
- [OWNER] (با عکس) «با کلیکِ «اتصال» پنجرهٔ کوچکِ accounts.google.com «Choose an account — to continue to quran-app-7566b.firebaseapp.com» باز می‌شود و تا کاربر دستی حساب را انتخاب نکند سربرگ همیشه «⏳ بارگذاری از درایو…» می‌ماند و بعد بی‌پیام «درایو وصل نیست» می‌شود؛ کاربر از قبل با همین حساب وارد است.» خواسته: login_hint و reauthenticate به‌جای ورودِ تازه (اگر ممکن، scope در همان ورودِ اصلی)؛ تشخیصِ بسته/رهاشدن و مهلتِ ~۶۰ ثانیه با پیامِ فارسی و «تلاش دوباره»؛ redirect با همان login_hint اگر popup مسدود؛ آزمونِ Playwright؛ توضیحِ دقیقِ نقشِ VITE_GOOGLE_OAUTH_CLIENT_ID.
- [FINDING] `authorizeDrive` یک **ورودِ تازه** بود (`signInWithPopup(auth, driveProvider)`) با `prompt: consent` ِ اجباری و بی‌`login_hint` ⇒ گوگل هر بار انتخابگرِ حساب و صفحهٔ رضایت را نشان می‌داد؛ و پیش از بازشدنِ پنجره `driveStatus="loading"` می‌شد ⇒ «⏳ بارگذاری از درایو…» در تمامِ مدتِ انتظار؛ بسته‌شدن/مهلت به `reconnect` می‌رفت که پیامش فقط در title ِ دکمه بود (بی‌پیامِ دیدنی). ورودِ اصلی (`googleProvider`) از قبل scope ِ درایو را می‌خواهد و توکنش را برمی‌دارد (`applyDriveCredential`)؛ پنجرهٔ دوم فقط پس از انقضای توکن (~۱ ساعت) یا پاک‌شدنش لازم می‌شود.
- [CHANGE] `src/lib/firebase.js`: `driveProviderFor(email)` (scope ِ drive + `login_hint`، بی‌`prompt: consent`)؛ صادرکردنِ `reauthenticateWithPopup/Redirect`؛ `driveProvider` ِ قبلی بی‌استفاده ماند (حذف نه). `src/lib/driveAuth.js`: مهلت ۶۰ ثانیه؛ `drivePopupOutcome` (بسته/لغو ⇒ «حساب گوگل را در پنجرهٔ کوچک انتخاب کنید — پنجره بسته شد … تلاش دوباره»؛ مهلت ⇒ «… ۶۰ ثانیه بی‌پاسخ ماند …»؛ مسدود/internal ⇒ redirect؛ حسابِ دیگر ⇒ نامِ حسابِ واردشده). `App.jsx` ِ `authorizeDrive`: `reauthenticateWithPopup(currentUser, driveProviderFor(email))` از دروازهٔ تک‌پنجره؛ وضعیتِ تازهٔ `picking` («👆 حساب گوگل را در پنجرهٔ کوچک انتخاب کنید · نمایشِ پنجره») به‌جای «بارگذاری»؛ `loading` فقط پس از گرفتنِ توکن؛ وضعیتِ `retry` با نوارِ پیامِ دیدنی و دکمهٔ «تلاش دوباره»؛ مسدود ⇒ `reauthenticateWithRedirect` با همان login_hint (نتیجه با `getRedirectResult` ِ موجود). `scripts/drive_popup_check/` (آزمونِ مرورگری).
- [DECISION] به تنظیماتِ OAuth/امنیتی دست نخورد (همان scope، همان پروژه، بی‌کلید/رازِ تازه). **ردشده:** `linkWithPopup` (برای افزودنِ ارائه‌دهندهٔ **دیگر** است؛ گوگلِ همان کاربر را «already-linked» رد می‌کند)؛ نگه‌داشتنِ `prompt: consent` (رضایت در ورودِ اصلی داده شده؛ اجبارش همان صفحهٔ اضافه بود).
- [VERIFY] vitest کامل ۳۶۷ (+۴: پیامِ بسته/لغو/مهلت/حسابِ دیگر، redirect برای مسدود، نگهبانِ متنی: reauthenticate با login_hint، بی‌consent، هیچ «loading» پیش از پنجره) + build. Playwright ِ واقعی روی صفحه‌ای ساخته از همین `driveAuth.js`: ۵/۵ — هنگامِ باز بودن پیامِ «انتخابِ حساب»، کلیکِ دوم پنجرهٔ تازه نساخت، بستنِ پنجره ⇒ پیام + `retry`، مهلت پنجره را خودش بست + پیام. صفحهٔ خودِ گوگل در این ظرف خودکار نمی‌شود ⇒ آزمونِ نهایی با حسابِ مالک روی production.
> **امضا:** `Claude Code` · 2026-11-04 · vitest + build + Playwright


## 2026-11-04 — فوری (برگهٔ ۱۲): اتصالِ درایو بی‌پاسخ، بی‌علت، بی‌اثرِ آخرین همگام‌سازی
- [OWNER] برگهٔ ۱۲: پس از «اتصال» سربرگ بیش از ۹۰ ثانیه «⏳ بارگذاری از درایو…» ماند و بی‌صدا به «درایو وصل نیست» برگشت. خواسته: ۱) مهلتِ ~۲۰ ثانیه + علتِ فارسی + «تلاش دوباره»؛ ۲) «آخرین همگام‌سازیِ موفق: زمان · تعداد»؛ ۳) اگر `VITE_GOOGLE_OAUTH_CLIENT_ID` نیست صریح بگوید؛ ۴) خطا در console و برگهٔ نظارت؛ ضمناً «ثبتِ برگه» از فرمِ کادر بی‌نتیجه ماند.
- [FINDING] ایرادِ «انتخابِ حساب/بسته‌شدنِ بی‌پیام» پیش‌تر در a92ff49 (۲۰:۴۴Z) رفع شده بود (برگه ۱۹:۴۸Z پیش از دیپلو). مانده بود: درخواست‌های درایو (`doDriveSync`) هیچ مهلتی نداشتند ⇒ «loading» بی‌پایان؛ پیامِ علت فقط در title ِ دکمه؛ بی‌نشانِ آخرین همگام‌سازی؛ پیامِ نبودِ شناسهٔ کلاینت مبهم.
- [CHANGE] `src/App.jsx`: `withDriveTimeout` (۲۰ ثانیه ⇒ وضعیتِ `retry` با پیامِ علت)؛ `logDriveError` (console.error + لاگِ محلیِ ۲۰تاییِ `quran.drive.errlog`) برای connect و authorize؛ آخرین همگام‌سازیِ موفق (زمان + تعدادِ آیه/نشست) در `quran.drive.lastSync` و در چیپ؛ در حالتِ خطا پیامِ علت و آخرین همگام‌سازی کنارِ دکمهٔ «تلاش دوباره» نمایان است؛ پیامِ صریحِ نبودِ `VITE_GOOGLE_OAUTH_CLIENT_ID` (کارِ مالک).
- [DECISION] ثبتِ خودکارِ خطای درایو به‌صورتِ برگه در برگهٔ نظارت **نشد** (هر خطا یک برگه ⇒ سیلِ برگه و دورِ ناظر)؛ فقط console + لاگِ محلی. ردشده: ساختنِ برگه از کلاینت.
- [FINDING] «ثبتِ برگه» بی‌نتیجه: در `InspectionLayer.send` فرم فقط پس از موفقیتِ `createSheet` بسته می‌شود و خطا با toast می‌ماند؛ بازتولید نشد (بی‌حسابِ مدیر). گمانِ بدون‌مدرک: toast دیده نشد. دست نزدم؛ نیازِ مدرک (کنسول/شبکه) از مالک.
- [VERIFY] vitest ۳۶۷ سبز؛ build در ship. اتصالِ واقعیِ گوگل در این ظرف ممکن نیست.
> **امضا:** `ناظرِ خودکار (Claude Code routine)` · 2026-11-04 · vitest + ship.sh

## 2026-11-05 — دورِ کامل (ناظر): برگهٔ ۱۳ — برچسبِ «همگام» دروغ می‌گفت
- [OWNER] برگهٔ ۱۳: پاسخِ درستِ تمرین تا «پایان» به درایو نمی‌رفت ولی سربرگ «✓ همگام» بود. خواسته: ۱) ذخیرهٔ خودکار با تأخیرِ کوتاه و هنگامِ پنهان‌شدن/بستنِ صفحه ۲) تا تغییرِ ذخیره‌نشده هست «● N تغییر ذخیره‌نشده» ۳) ادامهٔ دستهٔ نیمه‌کاره روی دستگاهِ دیگر.
- [FINDING] ذخیرهٔ درایو (debounce ۲ ثانیه) فقط `dataset/sessions/…` را می‌دید؛ پاسخ‌های جلسهٔ در جریان در `sessionRef` (ref، نه state) می‌ماندند تا `finishSessionIfAny` ⇒ ریشهٔ ایراد.
- [CHANGE] `src/App.jsx`: شمارندهٔ `unsavedCount`؛ `checkpointSession` جلسهٔ در جریان را (با `checkpoint:true`) به `sessions` upsert می‌کند (بر اساس id، پس نسخهٔ نهایی همان را جایگزین می‌کند و جلسهٔ تکراری نمی‌سازد)؛ ۳۰ ثانیه پس از آخرین پاسخ + `visibilitychange`(hidden) + `pagehide`؛ چیپِ سربرگ تا ذخیره‌نشده هست «● N پاسخ ذخیره‌نشده» را نشان می‌دهد.
- [DECISION] بند ۳ (ادامه از همان آیه روی دستگاهِ دیگر) انجام نشد: نیازمندِ ذخیرهٔ موقعیتِ دسته (deck/pos) در دادهٔ همگام و تصمیمِ ادغام است؛ خطرِ دست‌زدن به قالبِ دادهٔ کاربران. ردشده: ذخیرهٔ deck در همان جلسه (قالبِ جلسه‌ها را برای گزارش‌ها عوض می‌کند).
- [TODO] برگه‌های ۲، ۵، ۶، ۹ (بسته‌های بزرگِ قابلیت: کارت نتیجه، برنامهٔ امروز، SRS، تحلیلِ کلمه‌به‌کلمه) این دور انجام نشد؛ هر کدام طراحیِ جدا می‌خواهد.
> **امضا:** `ناظرِ خودکار (Claude Code routine)` · 2026-11-05 · vitest ۳۶۷ + build

## 2026-11-05 — فوری: برگه‌های ۹، ۶، ۵، ۲ (حافظِ تنبل) + چرا دورِ کامل فقط یک برگه را جلو برد
- [OWNER] (هماهنگ‌کننده) «دورِ کاملِ پنجشنبه ۰۴:۴۷ فقط برگهٔ ۱۳ را انجام داد و ۹، ۶، ۵، ۲ و ۱۱ را not-done / دورِ بعد زد؛ دورِ کاملِ بعدی دوشنبه است. ۱) برگهٔ ۹: «۵ نقطهٔ ضعفِ امروز» به تفکیکِ آیه و کلمه با «تمرینِ همین‌ها»؛ ۲) برگهٔ ۶ بندِ الف «برنامهٔ امروز» در صفحهٔ اول؛ ۳) ۵، ۲، ۱۱ به ترتیب؛ ۴) علتِ یک‌برگه‌ای‌بودنِ دورِ کامل و اصلاحِ پرامپت؛ هر برگه در نظارت جواب بگیرد.»
- [FINDING] transcript ِ همان اجرا (`trig_01UvNwtggi9d2xP4MtszJGpo`، ۰۰:۴۷ تا ۰۰:۵۳ UTC — **۶ دقیقه**): پس از برگهٔ ۱۳، برگه‌های ۲، ۵، ۶ و ۹ را در **یک حلقه** با یک متنِ مشترک و `--dep 'طراحی-قابلیت=missing'` `not-done` زد («بسته‌های بزرگِ قابلیت‌اند»). پرامپت هیچ کفِ پیشرفتی نداشت و «بزرگ است» را منع نمی‌کرد. برگهٔ ۱۱ در کارتابلِ آن دور نبود (۷ برگه، ۶ بدهکار: ۱۲، ۲، ۵، ۶، ۹، ۱۳) — جوابِ قبلی‌اش `fixed` بوده (RUNLOG ۲۰۲۶‑۱۱‑۰۴ ۱۵:۳۰).
- [CHANGE] `src/lib/todayPlan.js` (تازه، خالص): `weakSpots` (آیه‌ها با وزنِ تازگی — نیمه‌عمرِ ۳ روز — تقسیم بر پاسخ‌های درستِ پس از آخرین اشتباه؛ کلمه‌های ضعیفِ هر آیه از `scope: token`/`target` با نوعِ اشتباه: فراموشی (خالی/رد)، اعراب/املا (حروفِ یکسان)، کلمهٔ دیگر)؛ `dueReviews` (مرورِ فاصله‌دار: ۰، ۱، ۳، ۷، ۱۴، ۳۰ روز برحسبِ تعدادِ درست‌های پیاپی پس از آخرین اشتباه؛ ۶ درست = آموخته)؛ `gradedToday`؛ `todayPlan`. `App.jsx`: **برگهٔ ۹** — کارتِ «🎯 ۵ نقطهٔ ضعفِ امروز» بالای جدولِ سوره‌ای با «▶ تمرینِ همین‌ها» (همان `startTestFromReport`) + جملهٔ توضیحِ اختلافِ عددها (بندِ ۲)؛ **برگهٔ ۶-الف** — کارتِ «📅 برنامهٔ امروز» بالای صفحهٔ اول (مرورِ آیه‌های سرِ موعد با یک دکمه، «ادامه از صفحهٔ N»، هدفِ روزانه)؛ **۶-ط** — صفحهٔ حفظ ذخیره و از همان‌جا باز می‌شود (`quran.hifz.lastPage.v1`)؛ **۵-۱ و ۲-۱** — کارتِ نتیجه پس از «پایان تمرین» (تب تمرین) و «پایان و ذخیره تمرین» (صفحهٔ حفظ): درصد، «n از m پاسخ داده شد»، آیه‌های غلط، «تمرینِ مجددِ اشتباه‌ها» و «صفحهٔ بعد»؛ نامِ جلسهٔ تستیِ تمرین «تمرین تستی — <بازه>» (آزمون فقط `mcq_exam`) و بازه در جلسه ثبت می‌شود؛ **۵-۳** راهنمای قفلِ «ترتیب ارائه»؛ **۵-۴** «تشخیص نام سوره» در بازهٔ تک‌سوره پیشنهاد نمی‌شود و کنار می‌رود؛ **۵-۵** `reciters.js`: https://everyayah.com اول (اندازه‌گیری‌شده: qurancdn و verses.quran.com برای هر سه قاری 404، http ِ everyayah 301، https 200؛ منابعِ قبلی پس از آن، حذف نه). `docs/supervisor/PROMPT.md` نسخهٔ ۴ (v3 بایگانی): قاعدهٔ ۷ — دورِ کامل دست‌کم ۳ برگهٔ بدهکار را جلو می‌برد، «بزرگ است» دلیلِ not-done نیست (برش و اولین برشِ قابلِ ارسال)، not-done ِ گروهی ممنوع، قدیمی‌ترین اول، تا ۳ برگه جلو نرفته گزارشِ پایانی نه (سقفِ ۲ ساعت).
- [DECISION] SRS ِ سبک (پله‌های ثابت) به‌جای FSRS/SM-2 ِ کامل: بی‌دادهٔ تازه، فقط از جلسه‌های موجود. **ردشده:** ذخیرهٔ زمان‌بندیِ جدا (دادهٔ تازه برای سینکِ درایو)؛ جابه‌جاییِ فرمِ آپلود از صفحهٔ اول (یادداشتِ هماهنگ‌کننده ۰۶ — قابلیتِ موجود دست نخورد؛ کارتِ برنامه بالای آن آمد). **ماند:** ۶ ب/ج-کامل/د/هـ/و/ز/ح، ۵ بندهای ۲، ۶، ۷، ۸، ۲ بندهای ۲–۴، ۹ بندِ ۳.
- [VERIFY] vitest ۳۷۴ (+۷: نوعِ اشتباه، ترتیب و کلمه‌های ضعیف، اثرِ تازگی و تصحیح، مرورِ سرِ موعد پس از ۱ روز، برنامهٔ امروز، ترتیبِ منبعِ صوت) + build. Playwright روی build ِ محلی با جلسه‌های نمونه: «برنامهٔ امروز» (۳ آیهٔ سرِ موعد، ادامه از صفحهٔ ۳ ِ ذخیره‌شده، هدف) و «۵ نقطهٔ ضعف» (الفاتحة ۴: يَوْمِ ×۳ فراموشی/اعراب/کلمهٔ دیگر) دیده شد؛ «تمرینِ همین‌ها» به /practice با همان آیه‌ها رفت. **جوابِ برگه‌ها در نظارت از این سشن ممکن نیست** (`SUPERVISOR_PASSWORD` ِ روتین در این محیط نیست و خواندنش از Render ممنوع است) ⇒ متن‌ها در RUNLOG برای روتین.
> **امضا:** `Claude Code` · 2026-11-05 · vitest + build + Playwright


## 2026-11-05 — فوری: برگهٔ ۱۴ — «هدف روزانه» و مرزِ روز
- [OWNER] برگهٔ ۱۴: «هدف روزانه: ۱ از ۲۰» دو پاسخِ امروز (۰۲:۳۰ و ۰۵:۴۳ دبی) را یکی شمرد؛ خواسته: همهٔ محاسباتِ روزانه با منطقهٔ زمانیِ کاربر، و پاسخ‌های آزمونِ از-اشتباهات هم شمرده شود.
- [FINDING] کد از `getHours/getDate` (منطقهٔ مرورگر) استفاده می‌کرد، نه UTC؛ پس اگر مرورگرِ مالک منطقه را UTC گزارش کند همین خطا رخ می‌دهد و راهی برای انتخابِ منطقه نبود. یافتهٔ دوم (قطعی): دو شمارندهٔ متفاوت — کارتِ «برنامهٔ امروز» به‌ازای هر پاسخ (`when`)، ولی «هدف و انگیزه» در تنظیمات به‌ازای **زمانِ شروعِ جلسه**؛ جلسه‌ای که پیش از نیمه‌شب شروع و بعد از آن پاسخ داده شد، غلط شمرده می‌شد. پاسخ‌های آزمونِ از-اشتباهات (`mode exam/mcq_exam`، `origin mistakes`) همان `sessions` ‌اند و در شمارش بودند.
- [CHANGE] `src/lib/dayClock.js` (تازه): `dayKey/startOfDay` با `Intl` در منطقهٔ برنامه (`settings.timeZone`، خالی = مرورگر). `stats.js`، `analytics.js`، `todayPlan.js` همه از آن می‌خوانند (هدف، روزهای متوالی، سرِ موعد، سری ۷/۳۰ روز، نقشهٔ فعالیت). `goalToday` در `App.jsx` اکنون همان `gradedToday` است. تنظیمات ← «هدف و انگیزه»: انتخابِ «منطقهٔ زمانیِ روز».
- [DECISION] پیش‌فرض «خودکار = منطقهٔ مرورگر» ماند (نه Asia/Dubai ِ ثابت: کاربرِ دیگر یا سفر را خراب می‌کرد). ردشده: ذخیرهٔ منطقه در Firestore (دادهٔ تازه)؛ فقط در `settings` که خودش با درایو همگام است. مالک اگر هنوز «۱ از ۲۰» دید، منطقه را روی Asia/Dubai بگذارد.
- [VERIFY] vitest ۳۷۶ (+تستِ ۰۲:۳۰ دبی = امروز) سبز؛ build در ship.
> **امضا:** `ناظرِ خودکار (Claude Code routine)` · 2026-11-05 · vitest + ship.sh

## 2026-11-05 — فوری: پنجرهٔ سفیدِ `…firebaseapp.com/__/auth/handler` در «اتصالِ درایو»
- [OWNER] (عکسِ مالک، از راهِ هماهنگ‌کننده) «با «اتصال» درایو، پنجرهٔ کوچکِ quran-app-7566b.firebaseapp.com/__/auth/handler?state=… باز می‌شود ولی کاملاً سفید می‌ماند و اتصال با خطا تمام می‌شود؛ بارِ قبل انتخابگرِ حساب می‌آمد؛ درایو پس از هر بارگذاری قطع است.» خواسته: علت با Playwright؛ پراکسیِ `/__/auth/*` روی همین دامنه و authDomain ِ همین دامنه (روشِ رسمیِ Firebase)؛ redirect اگر popup خالی ماند؛ خواندنِ client_id برای GIS؛ تازه‌سازیِ بی‌صدا؛ گزارشِ دقیقِ کارِ مالک.
- [FINDING] Playwright ِ واقعی: (۱) handler روی firebaseapp.com سالم است — `getProjectConfig` ⇒ `createAuthUri` ⇒ صفحهٔ ورودِ گوگل؛ پس سفیدی از خودِ handler نیست. علت: تحویلِ نتیجه از پنجرهٔ firebaseapp.com به iframe ِ Firebase در صفحهٔ onrender.com — مرورگرهای امروز ذخیره‌سازیِ شخص‌ثالث را جدا می‌کنند و پیام نمی‌رسد؛ با `login_hint` (تغییرِ ۴ نوامبر) گوگل حساب را خودکار برمی‌گزیند و مستقیم به همین مرحله می‌رسد ⇒ پنجرهٔ سفید (پیش‌تر انتخابگر جلوی آن بود). (۲) client_id ِ OAuth (عمومی): `31712827799-6quvsi0ic0qj4cgu8p7jmvbo47qsm8co.apps.googleusercontent.com`؛ تنها redirect URI ِ پذیرفته `https://quran-app-7566b.firebaseapp.com/__/auth/handler`. (۳) آزمونِ پذیرشِ گوگل: handler ِ همین دامنه به‌عنوانِ redirect URI و مبدأ ِ همین دامنه برای GIS هر دو **رد** (`redirect_uri_mismatch` / «Access blocked»)؛ کنترل‌های firebaseapp.com پذیرفته.
- [CHANGE] Render (سرویسِ دستی‌ساختهٔ `quran-web-app`، از راهِ API): قاعدهٔ `rewrite` ِ `/__/auth/*` ⇒ `https://quran-app-7566b.firebaseapp.com/__/auth/*` با priority 0 پیش از `/*` ⇒ `/index.html` — `/__/auth/handler.js` روی سایت بایت‌به‌بایت همان (md5 یکسان)، `/` و `/practice` سالم. `render.yaml` همان قاعده را مستند کرد. `src/lib/driveAuth.js`: `isCrossSiteAuth` و `CROSS_SITE_HINT` — پیامِ بسته/مهلت تا وقتی authDomain دامنهٔ دیگری است علت را می‌گوید. `App.jsx`: `authorizeDriveByRedirect` (`reauthenticateWithRedirect` با همان login_hint) و دکمهٔ «روشِ دوم: ورود با انتقالِ صفحه» در نوارِ خطا. `.env.example`: مقدارِ client_id و ترتیبِ درست. `docs/supervisor/OPEN_ITEMS.md` ‏#10: گام‌های دقیقِ مالک.
- [DECISION] authDomain و client_id ِ GIS را در کد **فعال نکردم**: آزموده شد که هر دو امروز رد می‌شوند — authDomain ِ این دامنه ورود را کاملاً می‌شکست و GIS پنجرهٔ «Access blocked» باز می‌کرد. هر دو از قبل با متغیرِ محیطی (`VITE_FIREBASE_AUTH_DOMAIN`، `VITE_GOOGLE_OAUTH_CLIENT_ID`) کار می‌کنند؛ پس از گامِ مالک در Google Cloud، فقط همان دو متغیر و یک Deploy. به تنظیماتِ OAuth/امنیتی دست نخورد. **ردشده:** گذاشتنِ client_id به‌عنوانِ پیش‌فرضِ کد (پنجرهٔ خطا در هر بارگذاری)؛ redirect ِ خودکار پس از مهلت (انتقالِ ناگهانیِ صفحه — دکمه گذاشته شد).
- [VERIFY] vitest ۳۷۷ (+۲)، build؛ Playwright: handler از راهِ پراکسیِ همین دامنه اجرا شد و تا گوگل رفت و فقط با `redirect_uri_mismatch` ایستاد — همان گامِ مالک. ورودِ کامل با حسابِ واقعی در این ظرف ممکن نیست.
> **امضا:** `Claude Code` · 2026-11-05 · Playwright + vitest + build


## 2026-11-05 — فوری: برگهٔ ۱۷ — آمارِ گمراه‌کنندهٔ جلسه، برچسبِ نوعِ آزمون، جلسهٔ نیمه‌کاره
- [OWNER] برگهٔ ۱۷ (نگاه حافظ تنبل): ۱) «تمرین شده: ۶ آیه · ۱ درست · ۱۰۰٪» در حالی که فقط ۱ از ۶ آیه پاسخ داده شد؛ ۲) آزمونِ تایپی با برچسبِ «آزمون از اشتباهات (۸ آیه)» بی‌ذکرِ نوع؛ ۳) جلسهٔ تستیِ نیمه‌کاره در فهرست نیست؛ ۴) پیشنهادِ یکی‌کردنِ جلسه‌های بسیار کوتاهِ پشت‌سرهم.
- [CHANGE] `src/App.jsx` — ۱) خطِ «تمرین شده» فقط آیه‌های واقعاً پاسخ‌داده‌شده را می‌شمارد؛ خطِ تازهٔ «n از m آیه پاسخ داده شد (k باز نشد) · پوشش x٪» (جدا از دقت) وقتی پوشش کامل نیست. ۲) `sessionLabel`: «آزمون از اشتباهات (تایپی|تستی، n آیه|سوال)». ۳) جلسهٔ checkpointشده «— نیمه‌کاره» در عنوان و یادداشت؛ تغییرِ تب هم checkpoint می‌گیرد (پیش‌تر فقط ۳۰ ثانیه/hidden/pagehide).
- [DECISION] بند ۴ (ادغامِ خودکارِ جلسه‌ها) انجام نشد: قالبِ دادهٔ همگام‌شده را عوض می‌کند و پیشنهاد بود. جلسهٔ ۰۰:۲۵ پیش از checkpoint ِ برگهٔ ۱۳ شروع شده بود و قابل بازیابی نیست.
> **امضا:** `ناظرِ خودکار (Claude Code routine)` · 2026-11-05 · vitest + ship.sh

## 2026-11-08 — فوری: برگهٔ ۱۵ — متنِ بلندِ «درایو وصل نیست» در سربرگ
- [OWNER] برگهٔ ۱۵: وقتی درایو وصل نیست، متنِ کاملِ «…VITE_GOOGLE_OAUTH_CLIENT_ID…» و «آخرین همگام‌سازی…» داخلِ سربرگ یک خطِ بلند می‌ساخت؛ عنوان سه‌خطه می‌شد و نام/خروج بیرون می‌زد. خواسته: چیپِ کوتاه + ⓘ، توضیح در tooltip/نوار، نام متغیر فقط برای مدیر.
- [CHANGE] `src/App.jsx`: چیپِ سربرگ فقط «⚠ درایو وصل نیست — اتصال/تلاش دوباره» + ⓘ؛ پیام و «آخرین همگام‌سازی» در `title`. برای وضعیتِ `reconnect` نوارِ نازکِ قابل‌بستن زیرِ سربرگ (`drive-reconnect-note`) افزوده شد؛ نامِ متغیر فقط اگر `role.kind==="admin"`. متنِ عمومیِ پیام بی‌نامِ فنی شد. اتصالِ یک‌کلیکی دست‌نخورده.
- [DECISION] تغییرِ CSS لازم نبود (متنِ بلند از سربرگ حذف شد). ردشده: جداکردنِ state ِ پیام برای مدیر/غیرمدیر (پیچیده‌تر؛ الحاقِ شرطی در رندر کافی است).
> **امضا:** `ناظرِ خودکار (Claude Code routine)` · 2026-11-08 · vitest + build در ship.sh

## 2026-11-08 — فوری: پنجرهٔ ورود روی firebaseapp.com با DNS_PROBE_FINISHED_NXDOMAIN
- [OWNER] هماهنگ‌کننده ۱۷:۵۷ دبی: پنجرهٔ `quran-app-7566b.firebaseapp.com/__/auth/handler` روی کامپیوترِ مالک «This site can't be reached / NXDOMAIN». ۱) وجودِ firebaseapp.com و web.app را بسنج؛ ۲) اگر نیست authDomain پیش‌فرض = دامنهٔ سایت (rewrite ِ 7259bea)، بی‌متغیرِ Render؛ ۳) پاپ‌آپِ خراب باز نشود، پیامِ یک‌خطی؛ ۴) قدمِ Google Cloud Console دقیق برای مالک؛ تنظیماتِ امنیتی/OAuth دست نخورد.
- [FINDING] دامنه‌ها **وجود دارند**: DNS-over-HTTPS ِ Google و Cloudflare برای `quran-app-7566b.firebaseapp.com` و `quran-app-7566b.web.app` ⇒ `199.36.158.100` (Firebase Hosting)، `/__/auth/handler` ⇒ 200 (Quad9 از این محیط در دسترس نبود؛ `dig` نصب نیست و DNS ِ UDP بسته است). پس NXDOMAIN ِ مالک از DNS ِ همان شبکه/ISP است (فیلترِ firebaseapp.com)، نه پروژهٔ ازبین‌رفته.
- [FINDING] پراکسیِ همین سایت کار می‌کند: `https://quran-web-app-8rwy.onrender.com/__/auth/handler`، `handler.js`، `iframe` ⇒ 200 با همان محتوا. `/__/firebase/init.json` اینجا index.html (۲۰۰) می‌دهد و آن‌جا ۴۰۴ — در handler.js هر دو شکست به یک شاخه (`J(!0)`) می‌روند ⇒ بی‌اثر.
- [FINDING] **مانعِ قطعی:** درخواستِ OAuth ِ گوگل با `redirect_uri=https://quran-web-app-8rwy.onrender.com/__/auth/handler` (کلاینت 31712827799-6quvsi…) ⇒ `redirect_uri_mismatch` («register the redirect URI in the Google Cloud Console»)؛ با redirect ِ firebaseapp.com پذیرفته می‌شود. یعنی اگر authDomain همین الان در کد سایت شود، ورودِ **همهٔ** کاربران (نه فقط مالک) روی صفحهٔ خطای گوگل می‌ماند.
- [DECISION] `src/lib/authDomain.js`: `pickAuthDomain` — env › میزبانِ سایت **فقط اگر** در `SAME_SITE_AUTH_HOSTS` `true` باشد › firebaseapp.com. برای onrender فعلاً `false`؛ پس از ثبتِ URI توسطِ مالک، یک خط `true` می‌شود (یا `VITE_FIREBASE_AUTH_DOMAIN`). **ردشده:** پیش‌فرضِ بی‌شرطِ دامنهٔ سایت (خواستهٔ بند ۲ — ورودِ همه را می‌شکست؛ با سنجش رد شد)؛ تشخیصِ خودکارِ ثبتِ URI از مرورگر (بی‌CORS ممکن نیست)؛ دست‌زدن به کنسولِ گوگل (قاعدهٔ ۷).
- [CHANGE] بند ۳: پیش از هر پنجره، دسترسی‌پذیریِ میزبانِ ورود در **پس‌زمینه** هنگامِ بارگذاری سنجیده می‌شود (`fetch` no-cors به `/__/auth/handler.js`، ۵ ثانیه، کشِ ۵ دقیقه)؛ کلیک فقط نتیجهٔ آماده را می‌خواند (await پیش از window.open فعال‌سازیِ کاربر را می‌سوزاند و مرورگر پنجره را می‌بندد). اگر «دست‌نیافتنی» ⇒ «ورود با گوگل»، «اتصال/تلاش دوباره» و «روشِ دوم» هیچ پنجره/انتقالی باز نمی‌کنند و یک خط: «اتصال ممکن نیست: دامنهٔ ورودِ گوگل (firebaseapp.com) از اینترنتِ این دستگاه باز نمی‌شود — با شبکهٔ دیگر یا VPN امتحان کنید؛ رفعِ دائمی یک تنظیمِ مالک است.» پنجره همچنان فقط از کلیک باز می‌شود (خودکار هیچ‌جا).
- [VERIFY] vitest ۳۸۴ سبز (تازه: `authDomain.test.js` ۷ تست؛ نگهبانِ `firebaseConfig.test.js` برای authDomain به «fallback = pickAuthDomain» به‌روز شد)، build. Playwright روی build: firebaseapp.com با `namenotresolved` ⇒ کلیکِ ورود: ۰ پنجره + پیام؛ در دسترس ⇒ ۱ پنجره مثلِ قبل.
- [OWNER] **قدم‌های مالک (Google Cloud Console — فقط خودِ مالک):**
  1. https://console.cloud.google.com/apis/credentials?project=quran-app-7566b
  2. «OAuth 2.0 Client IDs» › «Web client (auto created by Google Service)» (شناسه با `31712827799-6quvsi0ic0qj4cgu8p7jmvbo47qsm8co` شروع می‌شود) › مداد (Edit).
  3. «Authorized JavaScript origins» › ADD URI › `https://quran-web-app-8rwy.onrender.com`
  4. «Authorized redirect URIs» › ADD URI › `https://quran-web-app-8rwy.onrender.com/__/auth/handler` (دقیقاً همین، بی‌اسلشِ پایانی)
  5. SAVE؛ ۵ دقیقه تا چند ساعت طول می‌کشد.
  6. (بررسی، معمولاً از قبل هست) Firebase Console › Authentication › Settings › Authorized domains ⇒ `quran-web-app-8rwy.onrender.com` باشد.
  7. خبر بده؛ با همان آزمونِ بی‌رمز (`redirect_uri_mismatch` یا نه) می‌سنجم و `SAME_SITE_AUTH_HOSTS` را `true` می‌کنم — نیازی به متغیرِ Render نیست.
- [VERIFY] production پس از دیپلوی a962078: Playwright روی https://quran-web-app-8rwy.onrender.com — firebaseapp.com مسدود (`namenotresolved`) ⇒ کلیکِ «ورود با گوگل»: ۰ پنجره + پیامِ یک‌خطی؛ در دسترس ⇒ ۱ پنجره مثلِ قبل. سنجشِ پس‌زمینه فقط یک درخواست به `/__/auth/handler.js`.
- [REVERT] revert ِ همین کامیت؛ پیش‌فرض همان firebaseapp.com است، پس رفتارِ کاربرانی که به firebaseapp.com دسترسی دارند عوض نشده.
> **امضا:** `Claude Code (coordinator task)` · 2026-11-08 · vitest + build + Playwright

## 2026-11-08 — فوری: بنرِ «درایو وصل نیست» + «VITE_GOOGLE_OAUTH_CLIENT_ID تنظیم نشده» — کدام درست است؟
- [OWNER] هماهنگ‌کننده ۱۸:۵۰ دبی: بنر به مدیر می‌گوید متغیرِ Render تنظیم نشده ولی گفته شد «متغیرِ Render لازم نیست». ۱) روشن کن؛ اگر Client ID ِ عمومی کافی است در کد بگذار، وگرنه گامِ دقیق؛ ۲) `/__/firebase/init.json` روی onrender = index.html با ۲۰۰ — لازم است یا نه؛ ۳) پیامِ فنیِ مدیر به کاربرِ عادی نرسد. سنجش بی‌بازکردنِ پنجرهٔ ورود.
- [FINDING] دو متغیرِ جدا بودند: «لازم نیست» دربارهٔ `VITE_FIREBASE_AUTH_DOMAIN` (کلیدِ authDomain ِ هم‌سایت در کد) بود؛ بنر دربارهٔ `VITE_GOOGLE_OAUTH_CLIENT_ID` است که فقط **اتصالِ خودکارِ** درایو (توکنِ بی‌صدای GIS) را روشن می‌کند. Client ID عمومی است (راز نیست) ولی کافی نیست: آزمونِ بی‌رمزِ authorize با `redirect_uri=storagerelay://https/quran-web-app-8rwy.onrender.com` ⇒ `redirect_uri_mismatch` (همان یافتهٔ 2026-11-05 در `.env.example`)؛ یعنی origin ِ سایت روی کلاینت ثبت نیست و GIS فقط شکست می‌خورد (و جریانِ توکنش پنجره به کار می‌برد).
- [CHANGE] `src/lib/authDomain.js`: `PUBLIC_OAUTH_WEB_CLIENT_ID` + `GIS_ORIGIN_REGISTERED` (onrender: `false`) + `pickGisClientId`؛ `gisToken.gisClientId()` = env › همین شناسه فقط برای میزبانِ ثبت‌شده. پس از گامِ ۳ ِ مالک (JS origin) فقط آن پرچم `true` می‌شود — **بی‌متغیرِ Render**.
- [CHANGE] بنر: پانویسِ فنی فقط برای مدیر و فقط وقتی علت همین است (`role.kind==="admin" && !gisClientId()`)، با علتِ درست: «اتصالِ خودکار منتظرِ ثبتِ Authorized JavaScript origin ِ این سایت در Google Cloud است». کاربرِ عادی فقط «اتصال خودکار … فعال نیست. با «اتصال» دستی وصل شوید» را می‌بیند (این از قبل هم فقط برای مدیر بود؛ متنِ غلطِ «متغیرِ Render» برداشته شد).
- [DECISION] `/__/firebase/init.json` **لازم نیست** و دست نخورد: در `handler.js` ِ Firebase پاسخِ ۴۰۴ و JSON ِ نامعتبر هر دو به همان شاخهٔ `function(){return J(!0)}` می‌روند (فقط یک بررسیِ اضافیِ apiKey را رد می‌کند). **ردشده:** افزودنِ route ِ تازه روی سرویسِ زنده با Render API (ریسکِ بی‌فایده).
- [VERIFY] vitest ۳۸۶ سبز (تازه: `pickGisClientId`، پانویسِ فقط‌مدیر)، build.
- [VERIFY] production پس از 7b3cf4a (بی‌بازکردنِ پنجرهٔ ورود): باندلِ `index-C7n46s1L.js` — متنِ «VITE_GOOGLE_OAUTH_CLIENT_ID در تنظیمات Render» ۰، پانویسِ تازه ۱، شناسهٔ عمومی ۱، هر دو پرچمِ onrender `!1` (خاموش)؛ Playwright: بارگذاریِ صفحه ۰ پنجره، ۰ درخواست به اسکریپتِ GIS. (اولین خواندن باندلِ قبلی را از CDN داد؛ با cache-buster تازه آمد.)
- [OWNER] همان گام‌های بخشِ قبلی (Google Cloud Console › Credentials › Web client): **گامِ ۳ (JavaScript origin `https://quran-web-app-8rwy.onrender.com`) اتصالِ خودکارِ درایو را باز می‌کند؛ گامِ ۴ (redirect URI) دامنهٔ ورودِ هم‌سایت را.** خبر بده؛ هر دو را با آزمونِ بی‌رمز می‌سنجم و پرچم‌ها را روشن می‌کنم.
> **امضا:** `Claude Code (coordinator task)` · 2026-11-08 · vitest + build

## 2026-11-08 — برگهٔ فوری ۱۶: آیا پاسخ‌های آزمون (تستی/تایپی) در هدف روزانه شمرده می‌شوند؟
- [OWNER] بازتستِ برگهٔ ۱۴: مرز روز درست شد؛ ولی آزمونِ تستی ۰۰:۲۵ و آزمونِ تایپی ۱۲:۱۰ دبی در «هدف امروز» نیامد. یا بشمار، یا زیرِ هدف بنویس «فقط تمرین».
- [FINDING] در کد هیچ استثنایی نیست: `gradedToday` همهٔ `wrongItems/correctItems` ِ **همهٔ** جلسه‌ها (از جمله `mode: exam | mcq_exam`) را با مهرِ `when` می‌شمارد؛ هر دو مسیرِ آزمون (`submitCurrent`، `handleMcqTrainAnswer`) با `recordWrong/recordCorrect` ثبت می‌کنند و `finishSessionIfAny` جلسه را در `sessions` می‌گذارد. با جلسه‌هایی به شکلِ دقیقِ آزمون (و منطقهٔ Asia/Dubai) هر ۴ پاسخ شمرده می‌شود (تستِ تازه).
- [DECISION] علتِ مشاهده را از روی کد نمی‌توان اثبات کرد (دادهٔ جلسه‌های مالک را نمی‌خوانم). محتمل‌ترین: آن دو آزمون پیش از انتشارِ ۱۲:۲۶ UTC یا پیش از چک‌پوینتِ برگهٔ ۱۳ ثبت شده بودند / صفحه نسخهٔ قدیمی داشت. گزینهٔ ردشده: «فقط تمرین» — چون کد عمداً هر دو را می‌شمارد و مالک شمارششان را خواسته.
- [CHANGE] تستِ regression برای آزمونِ تستی/تایپی در `todayPlan.test.js`؛ برچسبِ هدف در تنظیمات: «پاسخ‌های تمرین و آزمون (تستی و تایپی) شمرده می‌شود».
- [VERIFY] vitest. بازتستِ مالک لازم است: یک آزمونِ کوتاه با نسخهٔ تازه (صفحه را تازه‌سازی کن) و دیدنِ افزایشِ شمارنده.
> **امضا:** `ناظرِ خودکار (Claude Code routine)` · 2026-11-08 · vitest

## 2026-11-08 — برگهٔ فوری ۱۸: آزمون از اشتباهات (تستی) — چهار ایراد
- [OWNER] بندِ هدف روزانه تأیید شد. ایرادها: ۱) آزمونِ تستی بی‌پیام در تبِ دیگر؛ ۲) ۲۰ خواسته ولی ۸ سؤال بی‌توضیح؛ ۳) انحرافیِ «يَرْمِ» از سورهٔ دیگر؛ ۴) آزمونِ نیمه‌کاره بی‌هشدار جایگزین شد.
- [CHANGE] `startExamFromMistakes`: شاخهٔ تستی `setTab('exam')` می‌زند؛ اگر سؤالِ ساخته‌شده < درخواستی: «N آیه در فهرستِ اشتباهات است؛ آزمون N سؤالی شد» (تایپی هم)؛ آزمونِ نیمه‌کارهٔ قبلی با `checkpointSession` در سوابق ذخیره و پیامی با «x از y» داده می‌شود. `similarDistractors`: امتیازِ هم‌سوره/هم‌صفحه قوی‌تر (۱٫۲/۱٫۶)؛ «يَرْمِ» واژهٔ واقعیِ قرآن است (۴:۱۱۲) ولی از سورهٔ دیگر؛ حالا هم‌سوره‌ای‌ها مقدم‌اند و تشابهِ املایی هنوز اولویت دارد.
- [DECISION] علتِ دقیقِ «تبِ دیگر» از کد تکرارپذیر نشد (کد در تبِ آزمون رندر می‌کند)؛ `setTab('exam')` صریح + پیام جلوی ابهام را می‌گیرد. گزینهٔ ردشده: confirm() مسدودکننده برای جایگزینی (به‌جایش ذخیره + اعلان، برگشت‌پذیر).
- [VERIFY] vitest ۳۸۸.
> **امضا:** `ناظرِ خودکار (Claude Code routine)` · 2026-11-08 · vitest

## 2026-11-08 — برگهٔ فوری ۲۲: بازتستِ برگهٔ ۱۸ — انحرافیِ هم‌سوره و آزمونِ ناتمام در آمار
- [OWNER] بندهای ۲ و ۴ و ماندنِ در تبِ آزمون تأیید شد. ایرادها: ۱) برای الفاتحه ۴ هنوز «يَرْمِ»/«لِيَوْمٍ» از سوره‌های دیگر می‌آید؛ ۲) آزمونِ ناتمامِ ذخیره‌شده در «کل آزمون‌ها»، «میانگین دقت» و «قبولی» شمرده شد.
- [CHANGE] `similarDistractors`: دو لایه — واژه‌های هم‌سوره/هم‌صفحه **همیشه** مقدم‌اند (امتیاز فقط با فاصلهٔ ویرایشی + اختلافِ طول)، واژهٔ سوره‌های دیگر فقط برای تکمیلِ کمبود. قبلاً امتیازِ نزدیکیِ املایی می‌توانست بر هم‌سوره بچربد.
- [CHANGE] `examStats`: جلسه‌های `checkpoint` از شمارش/میانگین/بهترین/قبولی بیرون‌اند؛ برچسب «کل آزمون‌ها (+n ناتمام)». ردیفِ تاریخچه از قبل «— نیمه‌کاره» می‌گفت.
- [DECISION] گزینهٔ ردشده: حذفِ جلسهٔ ناتمام از سوابق (قاعدهٔ «چیزی حذف نمی‌شود» و بندِ ۴ برگهٔ ۱۸ که ذخیره‌اش را خواست).
- [VERIFY] vitest، build.
> **امضا:** `ناظرِ خودکار (Claude Code routine)` · 2026-11-08 · vitest

## 2026-11-08 — برگهٔ فوری ۲۳: تمرینِ حافظ تنبل — ترتیب، بازخوردِ پاسخِ درست، بنرِ درایو
- [OWNER] ۱) با «ترتیبی» اول آیهٔ ۷ و بعد ۵ آمد؛ ۲) «الضالين» با Enter بی‌بازخورد رد شد؛ ۳) بنرِ صورتیِ درایو ثابت و بزرگ است، پس از × همان روز نیاید.
- [FINDING] ۱) `buildPracticeCards` با `sequential` فقط ترتیبِ ورودی (مرتب‌شده بر سوره/آیه) را نگه می‌دارد و پاسخِ غلط فقط به **انتهای** دسته می‌رود (`repeatQueue`)؛ پس ۷←۵ از این مسیر تکرارپذیر نشد (تستِ تازه ۱→۷ را قفل می‌کند). محتملاً بازماندهٔ دسته/آزمونِ قبلی یا «تکرارِ غلط‌ها» بوده؛ بدونِ دادهٔ جلسهٔ مالک اثبات نمی‌شود.
- [CHANGE] ۲) پاسخِ درستِ تایپی: به‌جای اعلانِ گذرا، پنلِ سبزِ «✓ درست بود» + متنِ صحیح ۲ ثانیه (`okFlash`)؛ غلط از قبل پنلِ قرمز داشت. ۳) بنرهای درایو (reconnect/retry/error) با × تا پایانِ همان روزِ محلی پنهان می‌مانند (`quran.driveBannerDismissedDay`)؛ چیپِ سربرگ وضعیت را نشان می‌دهد.
- [DECISION] تبدیلِ بنر به آیکون ردشد (چیپِ سربرگ همان نقش را دارد؛ تغییرِ کوچک‌تر و برگشت‌پذیر).
- [VERIFY] vitest، build.
> **امضا:** `ناظرِ خودکار (Claude Code routine)` · 2026-11-08 · vitest

## 2026-11-08 — مالک origin و redirect URI را در Google Cloud ثبت کرد ⇒ ورودِ هم‌سایت روشن؛ تمدیدِ خودکارِ GIS عمداً خاموش
- [OWNER] هماهنگ‌کننده: مالک در Web client ِ quran-app-7566b ‏«Authorized JavaScript origins» = `https://quran-web-app-8rwy.onrender.com` و «Authorized redirect URIs» = `…/__/auth/handler` را ذخیره کرد؛ Firebase Authorized domains هم onrender را دارد. ۱) آزمونِ بی‌رمز؛ ۲) کلیدِ authDomain و اتصالِ خودکارِ درایو را روشن کن؛ ۳) بنرِ «منتظرِ ثبت» را بردار؛ ۴) بگو مالک یک بار «اتصال» بزند یا هیچ.
- [VERIFY] آزمونِ بی‌رمز (20:22 UTC): `redirect_uri=…onrender…/__/auth/handler` ⇒ پذیرفته (پیش‌تر `redirect_uri_mismatch`)؛ `storagerelay://https/quran-web-app-8rwy.onrender.com` (origin ِ GIS) ⇒ پذیرفته؛ کنترل (firebaseapp) ⇒ پذیرفته. انتظارِ ۲۰دقیقه‌ای لازم نشد.
- [FINDING] روی origin ِ production با Playwright: کلاینتِ توکنِ GIS حتی با `prompt:"none"` **پنجره باز می‌کند** (`window.open` → accounts.google.com). همهٔ فراخواننده‌های «تمدیدِ بی‌صدا» بی‌کلیک‌اند (بارگذاری، ۴۰۱، تایمرِ ۵۵ دقیقه) ⇒ یا مرورگر می‌بندد (بی‌فایده) یا اگر popup برای سایت مجاز باشد در هر بازدید پنجرهٔ کوچکی می‌پرد — همان شکایتِ 2026-11-04.
- [DECISION] `SAME_SITE_AUTH_HOSTS[onrender] = true` (ورود و اتصالِ درایو از دامنهٔ خودِ سایت؛ firebaseapp.com ِ فیلترشده از مسیر بیرون است و سنجشِ دسترسی برای دامنهٔ خودی درخواستی نمی‌زند). `GIS_ORIGIN_REGISTERED[onrender]` **خاموش ماند** با توضیحِ اندازه‌گیری در کد. **ردشده:** روشن‌کردنِ GIS طبقِ خواسته (پنجرهٔ پرنده یا بی‌اثر)؛ تمدیدِ واقعاً بی‌صدا با refresh token ِ سرور (گزینهٔ A ِ برگهٔ ۳، ردشدهٔ مالک — فقط با تصمیمِ تازهٔ مالک).
- [CHANGE] بنر: پانویسِ مدیر برداشته شد؛ پیام برای همه یک خط: «درایو وصل نیست — «اتصال» را بزنید؛ داده‌های محلی حفظ شده‌اند.»
- [VERIFY] vitest ۳۹۰، build. production پس از 7a13aa7 (مرورگرِ headless ِ خودم، نه صفحهٔ مالک): باندلِ `index-BXJ_JSG-.js` کلیدِ onrender روشن، پانویسِ فنی ۰. شبیه‌سازیِ شبکهٔ مالک (firebaseapp.com ⇒ `namenotresolved`): کلیکِ «ورود با گوگل» ⇒ پنجره از `/__/auth/handler` ِ خودِ سایت به صفحهٔ ورودِ گوگل (`accounts.google.com/v3/signin/identifier`, context_uri = onrender) بی‌خطا رسید؛ ۰ درخواست از مرورگر به firebaseapp.com؛ پیامِ «اتصال ممکن نیست» نیامد.
> **امضا:** `Claude Code (coordinator task)` · 2026-11-08 · oauth probe + vitest + build

## 2026-11-08 — اتصالِ دائمیِ درایو: refresh token ِ رمزنگاری‌شده روی سرور، تمدیدِ بی‌پنجره (گزینهٔ A ِ برگهٔ ۳)
- [OWNER] تصمیمِ صریحِ مالک (از هماهنگ‌کننده): «هر کاری لازم است بکن تا همه چیز خودکار شود و نیاز به تمدید هرباره نباشد؛ من قبلاً چیزی رد نکرده بودم.» ⇒ جریانِ authorization-code با offline + consent فقط یک بار (همان کلیکِ «اتصال»)، refresh token فقط سمتِ سرور و رمزنگاری‌شده، همان scope ِ درایو، دکمهٔ قطع/ابطال، گام‌های دقیقِ مالک.
- [CORRECTION] در گزارش‌های 2026-11-08 نوشتم گزینهٔ A «ردشدهٔ مالک» است. مالک می‌گوید چیزی رد نکرده بود؛ آن برداشت از یادداشتِ «owner sheet 3, option B» در کد بود که تصمیمِ آن دور را ثبت کرده بود، نه ردِ A. ورودی‌های قبلی دست نخوردند.
- [FINDING] در منبعِ GIS (`accounts.google.com/gsi/client`): کلاینتِ CODE خودش `access_type=offline` و `prompt=consent` می‌فرستد؛ در حالتِ popup کد با postMessage برمی‌گردد و تبادل با `redirect_uri=postmessage` است ⇒ **redirect URI ِ تازه لازم نیست**؛ JavaScript origin ِ سایت (که مالک ثبت کرد) کافی است.
- [CHANGE] سرور `server/driveOffline.mjs` (+ اتصال در `telegram-bot.mjs`): `POST /api/drive/connect {code}` (تبادل با client secret؛ بررسیِ scope ِ درایو؛ ایمیلِ Drive `about.user` باید همان ایمیلِ Firebase ِ کاربر باشد وگرنه ابطال و ۴۰۹؛ ذخیرهٔ refresh token با AES-256-GCM، کلید = SHA-256 ِ `DRIVE_TOKEN_KEY`، در `driveOfflineTokens/{uid}` که فقط سرور (Admin SDK) به آن می‌رسد)، `POST /api/drive/token` (کش تا ۵ دقیقه پیش از انقضا، سپس refresh؛ `invalid_grant` ⇒ حذف و ۴۱۰ reconnect)، `POST /api/drive/disconnect` (revoke در گوگل + حذف)، `GET /api/drive/status`، `GET /api/drive/health` (بی‌ورود، فقط `configured`). خطاها فقط با کدِ خطای گوگل لاگ می‌شوند؛ توکن/راز هرگز. CORS فقط originهای اپ؛ ناظر و ناشناس ۴۰۱.
- [CHANGE] کلاینت `src/lib/driveOffline.js` + `App.jsx`: بارگذاری/۴۰۱/تایمرِ ۵۰ دقیقه اول از سرور توکن می‌گیرند (بی‌پنجره)؛ «اتصال» وقتی سرور آماده است جریانِ کد را **هم‌زمان در همان کلیک** باز می‌کند (GIS از قبل preload می‌شود تا popup مسدود نشود)؛ وگرنه همان مسیرِ قبلی (هیچ قابلیتی حذف نشد). دکمهٔ «قطعِ اتصالِ درایو» کنارِ «خروج» با confirm. `firestore.rules`: فقط توضیح (default deny همان است).
- [DECISION] refresh token در Firestore ِ رمزنگاری‌شده، نه دیسکِ سرور (سرویسِ Render دیسکِ ماندگار ندارد) و نه مرورگر. **ردشده:** نگه‌داشتنِ refresh token در مرورگر (خلافِ خواسته)؛ GIS ِ توکنی (پنجره باز می‌کند)؛ redirect ِ کامل‌صفحه با URI ِ تازه (لازم نبود).
- [VERIFY] سرور ۵۶ تست (تازه ۱۱: رمزنگاری/دست‌کاری/کلیدِ دیگر، تبادل با postmessage و ذخیرهٔ فقط ciphertext، حسابِ دیگر ⇒ ۴۰۹ + revoke، scope ِ ناقص، تمدید پس از انقضا و پس از راه‌اندازیِ دوباره، invalid_grant، disconnect، پیکربندی‌نشده، HTTP/CORS/ناظر، health)؛ vitest ۳۹۵ (تازه ۵)؛ pytest؛ build.
- [VERIFY] production پس از e3e3aa7 (بات و سایت live): `GET /api/drive/health` ⇒ `{"configured":false}` (متغیرها هنوز تنظیم نشده‌اند؛ برنامه رفتارِ قبلی را دارد)؛ `token`/`connect`/`disconnect` بی‌توکن، با توکنِ جعلی و با حسابِ ناظر ⇒ ۴۰۱؛ `status` بی‌توکن ⇒ ۴۰۱؛ CORS فقط برای origin ِ سایت؛ بارگذاریِ صفحه ۰ پنجره. (اولین اندازه‌گیری «۲۰۰» نشان داد که خطِ CONNECT ِ پراکسیِ خروجی بود، نه پاسخِ سرور.) سنجشِ «تمدید پس از انقضا بی‌پنجره» با گوگلِ واقعی فقط پس از تنظیمِ متغیرها و یک «اتصال» ِ مالک ممکن است: health ⇒ true، سپس پس از >۱ ساعت لاگِ `[drive-offline] refreshed <uid>` (بی‌توکن) در Render.
- [OWNER] **کارِ مالک:** (۱) Google Cloud › Credentials › Web client › Client secret را کپی؛ (۲) Render › quran-telegram-bot › Environment: `GOOGLE_OAUTH_CLIENT_SECRET` (همان راز) و `DRIVE_TOKEN_KEY` (Generate یا رشتهٔ تصادفیِ ≥ ۳۲ نویسه — بعداً هرگز عوض نشود) ⇒ Save؛ (۳) پس از دیپلوی یک بار «اتصال» و تأییدِ دسترسیِ درایو در پنجرهٔ گوگل. redirect URI ِ تازه لازم نیست.
> **امضا:** `Claude Code (coordinator task)` · 2026-11-08 · node --test + vitest + pytest + build

## 2026-11-08 — برگهٔ فوری ۱۹: سرسورهٔ غلط وسط سوره در صفحهٔ حفظ + جابه‌جایی دکمهٔ «پخش ممتد»
- [OWNER] برگهٔ ۱۹ (حافظ تنبل): در صفحهٔ ۱۶۷ (آیهٔ ۱۳۸ اعراف) کادرِ سرسورهٔ «الاعراف» نمایش داده می‌شد؛ دکمهٔ شناورِ پخش ممتد روی متنِ آیه می‌افتاد؛ پیشنهاد: تکرارِ هر آیه N بار و مکث برای تکرار.
- [CHANGE] `src/App.jsx` (صفحهٔ حفظ): سرسوره و بسم‌الله فقط وقتی `ayah_number === 1` می‌آید (پیش‌تر هر آیهٔ اولِ صفحه، حتی وسط سوره). دکمهٔ «شروع/توقف پخش ممتد» از نوارِ شناورِ پایین به `hifz-page-header` (بالای صفحه، غیرِ شناور) رفت؛ نوارِ شناور فقط در تمرینِ فعال می‌آید.
- [DECISION] پیشنهادِ ۳ (تکرار هر آیه N بار / مکث) این دور انجام نشد: قابلیتِ تازهٔ نیازمندِ طراحی (تنظیمات، وضعیتِ پخش) است، نه رفعِ ایراد؛ برگه `partial` ثبت می‌شود. ردشده: کوچک‌کردنِ نوار (باز هم روی متن می‌افتاد).
- [VERIFY] vitest، build (ship.sh).
> **امضا:** `ناظرِ خودکار (Claude Code routine)` · 2026-11-08 · vitest + build

## 2026-11-08 — برگهٔ فوری ۲۰: پوششِ آزمونِ تستیِ نیمه‌کاره، نامِ جلسهٔ برنامهٔ امروز، توضیحِ مخرجِ دقت
- [OWNER] برگهٔ ۲۰: ۱) آزمونِ تستیِ ۸ سؤالی با ۱ پاسخ «۱۰۰٪» بی‌ذکرِ «۱ از ۸ · پوشش ۱۳٪» (اصلاحِ برگهٔ ۱۷ فقط روی گزارشِ تمرینی بود)؛ ۲) جلسهٔ شروع‌شده از «برنامهٔ امروز ← مرور فاصله‌دار» در فهرست «مرور اشتباهات» نام می‌گرفت؛ ۳) توضیحِ مخرجِ «دقت کلی».
- [CHANGE] `src/App.jsx`: گزارشِ تستی هم `coverageText` و برچسبِ «نیمه‌کاره» می‌گیرد (`plannedCount` به `cur.size` برمی‌گردد). `startTestFromReport(items, source)`؛ کارتِ برنامهٔ امروز `'plan'` می‌فرستد ⇒ جلسه `source:'plan'` و نامش «مرورِ فاصله‌دارِ آیه‌های ضعیف (N آیه)». زیرنویسِ «دقت کلی»: فقط پاسخ‌های ثبت‌شده، نیمه‌کاره‌ها هم، آیه‌های بازنشده نه (طبقِ `appStateStore.js`: graded = درست+غلط).
- [DECISION] نامِ جلسه با فیلدِ تازهٔ `source` است نه حدس از متن؛ جلسه‌های قدیمی همان نامِ پیشین را نگه می‌دارند (داده تغییر نمی‌کند).
- [VERIFY] vitest، build (ship.sh).
> **امضا:** `ناظرِ خودکار (Claude Code routine)` · 2026-11-08 · vitest + build

## 2026-11-08 — برگهٔ فوری ۲۱: قاریِ معلّم، تکرارِ هر آیه، سرعتِ پخش، راهنمای تأخیرِ صدا (جزئی)
- [OWNER] برگهٔ ۲۱ (اولویت ۲ و ۱): قاریِ معلّم/عفاسی/عبدالباسط؛ تکرارِ هر آیه N بار و تکرارِ بازه؛ مکث برای تکرار؛ مقدارِ پیش‌فرضِ تأخیرِ پیشروی با صدا؛ سرعتِ پخش.
- [VERIFY] پیش از افزودن، با HEAD روی `https://everyayah.com/data/<پوشه>/001001.mp3` سنجیده شد: Husary_Muallim_128kbps، Minshawy_Teacher_128kbps، Alafasy_128kbps، Abdul_Basit_Murattal_192kbps هر چهار ۲۰۰.
- [CHANGE] `src/lib/reciters.js`: ۴ قاریِ تازه (قاریانِ قبلی دست‌نخورده). `src/lib/storage.js`: `hifzRepeat`=۱، `playbackRate`=۱. `src/App.jsx`: پخشِ ممتد هر آیه را `hifzRepeat` بار می‌خواند (`continuousRepeatRef`)؛ `playbackRate` روی هر Audio؛ دو انتخابگر در تنظیمات؛ راهنمای «تاخیر پیشروی با صدا» (پیش‌فرض ۱۰، محدودهٔ ۱۰–۵۰۰۰).
- [DECISION] پیش‌فرضِ تأخیرِ صدا عوض نشد (۱۰ همان رفتارِ فعلی است؛ تغییرش رفتارِ همهٔ کاربران را عوض می‌کرد)؛ فقط راهنما و placeholder. انجام‌نشده و باز: تکرارِ بازهٔ آیه‌ها (۲) و «مکث برای تکرارِ من» (۳) — نیازمندِ طراحیِ رابط.
- [VERIFY] vitest، build (ship.sh).
> **امضا:** `ناظرِ خودکار (Claude Code routine)` · 2026-11-08 · HEAD probe + vitest + build

## 2026-11-09 — اتصالِ دائمیِ درایو کار نکرد: Google «invalid_client» (رازِ Render با کلاینت نمی‌خواند)
- [OWNER] هماهنگ‌کننده ۰۲:۳۵ دبی: مالک ~۰۱:۳۰ متغیرها را گذاشت و «اتصال» زد (۰۱:۳۳ «✓ همگام»)، ولی ۰۲:۳۳ پس از تازه‌سازی «⚠ درایو وصل نیست»؛ health = configured:true؛ در شبکه فقط `GET /api/drive/status` دیده شد. ۱) ذخیرهٔ grant را بسنج؛ ۲) علت و اصلاح، «اتصال» حتماً code flow؛ ۳) آیا مالک باید دوباره بزند.
- [FINDING] لاگِ Render ِ بات (بی‌توکن): `21:17:01` و `21:17:18` UTC ⇒ `[drive-offline] code exchange failed 401 invalid_client`؛ هیچ خطِ `connected`. لاگِ درخواست‌ها: همان دو `POST /api/drive/connect` ⇒ ۴۰۰؛ در هر بارگذاری (۲۲:۰۷، ۲۲:۳۲، ۲۲:۳۳) `POST /api/drive/token` ⇒ **۴۰۴** («هنوز دائمی وصل نشده»). یعنی مسیرِ کد و تمدیدِ خودکار هر دو کار می‌کنند؛ **grant هرگز ذخیره نشد** چون گوگل جفتِ client id/secret را رد کرد (رازی که در Render گذاشته شد مالِ این کلاینت نیست — رازِ کلاینتِ دیگر، خودِ Client ID، یا رازِ منقضی/حذف‌شده). «✓ همگام» ِ ۰۱:۳۳ از مسیرِ قدیمیِ یک‌ساعته آمد.
- [CHANGE] سرور: `invalid_client`/`unauthorized_client` ⇒ ۵۰۳ با پیامِ «تنظیمِ سرور نادرست است: GOOGLE_OAUTH_CLIENT_SECRET …» (نه «دوباره بزنید»). `GET /api/drive/health` حالا `client_ok` هم دارد: یک کدِ عمداً نامعتبر به گوگل می‌فرستد — جفتِ درست ⇒ `invalid_grant` ⇒ `true`، رازِ غلط ⇒ `invalid_client` ⇒ `false`؛ فقط بولی، کش ۱۰ دقیقه، بی‌دادهٔ کاربر.
- [CHANGE] کلاینت: وقتی سرور پیکربندی شده، «اتصال» **هرگز** به مسیرِ قدیمیِ یک‌ساعته نمی‌رود؛ اگر پاسخِ status هنوز نیامده یا اسکریپتِ گوگل هنوز بار نشده، آماده می‌کند و می‌گوید «چند لحظهٔ دیگر دوباره بزنید». مسیرِ قدیمی فقط وقتی سرور پاسخ نداد یا پیکربندی نشده (هیچ قابلیتی حذف نشد).
- [VERIFY] سرور ۵۸ تست (تازه ۲: ۵۰۳ برای رازِ غلط، `client_ok` false/true/کش، رازی در پاسخ نیست)؛ vitest ۳۹۵؛ build.
- [VERIFY] production پس از 1443f2c: `GET /api/drive/health` ⇒ `{"configured":true,"client_ok":false}` — گوگل جفتِ کنونی را رد می‌کند؛ تأییدِ مستقیمِ علت.
- [OWNER] **مالک باید رازِ درست را دوباره بگذارد و یک بار دیگر «اتصال» بزند** (هیچ grant ای ذخیره نشده).
> **امضا:** `Claude Code (coordinator task)` · 2026-11-09 · Render logs + node --test + vitest + build

## 2026-11-09 — اتصالِ دائمیِ درایو در production سنجیده شد: grant ذخیره و تمدیدِ بی‌پنجره انجام شد
- [OWNER] هماهنگ‌کننده ۰۷:۰۵ دبی: مالک رازِ تازه را در Render گذاشت (در GCP رازِ قدیمی fbZF فعال ماند، Nkh- حذف و رازِ تازه ساخته شد) و یک بار «اتصال» زد. ۱) ذخیرهٔ grant از لاگ (بی‌توکن)؛ ۲) پس از یک ساعت تمدیدِ بی‌پنجره؛ ۳) اگر ورودِ Firebase شکسته، گزارش. به guard دست نزن.
- [VERIFY] `GET /api/drive/health` ⇒ `{"configured":true,"client_ok":true}`. لاگِ بات: `02:57:58 UTC [drive-offline] connected <uid>` ⇒ grant ذخیره شد.
- [VERIFY] تمدید: توکنِ اول تا ~۰۳:۵۸ معتبر بود؛ در بارگذاریِ بعدیِ صفحه `04:21:31 OPTIONS /api/drive/token 204`، `04:21:33 POST /api/drive/token 200` و `[drive-offline] refreshed <uid>` — توکنِ تازه از refresh token ِ سرور، بی‌پنجره. هیچ خطِ `refresh failed`/`invalid_grant`/`invalid_client`/`disconnected` از ۰۲:۵۸ تا ۰۴:۲۱.
- [FINDING] ورودِ Firebase: Firebase برای ارائه‌دهندهٔ Google رازِ کلاینت را جدا در Console (Authentication › Sign-in method › Google › Web SDK configuration) نگه می‌دارد. اگر آن‌جا Nkh- (حذف‌شده) بود، **ورودِ تازه** با گوگل شکست می‌خورد؛ نشست‌های موجود (securetoken) و اتصالِ درایو (سرورِ خودمان) اثر نمی‌گیرند. بی‌ورودِ واقعی و بی‌خواندنِ service account قابلِ سنجش نیست؛ به مالک: آن راز را با یک رازِ فعال تطبیق دهد یا یک ورودِ آزمایشی در پنجرهٔ خصوصی بزند.
- [DECISION] تغییرِ کد نیست؛ guard و تنظیماتِ OAuth دست نخورد.
> **امضا:** `Claude Code (coordinator task)` · 2026-11-09 · Render logs + health

## 2026-11-09 — روتینِ فوری خودش را متوقف کرد (رمز از Render)؛ برگهٔ ۲۶: آزمونِ تایپی و رسم‌الخطِ عثمانی
- [OWNER] هماهنگ‌کننده ۰۸:۲۳ دبی: ۱) تمدیدِ بی‌پنجره را از لاگ تأیید کن؛ ۲) روتینِ فوری از ۰۷:۲۴ برگهٔ ۲۴ را برداشت و به ۲۴/۲۵/۲۶ جواب نداد — علت و اصلاح؛ ۳) برگهٔ ۲۶: «مالك يوم الدين» با ك/ي ِ عربی در آزمونِ تایپی غلط گرفته می‌شود. به guard دست نزن.
- [VERIFY] ۱) لاگِ Render: `04:21:33 UTC POST /api/drive/token 200` و `[drive-offline] refreshed` — بی‌پنجره؛ هیچ خطای تمدید.
- [FINDING] ۲) رونوشتِ اجرای ۰۳:۲۳ UTC (`cse_01Tyw1jUttM25ZETUo16ku4N`): `SUPERVISOR_PASSWORD`/`QS_SUPERVISOR_PASSWORD` در محیطِ روتین نیست؛ `client.py` بی‌صدا رمز را از env-vars ِ Render خواند (`source: render`)؛ پرامپتِ روتین این را منع می‌کند؛ اجرا پس از `urgent` (برداشتنِ ۲۴) تخلف را دید، کارش را دور ریخت و تمام کرد. همان الگو در RUNLOG پیش‌تر هم ثبت شده بود. روتین «SUCCEEDED» است ولی کاری نکرده.
- [CHANGE] `scripts/supervisor/client.py`: رمز از `SUPERVISOR_PASSWORD` (نامی که پرامپت‌ها می‌برند) یا `QS_SUPERVISOR_PASSWORD`؛ خواندنِ رمز از Render فقط با `QS_PASSWORD_FROM_RENDER=1`؛ بی‌آن خطای روشن («بگذار در محیطِ روتین») و کدِ ۳ — پرامپت برای همین حالت دستور دارد («یک جمله بگو و تمام»). آدرسِ سرور (غیرِسرّی) همچنان از Render. تست: `tests/test_supervisor_client_password.py`.
- [OWNER] برای جواب‌گرفتنِ برگه‌ها مالک باید `SUPERVISOR_PASSWORD` را در محیطِ روتینِ «صفِ فوریِ نظارت — قرآن» بگذارد (claude.ai › Routines › Edit › Environment). این سشن هم رمز ندارد ⇒ برگه‌های ۲۴/۲۵/۲۶ از این‌جا ANSWERED نشدند.
- [FINDING] ۳) `normAR` از قبل ك→ک، ي/ى→ی، ة→ه، أإآٱ→ا، اعراب و تطویل را یکسان می‌کرد؛ علتِ واقعی رسم‌الخط است: «مَٰلِكِ» الفِ کوچک (U+0670) دارد که حذف می‌شد ⇒ «ملک» ≠ «مالک»؛ ستونِ بی‌اعرابِ ساخته از متنِ عثمانی هم «ملك» است. و در صفحهٔ حفظ «غلط» با طولِ خام ثبت می‌شد: «مال» برای «ملك» پیش از تایپِ «ك» غلط می‌شد.
- [CHANGE] `src/lib/arabic.js`: `eq` کلمه‌به‌کلمه با `eqWord` (برابر با normAR؛ یا الفِ کوچکِ هدف = «ا»؛ یا الفِ اضافهٔ غیرِآغازینِ کاربر) — یک‌طرفه: الفی که هدف دارد و کاربر نزده همچنان غلط («قل» برای «قال»). نویسه‌های نامرئیِ بیشتر (200B–200F، 2066–2069، FEFF) و نشانه‌های قرآنیِ 0610–061A و 08D3–08FF. `typedReachedTarget` جای مقایسهٔ طولِ خام در صفحهٔ حفظ (`App.jsx`). همهٔ مسیرها (تمرین، آزمون، حفظ، راهنما) همان `eq` را دارند.
- [DECISION] تحملِ الفِ اضافه یک‌طرفه است؛ ردشده: حذفِ همهٔ الف‌ها از دو طرف (غلط‌های واقعی مثل «قل»/«قال» را درست می‌گرفت) و نگاشتِ ثابتِ U+0670→ا (تایپِ «هذا»/«الرحمن» را غلط می‌کرد).
- [VERIFY] vitest ۴۰۲ (تازه: `src/test/arabicUthmani.test.js`)، pytest، build (ship.sh).
> **امضا:** `Claude Code (coordinator task)` · 2026-11-09 · Render logs + routine transcript + vitest + pytest + build

## 2026-11-09 — برگهٔ ۲۶ (بازتست ناموفق): آزمونِ تایپیِ «از اشتباهات» جای‌خالیِ تمرین را دنبال می‌کرد
- [OWNER] هماهنگ‌کننده ۰۸:۵۵ دبی: روی production (bundle `index-URhPhJdy.js`)، آزمون › تایپی › شروع آزمون (از اشتباهات)، «الفاتحة — آیه ٤»، «مالك يوم الدين» ⇒ باز «✗ غلط بود — درست: مالک · یوم · الدین». ۱) bundle همان کامیت؟ ۲) همین مسیر را با همین ورودی end-to-end بسنج؛ ۳) پاسخِ آزمایشیِ غلط در آمارِ مالک — اگر شد برچسب بزن، حذف نکن.
- [VERIFY] ۱) `deploys.py`: سایت live روی 6dc0484؛ `index-URhPhJdy.js` همان بیلد است (کدِ U+0670 ِ اصلاحِ قبلی در آن هست).
- [CORRECTION] اصلاحِ قبلی (مقایسهٔ عثمانی) لازم بود ولی علتِ این گزارش نبود. نشانه: جداکنندهٔ « · » در «درست:» فقط وقتی ساخته می‌شود که نما «کل آیه» **نیست**. علت: `startExamFromMistakes` کارتِ کل‌آیه می‌سازد (همهٔ کلمه‌ها جای‌خالی، جلسه `cloze:'all'`) ولی نما از تنظیمِ تمرینِ «الگوی جای‌خالی» (`clozePattern`، ذخیره در مرورگر) پیروی می‌کرد؛ با «خالی: …» هر کلمه یک کادر داشت و آیهٔ کاملِ تایپ‌شده در کادرِ اول با «مالک» تنها سنجیده می‌شد. فرضیهٔ «نرمال‌سازی یک‌طرفه» رد شد: هر دو طرف از `eq` می‌گذرند.
- [CHANGE] `src/App.jsx`: کارتِ آزمونِ تایپیِ از اشتباهات `wholeAyah: true`؛ `cardCloze = card.wholeAyah ? 'all' : clozePattern` در همهٔ مسیرهای نما/ثبت/بازخورد/راهنما/«خودکار پر کن». تنظیمِ تمرینِ کاربر دست نخورد.
- [VERIFY] ۲) `src/test/mistakeExamTyping.e2e.test.jsx`: خودِ App با دیتاستِ آیهٔ ۱:۴ و یک اشتباهِ ثبت‌شده، تب «آزمون» › «شروع آزمون» › تایپِ «مالك يوم الدين» › «ثبت پاسخ»؛ ۹ ترکیب (جای‌خالیِ random/first/all × ستونِ بی‌اعرابِ «مالک یوم الدین»/«ملك يوم الدين»/«مالك يوم الدين») ⇒ پنلِ غلط نمی‌آید؛ «مالك يوم القيامة» ⇒ غلط با «درست: مالک یوم الدین». بدونِ اصلاحِ App.jsx همین تست برای random/first **قرمز** شد (بازتولیدِ باگ). vitest کامل، pytest، build (ship.sh).
- [FINDING] ۳) پاسخِ آزمایشی در دادهٔ خودِ مالک است (مرورگر/درایوِ او)؛ برنامه برچسبِ پاسخ ندارد و قاعدهٔ ۶ تغییرِ دادهٔ موجود را منع می‌کند ⇒ برچسب از این‌جا زده نشد و چیزی حذف نشد. اثرش: یک «غلط» برای ۱:۴ در «اشتباهات» و آمار.
> **امضا:** `Claude Code (coordinator task)` · 2026-11-09 · deploys.py + App-level test + vitest + pytest + build

## 2026-11-09 — برگهٔ ۲۴: «عملکرد کلی» ناتمام‌ها را جدا می‌شمارد، پیامِ کمی‌دادهٔ روند، جملهٔ «امروز»
- [OWNER] برگهٔ ۲۴ (فوری): ۱) «٨ آزمون» در گزارش ≠ «٥ (+٣ ناتمام)» در تب آزمون؛ ۲) «روند دقت» بی‌خط؛ ۳) جملهٔ «امروز چه کنم».
- [CHANGE] `src/lib/stats.js`: `computeOverallStats` آزمونِ checkpointدار را در `examsPartial` می‌شمارد، `exams` فقط تمام‌شده‌ها (همان قاعدهٔ تب آزمون). `src/App.jsx` (`OverallReport`): «۵ آزمون + ۳ ناتمام»؛ زیرنویسِ «دقت کلی» می‌گوید آزمون‌های ناتمام هم شمرده می‌شوند (دقتِ کلی عمداً همهٔ پاسخ‌های ثبت‌شده است)؛ روند فقط با ≥۲ روزِ دارای داده رسم می‌شود وگرنه پیامِ «حداقل ۲ روز فعالیت لازم است (تاکنون N روز)»؛ جملهٔ «💡 امروز: <سوره> آیهٔ N (k اشتباه) — ۵ دقیقه مرور» از `weakSpots` (سنگین‌ترین نقطهٔ ضعف).
- [DECISION] دقتِ کلی ناتمام‌ها را شامل می‌ماند (حذفشان پاسخ‌های واقعی را پنهان می‌کرد)؛ فقط شمارش جدا شد. ردشده: استثناکردنِ ناتمام‌ها از دقت.
- [VERIFY] تست در `src/test/stats.test.js`؛ vitest/build با ship.sh.
> **امضا:** `ناظرِ خودکار (Claude Code routine)` · 2026-11-09 · vitest + build

## 2026-11-09 — برگهٔ ۲۵: «تکرارِ هر آیه» و «سرعت پخش» به تنظیمات › صوت منتقل شد
- [OWNER] برگهٔ ۲۵ (بازتست ۲۰/۲۱): ۲۰ تأیید؛ ۲۱ بند ۱ تأیید؛ ۲۱ بند ۲: گزینهٔ «تکرارِ هر آیه در پخش ممتد» در «🎙️ صوت و تشخیص صدا» پیدا نشد.
- [FINDING] گزینه دیپلو شده بود (728f334) ولی در «⚙️ تنظیمات عمومی» بود، نه «صوت».
- [CHANGE] `src/App.jsx`: «تکرارِ هر آیه در پخش ممتد» و «سرعت پخش» به زیرِ «قاری پیش‌فرض» در «صوت و تشخیص صدا» رفتند (data-testid ثابت). قابلیتی حذف نشد.
- [OWNER] «تکرار بازه» و بند ۳ برگهٔ ۲۱ به‌صراحت باز ماندند؛ در این برگه جزئیاتش نیست ⇒ مالک بند را بنویسد.
> **امضا:** `ناظرِ خودکار (Claude Code routine)` · 2026-11-09 · vitest + build

## 2026-11-12 — دورِ کامل: پخشِ بازه‌ای/تکرار/«مکث برای تکرارِ من» (برگه‌های ۱۹، ۲۱، ۶-هـ) و بازخوردِ جای‌خالی + نوارِ تمرین + بیدارسازیِ سرورِ نظارت (برگهٔ ۲)
- [OWNER] برگهٔ ۱۹-۳ و ۲۱-۲/۳: «تکرار بازه (مثلاً آیه ۱۳۸–۱۴۲ ۳ بار)» و «مکث برای تکرار من = مکث به اندازهٔ طول آیه». برگهٔ ۲: ۲) «بعد از Tab/Enter سبز/قرمز شود، و دکمهٔ راهنمای حرف اول»؛ ۳) نوارِ شناور روی شمارهٔ صفحه و دکمه‌های صفحه قبلی/بعدی می‌افتد؛ ۴) «Failed to fetch» ِ ابزارِ نظارت «باید خودکار retry/بیدارسازی شود».
- [FINDING] (مرورگرِ واقعی، نسخهٔ محلی، صوتِ شبیه‌سازی‌شده) دو خرابیِ قدیمیِ پخشِ ممتد: (۱) `useEffect([isContinuousPlaying])` شاخص را صفر می‌کرد ⇒ زدن روی آیهٔ میانی همیشه از اولِ صفحه شروع می‌کرد؛ (۲) `playNextInQueue` از closure ِ کهنه `isContinuousPlaying` را می‌خواند ⇒ «توقف» در فاصلهٔ بینِ دو آیه، پخش را بعد از تأخیر دوباره راه می‌انداخت (با مکثِ چندثانیه‌ای جدی می‌شد)؛ و زدن روی آیهٔ دیگر حینِ پخش، پخش را بی‌صدا قطع می‌کرد.
- [FINDING] تصحیحِ زندهٔ حرف‌به‌حرف در جای‌خالیِ حفظ **وجود داشت** (هاله‌ی قرمز/سبزِ هر حرف) ولی حکمِ کلِ کلمه نداشت؛ نوارِ «پایان و ذخیره» `position: sticky; bottom` بود و روی متنِ آیه/ناوبریِ صفحه می‌نشست.
- [CHANGE] `src/lib/continuousPlay.js` (تازه، خالص): `clampRange`، `advanceQueue` (تکرارِ هر آیه × حلقهٔ بازه)، `echoPauseMs`، `rangeOptionLabel`. `src/App.jsx` (`PracticePageTab`): زیرِ سربرگِ صفحه ردیفِ «از آیهٔ … تا آیهٔ … · تکرارِ بازه/صفحه · هر آیه · ☐ مکث برای تکرارِ من» + نشانگرِ «🎤 نوبتِ شما»؛ صف با ref و یک تایمرِ قابلِ‌لغو؛ `playAyah` طولِ صوت را به callback می‌دهد. بازهٔ انتخابی پس از N بار می‌ایستد؛ کلِ صفحه مثلِ قبل به صفحهٔ بعد می‌رود. `src/lib/storage.js`: `hifzRangeRepeat`، `hifzEchoPause`. تنظیمات › صوت: همان دو گزینه + راهنمای جای بازه.
- [CHANGE] برگهٔ ۲: جای‌خالی با Enter (و رفتن به بعدی) یا Tab/ترکِ خانه کلاً سبز/قرمز می‌شود (`verdict`؛ غلطِ کوتاه‌تر از هدف هم یک بار ثبت می‌شود)؛ راهنما حرف‌به‌حرف از پیشوندِ درست ادامه می‌دهد؛ نوارِ تمرین (`hifz-practice-bar`: پایان و ذخیره، «💡 حرفِ اول»، «👁 دیدنِ متن»، ضبط با صدا) بالای صفحه و زیرِ تب‌ها می‌چسبد — دیگر روی متن/ناوبری نیست. هیچ دکمه‌ای حذف نشد (همه منتقل شدند). `src/lib/inspectionApi.js`: GET ِ ناموفق در سطحِ شبکه ۳ بار (۱٫۵/۴/۸ ثانیه) بی‌صدا تکرار می‌شود؛ POST/DELETE هرگز.
- [DECISION] بازه فقط داخلِ همان صفحه (نمونهٔ مالک ۱۳۸–۱۴۲ در یک صفحه است)؛ ردشده: بازهٔ چندصفحه‌ای (حالتِ صف و ناوبری را هم‌زمان عوض می‌کرد؛ برشِ بعدی). تکرارِ خودکارِ نوشتن‌ها رد شد: برگهٔ تکراری می‌ساخت. نوارِ تمرین بالا، نه پایین: پایین همیشه روی چیزی می‌افتد (همان ایرادِ برگهٔ ۱۹-۲).
- [VERIFY] `src/test/continuousPlay.test.js` (۱۱)، `src/test/inspectionApiRetry.test.js` (۶)؛ vitest ۴۳۰ سبز، build سبز. Playwright روی `vite preview` با ۷ آیهٔ فاتحه: کلِ صفحه ۱…۷ → صفحهٔ ۲؛ بازهٔ ۳–۵ دو بار = ۳،۴،۵،۳،۴،۵ و توقف؛ مکث = طولِ آیه (فاصلهٔ ۲۳۰۲ms برای صوتِ ۲ثانیه‌ای)؛ توقف وسطِ مکث دیگر ادامه نمی‌دهد؛ غلط+Enter ⇒ قرمز و فوکوس به بعدی، کلمهٔ درست ⇒ سبز، ویرایش ⇒ پاک؛ نوار [۷۶–۱۳۰px] با ناوبریِ صفحه تداخل ندارد. صوتِ واقعی شنیده نشد.
- [REVERT] `git revert` همین کامیت؛ دادهٔ ذخیره‌شده‌ای عوض نشده (دو کلیدِ تازه در settings پیش‌فرض دارند).
- [TODO] بازهٔ چندصفحه‌ای؛ هایلایتِ کلمه‌به‌کلمه همگام با صوت (۶-هـ)؛ تأییدِ مالک روی production.
> **امضا:** `ناظرِ خودکار (Claude Code routine)` · 2026-11-12 · vitest ۴۳۰ + build + Playwright روی نسخهٔ محلی (صوتِ شبیه‌سازی‌شده)

## 2026-11-12 — دورِ کامل (۲): چهار نوعِ سؤالِ تستیِ حافظ (برگهٔ ۵-۴) و حفظِ بی‌تایپ «بزن تا نشان بده / حرفِ اولِ هر کلمه» (برگهٔ ۶-د)
- [OWNER] برگهٔ ۵-۴: «گزینه‌های مهم‌تر اضافه شود: آیهٔ بعدی کدام است؟، آیهٔ قبلی؟، این آیه در کدام صفحه/جزء؟، متشابهات». برگهٔ ۶-د: «حرف اول هر کلمه»، «محوشدن تدریجی»، «بزن تا نشان بده به جای تایپ (کاربر تنبل تایپ عربی نمی‌کند) با دکمه‌های بلد بودم/نبودم».
- [CHANGE] `src/lib/mcqHafiz.js` (تازه، خالص): `buildHafizQuestion` برای `next_ayah`/`prev_ayah` (انحرافی‌ها اول از آیه‌های نزدیکِ همان سوره؛ آیه‌ای که مثلِ جواب خوانده می‌شود گزینه نمی‌شود؛ آیهٔ اول/آخرِ سوره پرسیده نمی‌شود) و `page`/`juz` (شماره‌های همسایه، داخلِ ۱…۶۰۴ / ۱…۳۰). `src/App.jsx`: چهار گزینه در «نوع سوال تستی»، پیامِ کنارگذاشتنِ آیه‌ها متناسب با نوع.
- [CHANGE] `src/lib/revealMode.js` (تازه): `maskTokens`، `revealEntry`. `src/App.jsx`: دو حالتِ تازه در «حالت تمرینِ» صفحهٔ حفظ — آیه پوشیده است (••• یا حرفِ اولِ هر کلمه با حرکه‌اش)، با یک ضربه دیده می‌شود، «✓ بلد بودم / ✗ بلد نبودم» همان جلسهٔ حفظ را پر می‌کند (`hifz_reveal`، `hifz_reveal_first`؛ «بلد نبودم» = فراموشی ⇒ در نقطه‌های ضعف و مرورِ فاصله‌دار می‌آید). کارتِ نتیجه و «تمرینِ مجددِ اشتباه‌ها» همان قبلی.
- [DECISION] خودارزیابی به‌جای تشخیصِ خودکار: برای حافظ همان چیزی است که خواسته شد و دادهٔ تازه نمی‌خواهد؛ ردشده: «محوشدنِ تدریجی ۲۰٪→۱۰۰٪» در همین برش (حالتِ چندمرحله‌ای جدا می‌خواهد) و «متشابهات» (دادهٔ شباهتِ بینِ سوره‌ها لازم دارد) — هر دو باز می‌مانند.
- [VERIFY] `src/test/mcqHafiz.test.js` (۹)، `src/test/revealMode.test.js` (۴)؛ vitest ۴۴۳، build سبز. Playwright روی `vite preview`: هر چهار نوع کارت ساخت (مثلاً «آیهٔ بعد از این آیه کدام است؟ — مالک یوم الدین» با ۴ گزینهٔ یکتا؛ «صفحهٔ ۱…»)؛ حالتِ بی‌تایپ: ضربه ⇒ متن، بلد بودم/نبودم ⇒ «۱ از ۲ آیه درست (۵۰٪)» و جلسهٔ `hifz_reveal_first` با `1:2` غلط و `1:1` درست در localStorage.
- [REVERT] `git revert` همین کامیت؛ جلسه‌های ثبت‌شده با حالتِ تازه بدونِ برچسب هم خوانده می‌شوند.
- [TODO] متشابهات (۵-۴)، محوشدنِ تدریجی (۶-د)، امتیازِ سخت/خوب/آسان و نقشهٔ ۶۰۴ صفحه (۶-ج)، هوش مصنوعیِ پیش‌فرضِ سمتِ سرور (۵-۷؛ کلید/هزینه با مالک).
> **امضا:** `ناظرِ خودکار (Claude Code routine)` · 2026-11-12 · vitest ۴۴۳ + build + Playwright روی نسخهٔ محلی
