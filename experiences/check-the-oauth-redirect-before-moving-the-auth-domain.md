---
title: "پیش از جابه‌جاییِ دامنهٔ ورود، redirect URI را از خودِ گوگل بپرس"
tags: ["auth", "oauth", "firebase", "dns", "popup", "frontend"]
topic_canonical: "check-the-oauth-redirect-before-moving-the-auth-domain"
source:
  type: "claude-code-task"
  origin: "claude-code"
  imported_at: "2026-11-08T14:10:00Z"
created_at: "2026-11-08T14:10:00Z"
updated_at: "2026-11-08T14:10:00Z"
merged_from: []
agents: ["Claude Code"]
---

# پیش از جابه‌جاییِ دامنهٔ ورود، redirect URI را از خودِ گوگل بپرس

## 🎯 چالش / Challenge
پنجرهٔ ورودِ OAuth روی دامنهٔ میزبانِ احراز (مثلاً `*.firebaseapp.com`) روی دستگاهِ یک کاربر NXDOMAIN داد. نتیجه‌گیریِ اولیه: «دامنه وجود ندارد؛
دامنهٔ ورود را به دامنهٔ سایت ببر». هر دو نیمه نیاز به سنجش داشت: دامنه در DNS ِ عمومی بود (فیلترِ شبکهٔ کاربر)، و جابه‌جایی بدونِ ثبتِ redirect URI
ورودِ همهٔ کاربران را روی `redirect_uri_mismatch` می‌شکست.

## 💡 راه‌حل / Solution
1. DNS را از چند resolver ِ عمومی بسنج (DNS-over-HTTPS اگر UDP بسته است): اگر آن‌ها جواب می‌دهند، مشکل محلی است.
2. پیش از تغییرِ authDomain، یک GET ِ بی‌اعتبارنامه به endpoint ِ authorize ِ گوگل با `client_id` و `redirect_uri` ِ تازه بزن: ۳۰۲ به `signin/oauth/error?authError=…redirect_uri_mismatch` یعنی ثبت نشده.
3. جابه‌جایی را پشتِ یک کلیدِ صریح بگذار و پس از ثبت (که کارِ مالک است) با همان آزمون روشن کن.
4. تا آن زمان: دسترسی‌پذیریِ میزبانِ ورود را هنگامِ بارگذاری در پس‌زمینه بسنج (`fetch` no-cors) و در کلیک فقط نتیجهٔ آماده را بخوان؛ دست‌نیافتنی ⇒ پیام، نه پنجره.

## 🧪 نمونه کد (Anonymized)
```bash
curl -s -o /dev/null -w '%{redirect_url}\n' \
  "https://accounts.google.com/o/oauth2/v2/auth?client_id=$CID&redirect_uri=$(urlencode $NEW)&response_type=code&scope=openid"
# …/signin/oauth/error?authError=… (base64 contains redirect_uri_mismatch) ⇒ not registered
```

## ⚠️ نکات حیاتی / Pitfalls
- `await` پیش از `window.open` فعال‌سازیِ کاربر را مصرف می‌کند (به‌ویژه Safari) ⇒ پنجره مسدود؛ سنجش باید پیش از کلیک تمام شده باشد.
- پاسخِ opaque ِ no-cors کافی است: DNS/TLS/سرور را ثابت می‌کند؛ NXDOMAIN reject می‌شود.
- «سایت برای من باز نمی‌شود» ≠ «سایت وجود ندارد».

## ✅ Resolution
- Status: partial (رفعِ دائمی منتظرِ ثبتِ redirect URI توسطِ مالک)
- Evidence: Playwright با `namenotresolved` ⇒ ۰ پنجره + پیام؛ در دسترس ⇒ ۱ پنجره؛ آزمونِ authorize: onrender = mismatch، firebaseapp = پذیرفته.

## 🔁 چطور در جای دیگر اعمال کنیم / How to Apply Elsewhere
### Applies when
- هر جابه‌جاییِ authDomain / callback ِ OAuth؛ گزارشِ «پنجرهٔ ورود باز نمی‌شود» از یک شبکهٔ خاص.
### Does NOT apply when (anti-pattern)
- خطای ورود برای همه (آن‌جا اول پیکربندیِ پروژه را بسنج، نه شبکهٔ کاربر).
### Prerequisites
- شناسهٔ کلاینتِ OAuth (عمومی است) و یک پراکسیِ `/__/auth/*` روی دامنهٔ سایت.
