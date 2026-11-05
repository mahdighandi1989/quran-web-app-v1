---
title: "A sign-in popup on another domain can stay blank under storage partitioning — measure before switching authDomain"
tags: ["auth", "oauth", "firebase", "browser", "storage-partitioning"]
topic_canonical: "cross-site-auth-popup-needs-same-site-domain"
source:
  type: "claude-code-task"
  origin: "claude-code"
  imported_at: "2026-11-05T13:40:00Z"
created_at: "2026-11-05T13:40:00Z"
updated_at: "2026-11-05T13:40:00Z"
merged_from: []
agents: ["Claude Code"]
---

# A sign-in popup on another domain can stay blank — and the fix needs the OAuth client to agree first

## مسئله
پنجرهٔ ورود (handler ِ Firebase روی `*.firebaseapp.com`) برای سایتی روی دامنهٔ دیگر کاملاً سفید ماند و اتصال با خطا تمام شد.

## ریشه
خودِ handler سالم بود (تا صفحهٔ گوگل می‌رفت). نتیجه باید از پنجرهٔ دامنهٔ firebaseapp.com به iframe ِ همان دامنه **درونِ سایتِ دیگر** برسد؛
مرورگرها ذخیره‌سازیِ شخص‌ثالث را جدا می‌کنند و پیام نمی‌رسد. وقتی انتخابگرِ حساب حذف شد (login_hint)، کاربر مستقیم به همین مرحلهٔ شکسته رسید.

## راه‌حل
- مسیرِ `/__/auth/*` را روی دامنهٔ خودِ سایت به handler پراکسی کن و authDomain را همان دامنه بگذار — ولی **فقط پس از** افزودنِ
  `https://<site>/__/auth/handler` به redirect URIهای OAuth client؛ وگرنه ورود با `redirect_uri_mismatch` کاملاً می‌شکند.
- پیش از تغییر، پذیرشِ گوگل را بی‌حساب با مرورگر بسنج: URL ِ `accounts.google.com/o/oauth2/auth` با همان client_id و redirect_uri ِ تازه.
- تا گامِ کنسول انجام نشده، علت را به کاربر بگو و راهِ دوم (redirect) را با دکمه بده، نه خودکار.

## درس
تغییرِ دامنهٔ ورود دو طرف دارد: سایت و OAuth client. طرفِ سایت را آماده کن، طرفِ کنسول را با آزمونِ بی‌حساب بسنج، و ترتیب را برای مالک بنویس.

## 🔁 چطور در جای دیگر اعمال کنیم / How to Apply Elsewhere
هر اپ با Firebase Auth روی دامنه‌ای جز `firebaseapp.com`/`web.app`: پراکسیِ `/__/auth/*`، redirect URI ِ همان دامنه در OAuth client، و `authDomain` = دامنهٔ اپ.
