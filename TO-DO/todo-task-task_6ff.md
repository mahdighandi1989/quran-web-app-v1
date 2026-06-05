# TODO — Task task_6ff (نیاز به تکمیل دستی)

> **راه‌اندازی زیرساخت تست و پوشش‌دهی اولیه**

## 🔎 خلاصه وضعیت

- **task_id**: `task_6ffb98c44a2f`
- **repo**: `mahdighandi1989/quran-web-app-v1`
- **verification_status**: `partial`
- **archived_reason**: `max_retries` — Claude به سقف retry رسید بدون اینکه verify=done شود
- **retries_done**: 2
- **verifier confidence**: 0.95
- **verifier model**: `—`
- **report_id**: `3679692c-1ad2-4381-ade9-c6e0b2e04400`
- **created_at**: 2026-06-05T05:32:54.832350+00:00

## 🚧 چه چیزی باقی مانده (مهم‌ترین بخش)

- [ ] فایل vitest.config.js در ریشه پروژه ایجاد نشده است
- [ ] تست‌ها با npm test عبور نمی‌کنند (خطای pytest internal error)

## 👉 قدم‌های بعدی پیشنهادی (از verifier)

1. ایجاد فایل vitest.config.js با تنظیمات پایه (پلاگین React، محیط jsdom، globals، setupFiles)
2. رفع خطای pytest internal error برای عبور تست‌ها با npm test

## ✅ چه چیزی Claude انجام داد

- [x] وابستگی‌های Vitest و @testing-library در package.json اضافه شده‌اند
- [x] اسکریپت npm test در package.json تعریف شده است
- [x] فایل src/main.test.jsx با تست رندر App ایجاد شده است
- [x] تست رندر App بدون خطا در src/main.test.jsx وجود دارد
- [x] فایل src/test/setup.js برای تنظیمات global ایجاد شده است
- [x] فایل src/test/example.test.js با تست ساده ایجاد شده است
- [x] بررسی و همگام‌سازی وابستگی‌های upstream انجام شده است
- [x] بررسی و همگام‌سازی وابستگی‌های cross-tier انجام شده است
- [x] بررسی و همگام‌سازی وابستگی‌های جانبی انجام شده است
- [x] npm install برای نصب وابستگی‌های جدید اجرا شده است
- [x] ✓ اضافه کردن وابستگی‌های Vitest و @testing-library به package.json (code-aware: implemented)
- [x] ✓ ایجاد فایل setup تست src/test/setup.js (code-aware: implemented)
- [x] ✓ ایجاد تست ساده مثال src/test/example.test.js (code-aware: implemented)
- [x] ✓ ایجاد تست رندر برای src/main.jsx در src/main.test.jsx (code-aware: implemented)
- [x] ✓ بررسی و همگام‌سازی وابستگی‌های upstream (upstream dependencies) (code-aware: implemented)
- [x] ✓ بررسی و همگام‌سازی وابستگی‌های cross-tier (cross-tier dependencies) (code-aware: implemented)
- [x] ✓ بررسی و همگام‌سازی وابستگی‌های جانبی (side artifacts) (code-aware: implemented)
- [x] ✓ اجرای npm install برای نصب وابستگی‌های جدید (code-aware: implemented)
- [x] ✓ بررسی عدم وجود بخش Manual-required و عدم ایجاد فایل TO-DO (code-aware: implemented)

## 📝 خلاصهٔ verifier

بیشتر مراحل تسک راه‌اندازی زیرساخت تست انجام شده است: وابستگی‌ها نصب، اسکریپت‌ها تعریف، فایل‌های تست و setup ایجاد شده‌اند. اما فایل vitest.config.js ایجاد نشده و تست‌ها با خطای pytest internal error fail می‌شوند.

## 📋 Acceptance Criteria (مرجع کامل)

این لیست معیار done شدن تسک است — هر آیتمی که هنوز satisfy نیست
باید توسط انسان تکمیل شود.

- vitest و وابستگی‌های لازم در package.json اضافه شوند
- فایل vitest.config.js ایجاد شود
- اسکریپت npm test کار کند
- حداقل یک تست ساده (مثلاً 1+1=2) با npm test عبور کند
- فایل src/test/setup.js برای تنظیمات global ایجاد شود
- فایل src/main.test.jsx ایجاد شود
- تست بررسی کند که رندر App بدون خطا انجام می‌شود
- تست با npm test عبور کند

## 🔬 Evidence که verifier پیدا کرد

**Commits:**
- `a80580a`
- `4e6f38b`
- `f3e0d2f`
- `595b0d7`
- `a2ee914`
- `1cb8218`
- `0bc19af`

**Files lams شده:**
- `package.json`
- `src/main.test.jsx`
- `src/test/setup.js`
- `src/test/example.test.js`

## 💡 ایدهٔ اصلی تسک

🧬 این یک تسک تلفیقی است — از 2 تسک منفرد ساخته شده.
📌 دلیل تلفیق (rationale توسط AI): این تسک‌ها بر راه‌اندازی یک فریم‌ورک تست جدید (Vitest) و افزودن تست‌های اولیه برای فایل‌های حیاتی مانند main.jsx تمرکز دارند تا پوشش تست اولیه را فراهم کنند.
🎯 theme: راه‌اندازی زیرساخت تست و افزودن تست‌های پایه برای کامپوننت‌های اصلی
💎 estimated_difficulty: medium

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
تسک 1 از 2
  id: 6eba8818-3989-4526-9d4c-d8277cbe68e6
  عنوان اصلی: راه‌اندازی Vitest و افزودن تست پایه
  اولویت اصلی: critical
  وضعیت verify قبلی: partial
  فایل‌های دخیل: package.json

📋 acceptance_criteria کامل:
  - vitest و وابستگی‌های لازم در package.json اضافه شوند [verify_method=static] [verify_plan={"grep_patterns": ["\"vitest\":", "\"@vitest/ui\":", "\"@testing-library/vue\":"], "files_hint": ["package.json"]}]
  - فایل vitest.config.js ایجاد شود [verify_method=static] [verify_plan={"grep_patterns": ["vitest.config.js"], "files_hint": ["vitest.config.js"]}]
  - اسکریپت npm test کار کند [verify_method=static] [verify_plan={"grep_patterns": ["\"test\": \"vitest\""], "files_hint": ["package.json"]}]
  - حداقل یک تست ساده (مثلاً 1+1=2) با npm test عبور کند [verify_method=backend_test] [verify_plan={"test_node": "src/test/example.test.js", "timeout_seconds": 60}]
  - فایل src/test/setup.js برای تنظیمات global ایجاد شود [verify_method=static] [verify_plan={"grep_patterns": ["src/test/setup.js"], "files_hint": ["src/test/setup.js"]}]

📝 idea_prompt اصلی (بدون تغییر و بدون خلاصه‌سازی):
## ⚠️

## 📜 پرامپت اصلی (excerpt)

```
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
  با

_[truncated — full prompt در پنل]_
```

---

_این فایل توسط Claude Auto-Runner تولید شده است. تسک با حالت_ `max_retries` _آرشیو شده و دیگر به‌صورت خودکار pickup نمی‌شود._