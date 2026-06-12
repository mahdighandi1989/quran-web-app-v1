---
task_id: b207f374-a150-4ab4-ba49-edbee20b9d9a
title: '[منطق] Irrelevant Inputs in `TelegramSettings.jsx`'
type: logic_audit
priority: low
execution_priority: 4000
status: suggested
external_status: pending
verification_status: pending
watched_id: c9e90b2b-4141-4012-b343-5a5f60b0268a
project: mahdighandi1989/quran-web-app-v1
created_at: '2026-06-12T19:24:05.473780+00:00'
updated_at: '2026-06-12T19:24:05.473784+00:00'
---

# [منطق] Irrelevant Inputs in `TelegramSettings.jsx`

## Raw Idea

## 📋 شرح ناسازگاری
در pipeline `notification` یک ناسازگاری منطقی پیدا شد:

The `TelegramSettings.jsx` component, whose primary purpose is to provide a UI for *configuring* Telegram integration, lists `sessions: Array` and `dataset: Array` as expected inputs. These inputs seem more relevant to the *content* or *context* of notifications rather than the *configuration* of the integration itself. While it might initiate actions, passing full `sessions` and `dataset` arrays directly to a settings component seems excessive and potentially indicative of a blurred responsibil

## 💥 پیامد (impact)
Passing large, potentially irrelevant data structures to a UI component can increase its complexity, reduce performance, and violate the principle of separation of concerns. It might also hint at the component doing more than just configuration, leading to a less maintainable and harder-to-test code

## 🛠 پیشنهاد رفع اولیه
Re-evaluate why `sessions` and `dataset` are inputs to `TelegramSettings.jsx`. If they are needed for *triggering specific test notifications* based on real data, consider passing only relevant IDs or summarized information, or delegate the actual data fetching/processing to a service layer that the component interacts with. If they are truly irrelevant to *settings*, remove them.

## 🤔 چرا مهم است
coherence issue یعنی دو بخش کد فرض‌های ناسازگار دارند — معمولاً نشانه‌ی refactor ناتمام یا feature flag rot است. این کلاس bug ها در test معمولی پیدا نمی‌شوند چون unit test ها در silo اجرا می‌شوند.

## Prompt

## ⚠️ یادداشت مهم برای مدل اجراکننده — قبل از شروع بخوان

این پرامپت بر اساس یک **بررسی اولیهٔ خودکار** از repo ساخته شده — ممکن است
حاوی اشتباه، تشخیص نادرست، یا حذف موارد مهم باشد. به‌عنوان منبع نهایی به
آن استناد نکن.

📖 **خواندن کامل + اجرای مو-به-مو (بسیار مهم):**

این پرامپت — از این یادداشت تا انتها — یک سند واحد است که هر بخشش
حاوی الزام یا context منحصربه‌فرد است. خواندن سطحی یا skim کردن **ممنوع**
است.

- پرامپت را **سطر به سطر** بخوان، نه head/tail/فقط-بخش-اصلی.
- اگر بخشی به‌نظر طولانی یا تکراری آمد، **حتماً** بخوان — تفاوت‌های
  ریز ممکن است در آن جا اساسی باشند.
- هر جمله، URL، نام فایل، نام تابع، یا مقدار عددی که در پرامپت آمده،
  دقیقاً همان است که کاربر می‌خواهد — تغییرش نده، رندش نکن، خلاصه‌اش
  نکن.
- اگر پرامپت چندین درخواست/مرحله/زیرتسک دارد، **همه** را پیاده کن. حتی
  یکی را نه به‌عنوان "خارج از scope" حذف کن.

❌ ممنوعات صریح:
- خلاصه‌سازی متن کاربر در commit message یا response
- "این بخش اصلی نیست، رد می‌کنم"
- "کاربر احتمالاً منظورش این بود..." — منظورش همان است که نوشته
- "این URL/نام به نظر قدیمی است، آپدیتش کردم" — تغییر بدون درخواست ممنوع
- پیاده‌سازی فقط بخشی از پرامپت و تظاهر به کامل بودن
- "همه آیتم‌های لیست A را بررسی کردم، B و C مشابه بودند" — نه؛
  هرکدام را جداگانه

♻️ **احتمال پیاده‌سازی قبلی (مهم):**
- ممکن است **بخشی یا تمامِ** این درخواست قبلاً (به صورت کامل یا ناقص) در
  repo پیاده‌سازی شده باشد. پیش از شروع، با grep/search و خواندن فایل‌های
  مرتبط بررسی کن که چه چیزی **از قبل وجود دارد**.
- اگر یک قابلیت/فایل/تابع از قبل موجود است: آن را **دوباره نساز**؛ فقط
  موارد ناقص یا اشتباه را اصلاح/تکمیل کن.
- اگر همه چیز از قبل به‌درستی انجام شده: یک کامیت توضیحی (no-op) ثبت کن که
  چرا تغییری لازم نبود و دقیقاً کدام فایل‌ها این درخواست را پوشش می‌دهند.

