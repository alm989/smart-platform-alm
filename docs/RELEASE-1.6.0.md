# Smart Platform ALM — Release 1.6.0

**تاریخ:** 2026-11-27

## خلاصه
نسخه پایدار پس از تکمیل effects مالی گسترده، حسابداری موقت/دائم، online-first، IAM ماژولی روی data API، و seed کدینگ برای منابع جدید.

## شامل
- Effects: cashbox, bank, tankhah, sales, purchase, payroll, warehouse, tax, budget
- حسابداری: سند موقت از اثر، حل TEMP، دائم‌سازی
- جداکننده مبلغ، CSV گزارش، صف آفلاین effects
- RBAC ماژول (`lib/rbac-modules.js`) + کنترل `/api/data/:id`
- IAM effects: ثبت اثر فقط اگر نقش به ماژول منبع دسترسی دارد؛ تأیید/رد فقط admin/ceo/manager
- Seed کدینگ: 1101–1103، 1301 انبار، 2101 مقابل، 2201 مالیات، 4101 فروش، 5101 خرید، 5102 حقوق، 6101 بودجه

## نصب / اعمال محلی
```powershell
cd D:\smart-platform-alm
git pull origin main
powershell -ExecutionPolicy Bypass -File .\server\scripts\apply-release-1.6.0.ps1
cd server
.\COPY-MODULES.bat
# restart node server.js
```

## Zip پشتیبان
```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmm'
Compress-Archive -Path 'D:\smart-platform-alm\*' -DestinationPath "D:\smart-platform-alm-v1.6.0-$stamp.zip" -Force
```

## Git tag
```powershell
cd D:\smart-platform-alm
git tag -a v1.6.0 -m "Smart Platform ALM stable 1.6.0"
git push origin v1.6.0
```
