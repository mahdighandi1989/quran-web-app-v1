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
