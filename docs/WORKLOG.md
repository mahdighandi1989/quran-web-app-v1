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
- [REVERT] revert ِ همین کامیت؛ پیش‌فرض همان firebaseapp.com است، پس رفتارِ کاربرانی که به firebaseapp.com دسترسی دارند عوض نشده.
> **امضا:** `Claude Code (coordinator task)` · 2026-11-08 · vitest + build + Playwright
