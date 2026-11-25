# پوسته مشترک ماژول‌ها (module-kit)

## فایل‌ها
- module-kit.css
- module-kit.js

## نصب در هر ماژول
1. این دو فایل را کنار HTML ماژول بگذارید.
2. در <head>:
   <link rel="stylesheet" href="module-kit.css">
3. قبل از </body>:
   <script src="module-kit.js"></script>
4. ساختار هدر را از multi-company.html کپی کنید.
5. فیلدهای تاریخ: class="jdate" data-jdate data-validate="date"
6. اعتبارسنجی: data-validate="required number" یا date / time / code / phone
7. راه‌اندازی:
   ModuleKit.bootShell({ onSave: function(){ /* ذخیره داده ماژول */ }, suiteUrl: "suite.html" });

## منوی استاندارد
داشبورد | ثبت | فهرست | گزارش‌ها | امکانات | تنظیمات | خروج
