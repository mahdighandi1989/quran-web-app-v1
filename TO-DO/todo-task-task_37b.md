# TODO — Task task_37b (نیاز به تکمیل دستی)

> **رفع خطای WebSocket و Anti-pattern Inspector Bridge**

## 🔎 خلاصه وضعیت

- **task_id**: `task_37bd70be3e74`
- **repo**: `mahdighandi1989/quran-web-app-v1`
- **verification_status**: `partial`
- **archived_reason**: `max_retries` — Claude به سقف retry رسید بدون اینکه verify=done شود
- **retries_done**: 2
- **verifier confidence**: 0.85
- **verifier model**: `—`
- **report_id**: `0eba1d05-71be-4659-82b0-5e17fdcba158`
- **created_at**: 2026-06-05T05:29:29.465308+00:00

## 🚧 چه چیزی باقی مانده (مهم‌ترین بخش)

- [ ] اتصال WebSocket در محیط production غیرفعال نشده (اسکریپت شرطی ندارد)
- [ ] آدرس WebSocket به متغیر محیطی منتقل نشده و hardcoded باقی مانده
- [ ] خطاهای WebSocket در کنسول مرورگر در production مدیریت نشده
- [ ] اسکریپت Inspector Bridge به endpoint محلی تغییر نکرده یا حذف نشده

## 👉 قدم‌های بعدی پیشنهادی (از verifier)

1. شرطی کردن اتصال WebSocket در index.html با VITE_ENABLE_INSPECTOR_BRIDGE برای production
2. انتقال آدرس WebSocket به متغیر محیطی VITE_WS_URL
3. مدیریت خطاهای WebSocket برای عدم نمایش در کنسول production

## ✅ چه چیزی Claude انجام داد

- [x] اسکریپت Inspector Bridge در index.html وجود دارد و به WebSocket متصل می‌شود
- [x] تایپ pageUrl در payload پیام inspector-bridge-ready اصلاح شده
- [x] کامنت توجیهی برای اصلاح broken feedback loop اضافه شده
- [x] ریشه anti-pattern (تایپ window.locatio) تشخیص داده شده
- [x] تست edge case برای اصلاح broken feedback loop نوشته شده
- [x] متغیر محیطی VITE_ENABLE_INSPECTOR_BRIDGE به .env.example اضافه شده

## 📝 خلاصهٔ verifier

بخش‌هایی از تسک انجام شده: اصلاح تایپ، کامنت توجیهی، تست edge case، و اضافه شدن متغیر محیطی. اما شرطی کردن اتصال برای production، انتقال URL به متغیر محیطی، و مدیریت خطاهای کنسول هنوز باقی مانده است.

## 📋 Acceptance Criteria (مرجع کامل)

این لیست معیار done شدن تسک است — هر آیتمی که هنوز satisfy نیست
باید توسط انسان تکمیل شود.

- اسکریپت Inspector Bridge به یک endpoint WebSocket معتبر متصل شود یا به طور کامل حذف شود
- هیچ خطای WebSocket در کنسول مرورگر ظاهر نشود
- ریشه anti-pattern تشخیص داده شد
- یا کد اصلاح شد، یا کامنت توجیهی اضافه شد
- تست edge case نوشته شد
- در محیط production (build شده) WebSocket connection برقرار نشود
- در محیط development با متغیر محیطی مناسب فعال شود
- هیچ error در کنسول مرورگر در production ظاهر نشود

## 🔬 Evidence که verifier پیدا کرد

**Commits:**
- `ce723ae`
- `4a495f4`
- `cc8d84a`
- `dd8c5b1`
- `93aabb7`
- `f3e0d2f`
- `c56f89c`

**Files lams شده:**
- `index.html`
- `tests/test_inspector_bridge.py`
- `.env.example`

## 💡 ایدهٔ اصلی تسک

🧬 این یک تسک تلفیقی است — از 3 تسک منفرد ساخته شده.
📌 دلیل تلفیق (rationale توسط AI): این خوشه شامل تسک‌هایی است که به رفع خطاها، بهبود الگوهای طراحی و شرطی‌سازی اتصال مربوط به WebSocket Inspector Bridge در فایل index.html می‌پردازند.
🎯 theme: رفع اشکال و بهبود عملکرد WebSocket Inspector Bridge در index.html
💎 estimated_difficulty: medium

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
تسک 1 از 3
  id: 43dafd3f-95d5-4cdc-aece-903a8bcd5c1f
  عنوان اصلی: رفع خطای WebSocket Inspector Bridge
  اولویت اصلی: high
  وضعیت verify قبلی: partial
  فایل‌های دخیل: index.html

📋 acceptance_criteria کامل:
  - اسکریپت Inspector Bridge به یک endpoint WebSocket معتبر متصل شود یا به طور کامل حذف شود [verify_method=static] [verify_plan={"grep_patterns": ["wss://ai-creator-backend-q677.onrender.com/api/render/ws/bridge/gh_mahdighandi1989_quran_web_app_v1"], "files_hint": ["index.html"]}]
  - هیچ خطای WebSocket در کنسول مرورگر ظاهر نشود [verify_method=ui_interaction] [verify_plan={"base": "frontend", "ui_steps": [{"action": "navigate", "url": "/"}, {"action": "wait_for_load", "state": "networkidle"}, {"action": "assert_console_output", "type": "error", "not_contains": "WebSock]

📝 idea_prompt اصلی (بدون تغییر و بدون خلاصه‌سازی):
## ⚠️ یادداشت مهم برای مدل اجراکننده — قبل از شروع بخوان

این پرامپت بر اساس یک **بررسی اولیهٔ خودکار** از repo ساخته شده — ممکن است
حاوی اشتباه، تشخیص نادرست، یا حذف موارد مهم باشد. به‌عنوان منبع نهایی به
آن استناد نکن.

📖 **خواندن کامل + اجرای مو-به-مو (بسیار مهم):**

این پرامپت 

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