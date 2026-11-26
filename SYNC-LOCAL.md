# همسان‌سازی نسخه محلی با گیت‌هاب

## وضعیت فعلی (پس از به‌روزرسانی هسته)
- `core.js` نسخه **3.1** روی گیت‌هاب: امکانات را **خودکار** برای هر ماژولی که `#p-notes` / `#p-rems` / `#p-cartable` دارد بارگذاری می‌کند.
- `pr.html` به `pr-media.html` هدایت می‌شود.
- فایل‌های آزمایشی اضافی حذف شده‌اند.

## روش بدون Git (پیشنهادی برای شما)

### روش ۱ — دانلود کامل
1. باز کنید: https://github.com/alm989/smart-platform-alm
2. دکمه سبز **Code** → **Download ZIP**
3. ZIP را در `D:\smart-platform-alm` باز کنید و فایل‌ها را **جایگزین** کنید

### روش ۲ — فقط فایل‌های حیاتی
این لینک‌ها را Save As کنید داخل `D:\smart-platform-alm`:

- https://raw.githubusercontent.com/alm989/smart-platform-alm/main/core.js
- https://raw.githubusercontent.com/alm989/smart-platform-alm/main/suite-facilities.js
- https://raw.githubusercontent.com/alm989/smart-platform-alm/main/facilities-autoload.js
- https://raw.githubusercontent.com/alm989/smart-platform-alm/main/pr.html
- https://raw.githubusercontent.com/alm989/smart-platform-alm/main/CHECKLIST-MODULES.md

## بعد از همسان‌سازی
1. `cashbox.html` را باز کنید
2. F12 → Console: خطای قرمز نباشد
3. امکانات → یادداشت را ذخیره کنید
4. طبق `CHECKLIST-MODULES.md` پیش بروید

## اگر facilities لود نشد
در `<head>` ماژول CSP را به این شکل اصلاح کنید:

```
script-src 'self' 'unsafe-inline'
```

یا دوباره اجرا کنید:
```powershell
powershell -ExecutionPolicy Bypass -File .\apply-facilities-to-all.ps1
```
