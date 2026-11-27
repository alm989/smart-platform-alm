# Next-5 — حقوق، انبار، IAM، صف آفلاین

## 1) حقوق و انبار → effects
- `payroll.html`: پس از ثبت مبلغ → `source: payroll`
- `warehouse.html`: پس از ثبت مبلغ → `source: warehouse`
- در حسابداری مانند سایر آثار دیده می‌شوند

تست:
```js
fetch('/api/effects?source=payroll',{headers:{Authorization:'Bearer '+sessionStorage.getItem('smart_suite_api_token')}}).then(r=>r.json()).then(console.log)
```

## 2) IAM سرور
- `canWriteEffect(s)` برای POST اثر
- `canApproveEffect(s)` برای PATCH به posted/rejected (admin/ceo/manager)
- نقش user می‌تواند اثر ثبت کند ولی تأیید/رد فقط مدیر

پس از اعمال اسکریپت: سرور را restart کنید.

## 3) صف آفلاین
- اگر POST شکست بخورد یا توکن نباشد → `localStorage.smart_effects_offline_v1`
- دکمه پایین‌چپ: **ارسال صف آفلاین**
- با `online` خودکار flush می‌شود

```js
JSON.parse(localStorage.getItem('smart_effects_offline_v1')||'[]')
sfFlushOfflineEffects()
```
