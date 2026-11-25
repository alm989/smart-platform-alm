# سامانه هوشمند یکپارچه مالی و اداری

## فایل‌های این بسته

| فایل | توضیح |
|------|--------|
| `index.html` | درگاه اصلی (Suite) با نام جدید و طبقه‌بندی ماژول‌ها |
| `manifest-suite.json` | مانیفست PWA |
| `module-kit.css` | استایل مشترک — **منوی کناری سمت راست** |
| `module-kit.js` | تقویم شمسی، ناوبری، میکروفون، ساعت |
| `accounting.html` | نمونه کامل حسابداری (منو راست + تقویم + پرینت) |

## اعمال روی همه ماژول‌ها

در هر فایل ماژول (مثلاً `bank.html`, `sales.html`, ...):

### ۱) لینک کیت
```html
<link rel="stylesheet" href="module-kit.css">
<script src="module-kit.js"></script>
```

### ۲) ساختار بدنه (منو راست)
```html
<div class="body-row">
  <main class="main"> ... پنل‌ها ... </main>
  <aside class="side"> ... منوی درختی ... </aside>
</div>
```
توجه: `body-row` با `direction:ltr` است تا `side` بصری **سمت راست** قرار بگیرد؛ داخل main و side با `direction:rtl` فارسی می‌مانند.

### ۳) منوی امکانات — تقویم شمسی
در منوی بالا و کناری، زیر **امکانات** این دکمه را اضافه کنید:
```html
<button type="button" data-panel="p-cal">تقویم شمسی</button>
```
و پنل:
```html
<div class="panel" id="p-cal">
  <div class="card has-exit">
    <button type="button" class="btn-form-exit" data-panel="p-dash">خروج</button>
    <h2>تقویم شمسی</h2>
    <div id="fullCal"></div>
  </div>
</div>
```

### ۴) لیبل‌های استاندارد منو (بازیابی منوهای حذف‌شده)
هر ماژول باید این ۶ گروه را داشته باشد:
- داشبورد
- ثبت (فرم‌های ورود داده)
- فهرست
- گزارش
- امکانات (تقویم شمسی، یادداشت، یادآوری، کارتابل، آفیس)
- تنظیمات (کاربران Admin، پشتیبان، بازیابی)

### ۵) هدر
- سمت راست: لوگو + نام ماژول
- وسط: منوی آبشاری (ماوس روی آیتم باز شود)
- میکروفون کنار داشبورد
- خروج کنار تنظیمات
- سمت چپ: تاریخ شمسی / میلادی / ساعت / کاربر فعال (زیر هم)

## نام‌گذاری فایل‌ها در گیت‌هاب
- `index.html` = Suite (سامانه)
- `secretary.html` = منشی هوشمند (قبلاً index نبود)
- مسیر اشتباه `multicompany` / `management` / `tax-budget` اصلاح شده در index

## آپلود
1. `index.html` را جایگزین کنید
2. `module-kit.css` و `module-kit.js` و `manifest-suite.json` را آپلود کنید
3. `accounting.html` را جایگزین کنید
4. در بقیه ماژول‌ها ساختار `body-row` و آیتم تقویم را اعمال کنید
5. Ctrl+F5