🔍 **مسئولیت تو (مدل اجراکننده):**
- پیش از هر تغییر، خودت ساختار repo، فایل‌های ذکرشده، و وابستگی‌های آن‌ها را
  مستقل بررسی کن.
- اگر تشخیص دادی موقعیت ذکرشده در پرامپت اشتباه است یا فایل دیگری مناسب‌تر
  است، بر اساس قضاوت خودت عمل کن — این پرامپت نمی‌تواند بهانهٔ کار اشتباه
  باشد ("خودت گفتی" قابل قبول نیست).
- اگر معیارهای پذیرش (AC) مبهم/ناقص بودند، بهترین تفسیر را انتخاب کن و در
  commit message توضیح بده.

🔗 **وابستگی‌ها و همگام‌سازی (بسیار حیاتی — هرگز skip نکن):**

این بخش از همهٔ بخش‌های دیگرِ این یادداشت **مهم‌تر** است. اگر نقض شود،
نتیجهٔ کار ممکن است مشروع به‌نظر برسد ولی در عمل بخش‌های دیگر سیستم را عقب
بیندازد، broken reference تولید کند، یا منجر به data corruption شود.

پیش از و حین تغییر، تمام وابستگی‌ها را در **چهار جهت** به‌طور **کامل و
بدون هیچ خلاصه‌سازی** شناسایی و همگام کن:

**۱. وابستگی‌های upstream (این تسک به چه چیزهایی متکی است):**
- چه فایل‌ها، توابع، کلاس‌ها، API endpoint ها، schema های دیتابیس،
  env vars، یا config هایی که این تسک نیاز دارد؟
- آیا قرار است چیزی را ویرایش/حذف کنی که جای دیگر (signature، رفتار،
  return type، side effect) از آن انتظار خاصی می‌رود؟
- اگر dependency جدیدی اضافه می‌کنی، آیا با dependencyهای موجود تداخل
  دارد (نسخه، compat، lock file)؟

**۲. وابستگی‌های downstream (چه چیزهایی به این تسک متکی‌اند):**
- چه فایل‌ها، توابع، تست‌ها، migrations، docs، یا UI component هایی از
  کدی که داری ویرایش/اضافه/حذف می‌کنی **استفاده می‌کنند**؟
- با grep و reference search **همه‌ی** call sites، importها، subclassها،
  reference های مستقیم و غیرمستقیم را پیدا کن — نه فقط چند مورد اصلی.
- خصوصاً برای حذف یا rename: هیچ broken reference نباید باقی بماند.

**۳. وابستگی‌های cross-tier (بسیار مهم — هرگز فقط یک لایه را نبین):**

تسک شما ممکن است از backend، frontend، database، worker، یا هر tier
دیگری شروع شده باشد. ولی تغییرات تقریباً همیشه روی tier های دیگر هم
اثر می‌گذارند. **مستقل از اینکه تسک از کدام tier است**، این چک‌های دو
طرفه را همیشه انجام بده:

🔁 **اگر backend را تغییر دادی** (API، service، model، route):
  → frontend: کدام component/page/hook این endpoint یا data shape را
    مصرف می‌کند؟ type definition، state shape، error handling، loading
    state، form validation، URL routing همگی باید همگام شوند.
  → mobile/SDK/client library (اگر پروژه دارد): همان داستان frontend.
  → database: آیا migration لازم است؟ آیا rollback امن است؟
  → background workers: آیا event producer/consumer ها تحت تأثیرند؟
  → rate limit، auth، CORS، CSP: آیا رفتار جدید پشتیبانی می‌شود؟

🔁 **اگر frontend را تغییر دادی** (component، form، state، route):
  → backend: آیا endpoint جدید/تغییریافته لازم است؟ آیا data shape ای
    که ارسال می‌شود با schema سرور سازگار است؟
  → backend validation: آیا برای ورودی‌های جدید UI کافی است؟
  → permissions/RBAC: آیا feature جدید نیاز به role check جدید دارد؟
  → analytics/tracking: آیا event های جدید باید در backend log شوند؟
  → SEO/SSR: آیا تغییر route نیاز به sitemap/meta tags جدید دارد؟

🔁 **اگر database/migration را تغییر دادی**:
  → backend models (ORM، Pydantic، dataclasses) همگی به‌روزند؟
  → query های raw SQL یا ORM queries با schema جدید سازگارند؟
  → seed data، fixtures، factory functions تست‌ها به‌روزند؟
  → frontend: آیا data shape جدید در UI به‌درستی render می‌شود؟
  → rollback migration نوشته شده و امن است؟

🔁 **اگر API contract یا event schema را تغییر دادی** (REST، GraphQL،
   WebSocket، gRPC، Kafka، …):
  → OpenAPI/GraphQL schema/proto file آپدیت شد؟
  → همه‌ی consumer ها (client، subscriber، webhook، external API
    user) با version جدید سازگارند؟
  → backward compatibility حفظ شده یا migration path روشن است؟
  → versioning header/path اگر breaking change است؟

