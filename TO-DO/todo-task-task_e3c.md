# TODO — Task task_e3c (نیاز به تکمیل دستی)

> **تقویت امنیت و پیکربندی پایه پروژه**

## 🔎 خلاصه وضعیت

- **task_id**: `task_e3cec9e4feb5`
- **repo**: `mahdighandi1989/quran-web-app-v1`
- **verification_status**: `partial`
- **archived_reason**: `max_retries` — Claude به سقف retry رسید بدون اینکه verify=done شود
- **retries_done**: 1
- **verifier confidence**: 0.85
- **verifier model**: `—`
- **report_id**: `c3857f25-b753-41a0-8950-8a0e9c9b53fb`
- **created_at**: 2026-06-05T05:17:35.654449+00:00

## 🚧 چه چیزی باقی مانده (مهم‌ترین بخش)

- [ ] فایل LICENSE در ریشه پروژه وجود ندارد
- [ ] مجوز در README.md ذکر نشده است
- [ ] package.json فیلد license را ندارد
- [ ] الگوهای credentials.json, service-account*.json, *.key, *.pem در .gitignore اضافه نشده
- [ ] الگوهای node_modules, dist, *.log, .DS_Store در .gitignore اضافه نشده
- [ ] اعتبارسنجی selectorها برای محدودیت به کاراکترهای مجاز کامل نیست (فقط escape شده)
- [ ] URLها به جای https:// به http و https اجازه می‌دهند

## 👉 قدم‌های بعدی پیشنهادی (از verifier)

1. ایجاد فایل LICENSE با مجوز MIT یا Apache-2.0 در ریشه پروژه
2. اضافه کردن ذکر مجوز در README.md و فیلد license در package.json
3. اضافه کردن الگوهای credentials.json, service-account*.json, *.key, *.pem به .gitignore
4. اضافه کردن node_modules, dist, *.log, .DS_Store به .gitignore
5. تکمیل اعتبارسنجی selectorها برای محدودیت به کاراکترهای مجاز
6. محدود کردن URLها فقط به https:// به جای http و https

## ✅ چه چیزی Claude انجام داد

- [x] اعتبارسنجی URLها در handleInspectorCommand برای محدودیت به http/https و جلوگیری از javascript: پیاده‌سازی شده
- [x] تابع sanitizeSelector برای پاک‌سازی selectorها در index.html اضافه شده
- [x] فایل‌های تست برای نادیده گرفته شدن فایل‌های حساس در .gitignore ایجاد شده
- [x] الگوهای امنیتی .env, .env.local, .env.*.local به .gitignore اضافه شده
- [x] تست‌های test_git_ignore.py و integration/test_git_ignore.py برای بررسی .gitignore اضافه شده

## 📝 خلاصهٔ verifier

بخش امنیتی Inspector Bridge (اعتبارسنجی URL و جلوگیری از javascript:) و بخشی از .gitignore (env files) انجام شده، اما فایل LICENSE، ذکر مجوز، و الگوهای امنیتی کامل .gitignore هنوز باقی است.

## 📋 Acceptance Criteria (مرجع کامل)

این لیست معیار done شدن تسک است — هر آیتمی که هنوز satisfy نیست
باید توسط انسان تکمیل شود.

- selectorها محدود به کاراکترهای مجاز شوند
- URLها فقط به https:// محدود شوند
- از javascript: protocol جلوگیری شود
- فایل LICENSE در ریشه پروژه وجود داشته باشد
- مجوز در README.md ذکر شده باشد
- package.json شامل فیلد license باشد
- الگوهای امنیتی به .gitignore اضافه شوند
- فایل‌های env و credentials از git ignore شوند
- فایل .gitignore شامل node_modules, dist, .env باشد
- فایل‌های غیرضروری در git status نمایش داده نشوند

## 🔬 Evidence که verifier پیدا کرد

**Commits:**
- `cc8d84a`
- `ce723ae`
- `4a495f4`
- `d1220a2`
- `ec77112`

**Files lams شده:**
- `index.html`
- `.gitignore`
- `tests/test_git_ignore.py`
- `tests/integration/test_git_ignore.py`

## 💡 ایدهٔ اصلی تسک

🧬 این یک تسک تلفیقی است — از 4 تسک منفرد ساخته شده.
📌 دلیل تلفیق (rationale توسط AI): این تسک‌ها بر بهبود جنبه‌های امنیتی پروژه از طریق اعتبارسنجی ورودی و مدیریت فایل‌های حساس (مانند .gitignore) و همچنین تکمیل پیکربندی‌های اولیه و اطلاعات مجوز پروژه تمرکز دارند.
🎯 theme: تقویت امنیت و پیکربندی اولیه پروژه
💎 estimated_difficulty: medium

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
تسک 1 از 4
  id: 2fdbbff9-ff50-450a-87bb-6361f098e2b7
  عنوان اصلی: اعتبارسنجی ورودی تابع handleInspectorCommand
  اولویت اصلی: critical
  وضعیت verify قبلی: partial
  فایل‌های دخیل: index.html

📋 acceptance_criteria کامل:
  - selectorها محدود به کاراکترهای مجاز شوند [verify_method=static] [verify_plan={"grep_patterns": ["sanitizeSelector\\(msg\\.selector\\)", "validateSelector\\(msg\\.selector\\)", "msg\\.selector\\.match\\(/^[a-zA-Z0-9\\-_#\\.\\s\\[\\]=\\'\\\"]+$/\\)", "document\\.querySelector\\(]
  - URLها فقط به https:// محدود شوند [verify_method=ui_interaction] [verify_plan={"base": "frontend", "ui_steps": [{"action": "navigate", "url": "/oversight"}, {"action": "wait_for_load", "state": "networkidle"}, {"action": "fill", "selector": "[data-testid='inspector-command-url-]
  - از javascript: protocol جلوگیری شود [verify_method=ui_interaction] [verify_plan={"base": "frontend", "ui_steps": [{"action": "navigate", "url": "/oversight"}, {"action": "wait_for_load", "state": "networkidle"}, {"action": "fill", "selector": "[data-testid='inspector-command-url-]

📝 idea_prompt اصلی (بدون تغییر و بدون خلاصه‌سازی

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