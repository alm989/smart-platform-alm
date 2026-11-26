# رگرسیون سه‌نقش — ماژول‌های مالی

تاریخ: 2026-11-26  
نقش‌ها: `admin` / `manager` / `user`  
ماژول‌ها: صندوق، بانک، تنخواه، حسابداری، سوئیت

ورود از JWT سوئیت (`suite.html`) — هر تست را با **خروج سرور** و ورود نقش بعد جدا کنید.

---

## A) نقش admin

| # | تست | قبول |
|---|-----|------|
| A1 | ورود JWT با admin | ☐ |
| A2 | همه کاشی‌های مالی در سوئیت دیده می‌شود | ☐ |
| A3 | صندوق: ثبت دریافت/پرداخت → اثر pending | ☐ |
| A4 | بانک: ثبت → اثر pending | ☐ |
| A5 | حسابداری: پنل آثار فارسی + دکمه ثبت‌شده | ☐ |
| A6 | ثبت‌شده → سند موقت در localStorage + فرم سند | ☐ |
| A7 | فهرست/گزارش اسناد موقت شامل سند جدید | ☐ |
| A8 | `/api/audit` شامل login و effect_patch | ☐ |
| A9 | backup manual از API | ☐ |

```js
// Console (admin)
fetch('/api/effects?status=pending',{headers:{Authorization:'Bearer '+sessionStorage.getItem('smart_suite_api_token')}}).then(r=>r.json()).then(console.log)
JSON.parse(localStorage.getItem('smart_mod_accounting_v2')||'{}').stores?.voucher?.slice(0,3)
```

---

## B) نقش manager

| # | تست | قبول |
|---|-----|------|
| B1 | ورود manager | ☐ |
| B2 | مالی باز می‌شود؛ sysadmin مخفی/403 | ☐ |
| B3 | صندوق ثبت → اثر | ☐ |
| B4 | حسابداری: دیدن pending و ثبت‌شده | ☐ |
| B5 | restore backup اگر ممنوع است → 403 | ☐ |

---

## C) نقش user

| # | تست | قبول |
|---|-----|------|
| C1 | ورود user | ☐ |
| C2 | تعداد کاشی کمتر از admin | ☐ |
| C3 | در صورت دسترسی صندوق: ثبت اثر | ☐ |
| C4 | بدون مجوز backup → 403 | ☐ |
| C5 | خروج سرور → فرم JWT دوباره | ☐ |

---

## معیار پذیرش

- هیچ خطای قرمز مکرر در Console برای مسیرهای بالا
- اثر pending پس از ثبت صندوق/بانک در `/api/effects`
- پس از posted: `stores.voucher` حداقل یک رکورد با `وضعیت: موقت` و `effectId`
- جداکننده مبلغ روی blur فیلدهای مبلغ (مرحله ۳)

نتیجه را با تیک و نقش گزارش کنید.