🔁 **اگر infrastructure یا config را تغییر دادی** (Dockerfile، CI، Render
   config، env، secrets):
  → README setup/installation section به‌روزه؟
  → `.env.example` با env vars جدید آپدیت شد؟
  → deploy script یا CI workflow هم تغییر کرد؟
  → docs/architecture یا diagram های infrastructure به‌روزند؟

⚠️ **هرگز فقط یک tier را تغییر نده و فرض کنی بقیه خودکار همگام می‌شوند.**
   حتی برای تغییرات به‌ظاهر «کوچک»، چک کن.

**۴. وابستگی‌های جانبی (artifacts که همیشه چک شوند):**

تغییرات کد همیشه روی این artifact ها اثر دارند. **همه را** بررسی و
به‌روز کن — مستندات اولویت **بالا** دارد چون فراموش‌شدنی‌ترین است.

  📝 **مستندات** (همیشه چک کن — حتی برای تغییر کوچک کد):
    - README.md (شرح، setup، نمونه‌های استفاده، badge ها)
    - CHANGELOG.md / RELEASE_NOTES.md
    - docs/ folder (architecture، API reference، user guides، runbooks)
    - inline docstrings/کامنت‌های توابع و کلاس‌های تغییریافته
    - OpenAPI/Swagger annotations، JSDoc/TSDoc
    - architecture diagrams (اگر component اضافه/حذف شد)
    - migration guides (اگر breaking change است)

  🌍 **مستندات کاربر**:
    - i18n files و translation keys
    - UI labels، tooltip ها، help text، error messages
    - in-app onboarding (اگر flow جدید است)

  🧪 **تست‌ها**:
    - unit tests (همه‌ی فایل‌های مرتبط — حتی اگر «بی‌ربط» به‌نظر می‌رسد)
    - integration tests
    - e2e tests (Playwright/Cypress/Selenium)
    - snapshot tests (اگر UI تغییر کرد)
    - contract tests (Pact یا مشابه)
    - performance benchmarks (اگر behavior performance-sensitive تغییر کرد)

  🧬 **type definitions و contracts**:
    - .d.ts files
    - Pydantic models، dataclasses
    - Protobuf/Avro/Thrift schemas
    - GraphQL schema definitions
    - JSON Schemas

  🏗 **infrastructure و config**:
    - Dockerfile، docker-compose.yml
    - Kubernetes manifests
    - Render/Vercel/Netlify config
    - GitHub Actions / GitLab CI workflows
    - environment templates (.env.example، .env.sample)
    - feature flags (LaunchDarkly، GrowthBook، config)

  📊 **monitoring و observability**:
    - logging keys (اگر اضافه/حذف شد، log parser ها هم به‌روز شوند)
    - metric names (Prometheus، Datadog)
    - tracing spans
    - alert rules و dashboards
    - error tracking (Sentry rules، groupings)

  🔐 **security**:
    - auth rules (rate limit، CORS، CSP، HSTS)
    - permissions/RBAC config
    - secrets rotation policies
    - audit log events (اگر action جدید اضافه شد)

  💾 **caches و serialization**:
    - cache keys و TTL (اگر data shape یا lifecycle تغییر کرد)
    - serializer formats (Redis، session storage)
    - browser storage (localStorage، IndexedDB schemas)

**قانون مطلق همگام‌سازی:**
- هر چیزی که در (۱)، (۲)، (۳)، یا (۴) شناسایی شد، در **همان workflow
  این تسک** همگام و به‌روز شود. هرگز برای بعد رها نکن.
- اگر یک فایل/تست/docs نسبت به تغییر شما عقب بماند، در بهترین حالت bug،
  در بدترین حالت مشکل امنیتی یا data corruption تولید می‌کند.
- تغییرات همگام‌سازی می‌توانند در commit جداگانه باشند (در همان task)،
  ولی نباید skip شوند یا به «refactor آینده» سپرده شوند.

**هرگز این جمله‌ها قابل قبول نیست:**
- ❌ «بعداً پیداش می‌کنم»
- ❌ «احتمالاً جای دیگه‌ای استفاده نمی‌شه»
- ❌ «این یه refactor جداگانه‌ست — out of scope»
- ❌ «فقط فایل‌های اصلی رو بررسی کردم»
- ❌ «حدس می‌زنم چیزی بهش وابسته نیست»
- ❌ «دامنه‌ی وابستگی‌ها رو خلاصه کردم» — هرگز خلاصه نکن
- ❌ «این task فقط backend است؛ frontend مشکل خودش» — هرگز
- ❌ «این task فقط frontend است؛ backend از قبل کار می‌کند» — هرگز ثابت نکرده
- ❌ «مستندات بعداً به‌روز می‌شن» — همیشه same-task همگام شوند
- ❌ «testها رو نگاه نکردم چون فقط یه تغییر کوچیک بود»

