---
title: "تمدیدِ واقعاً بی‌صدای OAuth در وب = refresh token روی سرور"
tags: ["oauth", "google", "refresh-token", "encryption", "popup", "security"]
topic_canonical: "silent-oauth-renewal-needs-a-server-refresh-token"
source:
  type: "claude-code-task"
  origin: "claude-code"
  imported_at: "2026-11-08T21:30:00Z"
created_at: "2026-11-08T21:30:00Z"
updated_at: "2026-11-08T21:30:00Z"
merged_from: []
agents: ["Claude Code"]
---

# تمدیدِ واقعاً بی‌صدای OAuth در وب = refresh token روی سرور

## 🎯 چالش / Challenge
توکنِ دسترسیِ گوگل ~۱ ساعت عمر دارد. «تمدیدِ بی‌صدا» با کلاینتِ توکنیِ GIS (`prompt:"none"`) در عمل **پنجره باز می‌کند**؛ بی‌کلیک
مرورگر آن را می‌بندد یا اگر popup مجاز باشد پنجره‌ای می‌پرد. کاربر می‌خواهد «یک بار وصل شود و دیگر هیچ».

## 💡 راه‌حل / Solution
1. یک بار، از کلیک: کلاینتِ **CODE** ِ GIS (popup) — خودش `access_type=offline` و `prompt=consent` می‌فرستد؛ تبادل با `redirect_uri=postmessage` (URI ِ تازه لازم نیست؛ JS origin کافی است).
2. سرور کد را با client secret عوض می‌کند، حساب را با کاربرِ واردشده تطبیق می‌دهد (وگرنه revoke)، refresh token را با AES-GCM رمز و در انباری که مرورگر به آن راه ندارد نگه می‌دارد.
3. صفحه هر وقت توکن لازم دارد (بارگذاری، ۴۰۱، تایمر) از سرور می‌گیرد — بی‌پنجره. `invalid_grant` ⇒ حذف و «یک بار دیگر وصل شو».
4. «قطع اتصال» = revoke در گوگل + حذفِ رکورد.

## 🧪 نمونه کد (Anonymized)
```js
// click handler — no await before this line, or the popup is blocked
google.accounts.oauth2.initCodeClient({ client_id, scope, ux_mode: 'popup', login_hint, callback: (r) => post('/connect', { code: r.code }) }).requestCode();
```

## ⚠️ نکات حیاتی / Pitfalls
- اسکریپتِ GIS را پیش از کلیک بارگذاری کن؛ await ِ بارگذاری در کلیک فعال‌سازیِ کاربر را می‌سوزاند.
- refresh token را هرگز به مرورگر برنگردان و لاگ نکن؛ فقط کدِ خطای گوگل را لاگ کن.
- کلیدِ رمزنگاری را بعداً عوض نکن (یا طرحِ چرخش داشته باش) — وگرنه همهٔ اتصال‌ها یک بار دیگر لازم می‌شوند.
- حساب را تطبیق بده: کدِ یک حسابِ دیگر نباید زیرِ uid ِ این کاربر بنشیند.

## ✅ Resolution
- Status: partial (کد و تست‌ها کامل؛ فعال‌سازی منتظرِ دو متغیرِ محیطیِ مالک)
- Evidence: ۱۱ تستِ سرور (رمزنگاری، تطبیقِ حساب، تمدید پس از انقضا و راه‌اندازیِ دوباره، revoke) و ۵ تستِ کلاینت سبز.

## 🔁 چطور در جای دیگر اعمال کنیم / How to Apply Elsewhere
### Applies when
- هر وب‌اپی که باید پس از یک رضایت، بی‌حضورِ کاربر به API ِ گوگل (Drive/Calendar/…) دسترسی داشته باشد.
### Does NOT apply when (anti-pattern)
- اپِ کاملاً ایستا بی‌سرور (جای امنی برای refresh token نیست) — آن‌جا یک کلیک در هر جلسه اجتناب‌ناپذیر است.
### Prerequisites
- یک سرورِ کوچک با رازِ کلاینت و یک انبارِ فقط‌سرور.
