# امکانات یکپارچه v2 — اعمال روی همه ماژول‌ها

## فایل‌های لازم (در ریشه ریپو)
- `suite-facilities.js` — منطق کامل
- `facilities-autoload.js` — تشخیص ماژول از نام فایل + init
- `apply-facilities-to-all.ps1` — پچ یک‌مرحله‌ای ویندوز
- `apply-facilities-to-all.sh` — پچ یک‌مرحله‌ای لینوکس/مک

## اعمال خودکار (پیشنهادی)

### ویندوز (PowerShell)
```powershell
cd مسیر\smart-platform-alm
.\apply-facilities-to-all.ps1
git add *.html
git commit -m "wire suite-facilities into all modules"
git push
```

### لینوکس / مک
```bash
cd مسیر/smart-platform-alm
bash apply-facilities-to-all.sh
git add *.html
git commit -m "wire suite-facilities into all modules"
git push
```

هر اسکریپت برای همه ماژول‌ها:
1. CSP را به `script-src 'self' 'unsafe-inline'` اصلاح می‌کند
2. بعد از `core.js` این دو خط را اضافه می‌کند:
   - `suite-facilities.js` با `data-module` و `data-title` درست
   - `facilities-autoload.js`

ساختار UI ماژول‌ها عوض نمی‌شود.

## قابلیت‌ها بعد از پچ
- یادداشت / یادآوری محلی هر ماژول
- کارتابل سراسری متصل (`suite_cartable_v1`)
- تقویم شمسی انتخابی
- شناسه یکتا
- ارسال به ماژول + کاربر مقصد

## تست
1. `cashbox.html` را باز کنید → امکانات → یادداشت / یادآوری / کارتابل
2. به ماژول دیگر ارسال کنید و در آن ماژول دریافت را ببینید