**در commit message یا PR description**، دامنهٔ وابستگی‌های شناسایی‌شده و
همگام‌شده را به‌طور explicit و **per-tier** بنویس. مثال:
```
Dependencies synced:
- upstream: User model schema, auth middleware
- downstream: 3 API endpoints, 5 frontend components, 12 tests
- cross-tier (backend → frontend): UserProfile.tsx, useUser.ts hook,
  api-types.ts (TS definitions)
- cross-tier (backend → infra): .env.example added NEW_AUTH_SCOPES
- side artifacts: OpenAPI spec, README API section, i18n keys for
  new errors, Sentry alert rule for new error code
```
اگر هیچ وابستگی پیدا نکردی در هر کدام از چهار جهت، صریحاً بنویس:
«بررسی شد — هیچ وابستگی upstream / downstream / cross-tier (backend↔
frontend↔db↔infra) / side شناسایی نشد» تا مشخص باشد بررسی **انجام شده**
نه اینکه فراموش شده.

📋 **مدیریت TO-DO برای اقدامات دستی کاربر (همیشه چک کن):**

⚠️ **هشدار بحرانی — قاعدهٔ ضد-فرار:** TO-DO فقط برای کارهایی است که
**واقعاً غیرممکن** برای agent است (نیاز به انسان مطلق)، نه برای کارهایی
که «بزرگ‌اند»، «وقت می‌برند»، یا «نیازمند fixture/setup» هستند. اگر یک
agent در یک سشن بیش از **۲۰٪ از تسک‌ها** را با TO-DO ببندد، یعنی از کار
فرار می‌کند — این الگو در سشن‌های قبلی **مشاهده** شده و الان ممنوع است.

✅ **فقط برای این موارد TO-DO بساز** (لیست بسته — هرچه خارج این لیست
ممنوع است):

  ۱. **Credential/secret که فقط کاربر دارد**:
     - تنظیم API key واقعی در پنل ادمین خارجی (Render، AWS، Stripe، …)
     - تأیید OAuth client روی console آن سرویس
     - paste کردن webhook secret که فقط بعد از ساخت در dashboard ظاهر می‌شود

  ۲. **Account/billing روی سرویس خارجی که کاربر باید عضو شود**:
     - ساخت account جدید روی Stripe/SendGrid/Twilio/Google Cloud
     - تأیید verification شماره یا ID
     - فعال‌سازی subscription پولی

  ۳. **داده/asset خصوصی که فقط کاربر دارد**:
     - آپلود لوگو/تصویر/فونت برند
     - paste کردن داده‌ای که در محل کار کاربر است
     - import داده‌ای که فقط روی device کاربر است

  ۴. **تصمیم سلیقه‌ای/حقوقی/کسب‌وکار**:
     - انتخاب رنگ‌بندی نهایی یا تم
     - متن دقیق Terms of Service / Privacy Policy
     - تعرفهٔ قیمت‌گذاری
     - نام نهایی برند یا دامنه

⛔ **هرگز TO-DO نکن برای** (لیست سیاه — هر چیزی که در این لیست است
**قابل اجرا** توسط agent است، حتی اگر بزرگ یا چندبخشی باشد):

  ❌ UI component / page / dashboard (هر فریم‌ورک: React, Vue, Angular,
     Svelte، حتی اگر معماری بزرگ دارد) — می‌توانی stub اولیه + state
     management + layout + استایل بسازی
  ❌ "نیازمند Google Drive / Stripe / Twilio API" — می‌توانی **client
     stub** با abstraction layer بسازی که با env var واقعی plug-in شود؛
     کد integration یعنی پیاده‌سازی، نه TO-DO
  ❌ "feature بزرگ، چند روز کار می‌برد" — اندازه دلیل defer نیست؛ کوچک
     شروع کن، iterate کن، در همین سشن کامل کن
  ❌ Celery / background worker / scheduler — یک task ساده + register
     می‌توانی بسازی
  ❌ Migration / model / schema — حتی اگر فیلد جدید نیاز دارد، اضافه کن
  ❌ REST endpoint / GraphQL resolver / WebSocket route — هرگز TO-DO
  ❌ test (unit/integration/e2e) — همیشه قابل نوشتن
  ❌ Documentation / README / API docs — همیشه قابل نوشتن
  ❌ Config file / .env.example / Dockerfile / CI workflow — همیشه قابل
     نوشتن
  ❌ "می‌توانستی .tsx ولی repo .jsx است" — از .jsx استفاده کن، TO-DO نکن
  ❌ "نیازمند فیلد X در مدل دیگر" — اضافه کن فیلد را، TO-DO نکن
  ❌ "تصمیم admin-vs-user-scoped" — پرامپت اولیه scope را معلوم کرده،
     یا با محتاطانه‌ترین تفسیر پیش برو
  ❌ "credential در production هنوز ست نیست" — این TO-DO ساده برای
     تنظیم env var است (مورد ۱ بالا)، نه دلیل برای defer کردن کد
  ❌ "نیازمند verification از کاربر" — اگر اقدام واقعی غیرممکن نیست،
     پیش برو
  ❌ هر چیزی که در یک کامنت `# TODO` معمولی نوشته می‌شد — این فایل
     TO-DO نیست، کامنت inline است

