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
