# Smart Suite — هسته یکپارچه v3

## نصب
1. همه فایل‌های HTML و `core.js` را در **یک پوشه** بگذارید.
2. `suite.html` را در مرورگر باز کنید.
3. ورود: `admin` / `admin` — پین دوم: `1234`

## بسته کامل
اگر مخزن ناقص بود، بسته ZIP را از گوگل‌درایو بگیرید:
https://drive.google.com/file/d/1ZGwhiHkC8zMC1aOYGI5FGBtlESN5-1QR/view?usp=drivesdk

`suite.html` کامل:
https://drive.google.com/file/d/1DUu6lUYaN5VkYwgwNQCSxAzMz7wlRIr-/view?usp=drivesdk

## هسته (core.js)
- Registry یکسان با لانچر
- Auth + PIN2
- Audit / Event bus
- Tab lock / esc / soft-delete
- Backup

## ماژول‌های متصل
همه ماژول‌های اصلی `core.js` را بارگذاری می‌کنند و هنگام ذخیره به SmartCore رویداد می‌فرستند.
هر ماژول تابع هوش تخصصی (`scSmartMod`) دارد.

## امنیت
- CSP فعال
- بدون eval
- کلیدهای غیر `smart_*` / `suite_*` مسدود
- احراز هویت سمت کلاینت (محدودیت مرورگر)