🔬 **قاعدهٔ «حداقل تلاش» قبل از TO-DO**: قبل از TO-DO کردن یک AC، **اثبات
کن** که قابل انجام نیست:

  ۱. آیا می‌توانم یک stub/placeholder بسازم که با env واقعی plug-in شود؟
     → اگر بله، بساز و TO-DO نکن
  ۲. آیا می‌توانم برای این بخش یک test (حتی mock-based) بنویسم؟
     → اگر بله، بنویس و TO-DO نکن
  ۳. آیا می‌توانم abstraction/interface را تعریف کنم، حتی اگر backend
     واقعی نیست؟ → اگر بله، تعریف کن و TO-DO نکن
  ۴. آیا فقط یک حالت سلیقه‌ای/decision کاربر در میان است؟
     → فقط آن یک decision را TO-DO کن، نه کل feature را

اگر یکی از این چهار راه‌حل ممکن بود ولی به TO-DO رفتی، **اعتبار شما از
بین می‌رود**.

📊 **آستانهٔ TO-DO per session**: در یک حلقهٔ اجرای N تسک، اگر بیشتر از
**۲۰٪** تسک‌ها فایل TO-DO ساختی، خودت در گزارش پایانی صریحاً اعلام کن:

  "⚠️ نسبت TO-DO من {K}/{N} = {%} است که از آستانهٔ ۲۰٪ بالاتر است.
   احتمالاً برخی از این TO-DO ها قابل اجرا بودند ولی من فرار کردم.
   لیست TO-DO ها را کاربر باید بازبینی کند که آیا واقعاً Manual-required
   بودند یا agent ضعیف کار کرده."

**یادآوری همیشگی:** اگر در آینده قابلیت‌های شما گسترش پیدا کرد و توانستید
یکی از موارد لیست سفید را خودکار انجام دهید (مثلاً managed credential
injection، یا integration پولی automate شود)، انجام دهید و TO-DO نسازید.
لیست سفید بسته است ولی **بسته از پایین** (می‌تواند کوچک‌تر شود اگر
قابلیت‌ها رشد کنند، ولی هرگز بزرگ‌تر نشود برای فرار).

**اگر هیچ بخش Manual-required نبود (تمام تسک Auto-capable است)**:
  → فایل TO-DO **نساز**. فولدر TO-DO/ باید پاک و معنادار بماند.
  → اگر برای این task از قبل `TO-DO/todo-task-{task_id_first_8}.md` بود
     (یعنی در run قبلی نیاز به دخالت کاربر بود ولی الان نه): فایل قدیمی
     را پاک کن و entry را از `TO-DO/_index.json` حذف کن.

**اگر بخش Manual-required دارد** (همه‌جانبه یا hybrid):
  1. فولدر TO-DO/ را در ریشه ریپو ایجاد کن اگر نیست
  2. فایل `TO-DO/todo-task-{task_id_first_8}.md` بساز با front-matter
     شامل: task_id, task_title, execution_priority, created_at,
     updated_at, status: "pending"
     و در بدنه: «چرا این فایل ساخته شد»، «وضعیت بخش‌های خودکار»
     (commit ها reference)، «کارهایی که باید انجام دهی» با اولویت
     بالا/متوسط/پایین به ترتیب، «وقتی این کارها را تمام کردی»
  3. `TO-DO/_index.json` را با **merge** آپدیت کن (نه overwrite):
     - فایل موجود را بخوان
     - entry های orphan (فایلشان پاک شده) را حذف کن
     - entry این task را اضافه/replace کن
     - بر اساس execution_priority صعودی مرتب کن
     - ساختار: `{"version":1, "generated_at": ISO, "total": N, "items": [...]}`
  4. این تغییرات TO-DO را در **همان commit کد** شامل کن (نه commit جداگانه)

⛔ **ممنوعات مطلق TO-DO**:
  ❌ ساختن TO-DO برای کاری که می‌توانستی خودت انجام دهی (شلوغی فولدر)
  ❌ overwrite کردن `TO-DO/_index.json` بدون merge (data loss)
  ❌ نگه‌داشتن entry هایی که فایل‌شان پاک شده (broken reference)
  ❌ فراموش کردن نوشتن «خروجی مورد انتظار» در هر آیتم TO-DO

این بخش الزامی است. حتی اگر فکر می‌کنی "این تسک کاملاً auto است و نیازی
به TO-DO نیست"، صریحاً در commit message یا report بنویس:
"بررسی شد — این تسک هیچ بخش Manual-required ندارد، TO-DO ساخته نشد."

📦 **اگر کار طولانی است:**
- **خلاصه‌اش نکن.** همه را به‌طور کامل انجام بده.
- اگر یک کامیت گنجایش ندارد، در **چندین کامیت متوالی** انجام بده — ولی
  هیچ بخشی را skip نکن.
- ترتیب کامیت‌ها را منطقی نگه‌دار (foundation → core → integration → tests).
- در آخر یک checklist از همه‌ی کامیت‌ها در PR description بنویس.

🔁 **Commit + Push فوری per-task (بسیار مهم برای جریان کار صحیح):**

پس از اتمام پیاده‌سازی این تسک، **بلافاصله** commit کن و **همان موقع**
به default branch (main/master) push کن. سپس به تسک بعدی برو.

✓ چرا این قانون حیاتی است:
  - تسک‌های بعدی ممکن است به فایل‌ها/تغییراتی که این تسک ایجاد کرده
    نیاز داشته باشند. اگر push نکنی، `git pull` بعدی آن‌ها را نمی‌بیند.
  - جمع‌کردن تغییرات چند تسک منجر به conflict های بزرگ می‌شود.
  - اگر در میانه fail کنی، task های push شده ضایع نمی‌شوند.

⛔ ممنوع: "همه task ها را تمام می‌کنم بعد یک‌جا push می‌زنم"
⛔ ممنوع: branch جدا برای task — مستقیم به default branch
⛔ ممنوع: task بعدی بدون push کامل task قبلی

---


## 🎯 هدف (خلاصه ساختاریافته)
[منطق] Irrelevant Inputs in `TelegramSettings.jsx`

## 📍 موقعیت دقیق در پروژه
_(فایل‌های دقیق توسط مجری شناسایی شوند — هیچ موقعیت مشخصی استخراج نشد)_

## 🧭 هدف اصلی پروژه (از یادداشت کاربر)
[auto-re-registered from github_import at 2026-05-29T10:02:34.527455+00:00]

## 🌐 نقشهٔ وابستگی‌ها
این مورد در pipeline notification است — همه فایل‌های این pipeline مرتبط هستند.

## 🔍 Context و وضعیت فعلی
## 📋 شرح ناسازگاری
در pipeline `notification` یک ناسازگاری منطقی پیدا شد:

The `TelegramSettings.jsx` component, whose primary purpose is to provide a UI for *configuring* Telegram integration, lists `sessions: Array` and `dataset: Array` as expected inputs. These inputs seem more relevant to the *content* or *context* of notifications rather than the *configuration* of the integration itself. While it might initiate actions, passing full `sessions` and `dataset` arrays directly to a settings component seems excessive and potentially indicative of a blurred responsibil

## 💥 پیامد (impact)
Passing large, potentially irrelevant data structures to a UI component can increase its complexity, reduce performance, and violate the principle of separation of concerns. It might also hint at the component doing more than just configuration, leading to a less maintainable and harder-to-test code

## 🛠 پیشنهاد رفع اولیه
Re-evaluate why `sessions` and `dataset` are inputs to `TelegramSettings.jsx`. If they are needed for *triggering specific test notifications* based on real data, consider passing only relevant IDs or summarized information, or delegate the actual data fetching/processing to a service layer that the component interacts with. If they are truly irrelevant to *settings*, remove them.

## 🤔 چرا مهم است
coherence issue یعنی دو بخش کد فرض‌های ناسازگار دارند — معمولاً نشانه‌ی refactor ناتمام یا feature flag rot است. این کلاس bug ها در test معمولی پیدا نمی‌شوند چون unit test ها در silo اجرا می‌شوند.

## ✅ معیار پذیرش (Acceptance Criteria) — رفتار-محور
**مهم:** هر AC رفتار قابل مشاهده را تعریف می‌کند، نه نام فایل/کلاس.
verify می‌تواند پیاده‌سازی متفاوت ولی هم‌ارز را قبول کند.

- [ ] هر دو طرف ناسازگاری شناسایی + فرض‌هایشان مستند شد
- [ ] ground truth تعیین شد و طرف دیگر align شد
- [ ] integration test برای pipeline `notification` بدون شکست عبور می‌کند
- [ ] PR description توضیح می‌دهد چرا این تصمیم گرفته شد
- [ ] هیچ تستی fail نمی‌شود (`npm run test` / `pytest`)
- [ ] linter بدون warning عبور می‌کند
- [ ] type-check موفق است (`tsc --noEmit` / `mypy`)

## 🪜 مراحل اجرایی پیشنهادی
1. گام ۱: هر دو طرف ناسازگاری را بخوان و فرض‌هایشان را لیست کن.
گام ۲: تصمیم بگیر کدام طرف ground truth است — معمولاً business logic مهم‌تر است.
گام ۳: طرف دیگر را با ground truth align کن.
گام ۴: integration test برای این pipeline بنویس تا regression جلوگیری شود.

## 📤 خروجی مورد انتظار
تغییر کد در فایل‌های مرتبط، commit یا PR جدید با پیام واضح، و عبور تمام معیارهای پذیرش.

## 🧪 دستورات اعتبارسنجی
- `pytest`
- `npm run test`

## ⚠️ ریسک‌ها و موارد احتیاط
تغییر یک طرف ممکن است downstream consumers را break کند. حتماً قبل از merge، همه caller های هر دو طرف را بررسی کن.

## 🔗 وابستگی‌های تسکی
_(مستقل)_

## 🏷 دسته‌بندی
- نوع: logic_audit
- اولویت: low
- تخمین زمان: medium

## Acceptance Criteria

1. هر دو طرف ناسازگاری شناسایی + فرض‌هایشان مستند شد
2. ground truth تعیین شد و طرف دیگر align شد
3. integration test برای pipeline `notification` بدون شکست عبور می‌کند
4. PR description توضیح می‌دهد چرا این تصمیم گرفته شد

## Task Steps

### Step 1: ارزیابی نیاز به `sessions` و `dataset` در `TelegramSettings.jsx`
**Status:** `pending` (0%)
**Scope:** این مرحله اولیه شامل یک بررسی و تحلیل کامل از کامپوننت `TelegramSettings.jsx` است تا هدف دقیق و نحوه استفاده از پراپ‌های `sessions` و `dataset` مشخص شود. این کار مستلزم ردیابی منشأ این پراپ‌ها، نحوه استفاده از آن‌ها در کامپوننت (در صورت وجود)، و اینکه آیا آن‌ها واقعاً برای جنبه 'تنظیمات' یکپارچه‌سازی تلگرام ضروری هستند یا حضور آن‌ها نشان‌دهنده نقض اصل تفکیک مسئولیت‌ها است. این مرحله شامل هیچ تغییر کدی نیست، بلکه یک بررسی عمیق از کد موجود برای اطلاع‌رسانی تصمیمات بازسازی بعدی است.
**Excerpt:**
```
The `TelegramSettings.jsx` component, whose primary purpose is to provide a UI for *configuring* Telegram integration, lists `sessions: Array` and `dataset: Array` as expected inputs. These inputs seem more relevant to the *content* or *context* of notifications rather than the *configuration* of the integration itself. While it might initiate actions, passing full `sessions` and `dataset` arrays directly to a settings component seems excessive and potentially indicative of a blurred responsibil... Re-evaluate why `sessions` and `dataset` are inputs to `TelegramSettings.jsx`.
```

### Step 2: بازسازی `TelegramSettings.jsx` برای استفاده از داده‌های خلاصه‌شده (گزینه مشروط A)
**Status:** `pending` (0%)
**Scope:** این مرحله *فقط در صورتی* اجرا می‌شود که ارزیابی در مرحله ۱ نشان دهد که `sessions` و `dataset` واقعاً برای 'فعال‌سازی اعلان‌های آزمایشی خاص' مورد نیاز هستند و استراتژی انتخابی، ارسال داده‌های خلاصه‌شده است. این شامل اصلاح `TelegramSettings.jsx` برای پذیرش یک ساختار داده مختصرتر (مانند آرایه‌ای از شناسه‌های جلسه یا یک شیء خلاصه) به جای آرایه‌های کامل `sessions` و `dataset` است. این کار مستلزم به‌روزرسانی انواع پراپ‌های کامپوننت و منطق داخلی برای کار با داده‌های جدید و کوچک‌تر خواهد بود.
**Excerpt:**
```
If they are needed for *triggering specific test notifications* based on real data, consider passing only relevant IDs or summarized information...
```

### Step 3: بازسازی `TelegramSettings.jsx` برای واگذاری واکشی داده به یک لایه سرویس (گزینه مشروط B)
**Status:** `pending` (0%)
**Scope:** این مرحله *فقط در صورتی* اجرا می‌شود که ارزیابی در مرحله ۱ نشان دهد که `sessions` و `dataset` واقعاً برای 'فعال‌سازی اعلان‌های آزمایشی خاص' مورد نیاز هستند و استراتژی انتخابی، واگذاری واکشی داده است. این شامل ایجاد یا اصلاح یک لایه سرویس موجود (مانند یک Redux slice، یک هوک سفارشی، یا یک کلاینت API اختصاصی) است که مسئول واکشی و پردازش داده‌های `sessions` و `dataset` است. سپس `TelegramSettings.jsx` برای تعامل با این لایه سرویس (مثلاً با فراخوانی یک تابع از سرویس یا اشتراک در وضعیت آن) برای به دست آوردن داده‌های لازم برای اعلان‌های آزمایشی، به جای دریافت مستقیم آن‌ها به عنوان پراپ، بازسازی خواهد شد.
**Excerpt:**
```
If they are needed for *triggering specific test notifications* based on real data, consider... delegate the actual data fetching/processing to a service layer that the component interacts with.
```

### Step 4: حذف ورودی‌های `sessions` و `dataset` از `TelegramSettings.jsx` (گزینه مشروط C)
**Status:** `pending` (0%)
**Scope:** این مرحله *فقط در صورتی* اجرا می‌شود که ارزیابی در مرحله ۱ نشان دهد که `sessions` و `dataset` کاملاً به هدف پیکربندی `TelegramSettings.jsx` بی‌ربط هستند. این شامل حذف مستقیم پراپ‌های `sessions` و `dataset` از تعریف کامپوننت `TelegramSettings.jsx` و هرگونه استفاده داخلی است. این ساده‌ترین مسیر بازسازی است اگر داده‌ها واقعاً مورد نیاز نباشند.
**Excerpt:**
```
If they are truly irrelevant to *settings*, remove them.
```

### Step 5: به‌روزرسانی تمام سایت‌های فراخوانی `TelegramSettings.jsx`
**Status:** `pending` (0%)
**Scope:** این مرحله حیاتی شامل شناسایی و اصلاح تمام کامپوننت‌های والد یا سرویس‌هایی است که در حال حاضر `sessions` و `dataset` را به `TelegramSettings.jsx` ارسال می‌کنند. اصلاحات باید با استراتژی بازسازی انتخاب‌شده از مراحل ۲، ۳ یا ۴ همسو باشد. اگر داده‌های خلاصه‌شده ارسال می‌شوند (گزینه A)، سایت‌های فراخوانی باید آن را ارائه دهند. اگر از یک لایه سرویس استفاده می‌شود (گزینه B)، سایت‌های فراخوانی باید پراپ‌ها را حذف کرده و احتمالاً لایه سرویس را فعال کنند. اگر پراپ‌ها به طور کامل حذف شوند (گزینه C)، سایت‌های فراخوانی باید از ارسال آن‌ها خودداری کنند. این کار از سازگاری در سراسر برنامه اطمینان حاصل می‌کند و از خطاهای نوع پراپ جلوگیری می‌کند.
**Excerpt:**
```
Passing large, potentially irrelevant data structures to a UI component can increase its complexity, reduce performance, and violate the principle of separation of concerns. It might also hint at the component doing more than just configuration, leading to a less maintainable and harder-to-test code
```

### Step 6: به‌روزرسانی تست‌های واحد برای `TelegramSettings.jsx`
**Status:** `pending` (0%)
**Scope:** این مرحله شامل به‌روزرسانی تست‌های واحد موجود برای `TelegramSettings.jsx` است تا تغییرات ایجاد شده در پراپ‌های ورودی و منطق داخلی آن را منعکس کند. اگر `sessions` و `dataset` حذف شدند، تست‌ها نباید دیگر حضور آن‌ها را mock یا assert کنند. اگر داده‌های خلاصه‌شده ارسال می‌شوند، تست‌ها باید از ساختار داده خلاصه‌شده جدید استفاده کنند. اگر یک لایه سرویس معرفی شود، تست‌ها باید تعاملات لایه سرویس را mock کنند. هدف این است که اطمینان حاصل شود که عملکرد پیکربندی کامپوننت به طور کامل در انزوا آزمایش می‌شود و به قرارداد جدید و واضح‌تر خود پایبند است.
**Excerpt:**
```
این کلاس bug ها در test معمولی پیدا نمی‌شوند چون unit test ها در silo اجرا می‌شوند.
```

### Step 7: به‌روزرسانی تست‌های یکپارچه‌سازی برای پایپلاین `notification`
**Status:** `pending` (0%)
**Scope:** این مرحله شامل بررسی و به‌روزرسانی تست‌های یکپارچه‌سازی مرتبط در پایپلاین `notification` است تا اطمینان حاصل شود که یکپارچه‌سازی تلگرام، به ویژه عملکردهای پیکربندی و اعلان آزمایشی، پس از تغییرات در `TelegramSettings.jsx` و سایت‌های فراخوانی آن، به درستی کار می‌کند. این برای شناسایی 'مسائل انسجام' که تست‌های واحد ممکن است از دست بدهند، حیاتی است. تست‌ها باید جریان سرتاسری را تأیید کنند، از جمله نحوه ذخیره پیکربندی و نحوه فعال‌سازی و پردازش اعلان‌های آزمایشی.
**Excerpt:**
```
coherence issue یعنی دو بخش کد فرض‌های ناسازگار دارند — معمولاً نشانه‌ی refactor ناتمام یا feature flag rot است. این کلاس bug ها در test معمولی پیدا نمی‌شوند چون unit test ها در silo اجرا می‌شوند.
```

### Step 8: مستندسازی تغییرات و انجام بازبینی کد
**Status:** `pending` (0%)
**Scope:** این مرحله نهایی شامل ایجاد یا به‌روزرسانی مستندات مرتبط (مانند README کامپوننت، مستندات API، نمودارهای معماری) برای منعکس کردن تغییرات ایجاد شده در `TelegramSettings.jsx`، قرارداد پراپ جدید آن، و هرگونه تعامل جدید با لایه سرویس است. علاوه بر این، یک بازبینی کد کامل باید توسط حداقل یک توسعه‌دهنده دیگر انجام شود تا اطمینان حاصل شود که تغییرات به استانداردهای کدنویسی پایبند هستند، از نظر منطقی صحیح هستند و ناسازگاری شناسایی‌شده را بدون معرفی مسائل جدید به درستی برطرف می‌کنند.
**Excerpt:**
```
Passing large, potentially irrelevant data structures to a UI component can increase its complexity, reduce performance, and violate the principle of separation of concerns. It might also hint at the component doing more than just configuration, leading to a less maintainable and harder-to-test code
```
