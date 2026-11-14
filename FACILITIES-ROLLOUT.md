# امکانات یکپارچه v2 (تأیید شده)

## فایل اصلی
- `suite-facilities.js` — یادداشت + یادآوری (محلی) + کارتابل سراسری
- `facilities-pilot-standalone.html` — نمونه تأییدشده

## قابلیت‌ها
- تقویم شمسی انتخابی
- شناسه یکتا `sf_...`
- کارتابل مشترک `suite_cartable_v1` بین همه ماژول‌ها
- ارسال به **ماژول + کاربر** (یا همه کاربران ماژول)
- بدون تغییر ساختار UI پنل‌ها

## اتصال به هر ماژول (حداقل تغییر)

1) در `<head>` مقدار CSP را به این شکل اصلاح کنید (فقط افزودن `'self'`):

```html
script-src 'self' 'unsafe-inline'
```

2) بلافاصله بعد از `core.js`:

```html
<script src="suite-facilities.js" data-module="bank" data-title="بانک"></script>
```

`data-module` باید با id ماژول در `core.js` یکی باشد.

### نمونه idها
| فایل | data-module | data-title |
|------|-------------|------------|
| bank.html | bank | بانک |
| cashbox.html | cashbox | صندوق |
| accounting.html | accounting | حسابداری |
| sales.html | sales | فروش |
| warehouse.html | warehouse | انبار |
| payroll.html | payroll | حقوق |
| personnel.html | personnel | پرسنلی |
| secretariat.html | secretariat | دبیرخانه |
| purchase.html | purchase | خرید |
| customers.html | customers | مشتریان |

## نکات
- یادداشت/یادآوری هر ماژول کلید جدا دارد: `smart_mod_notes_{id}` / `smart_mod_rem_{id}`
- کارتابل همه به هم وصل‌اند؛ دریافت بر اساس ماژول جاری و کاربر نشست فیلتر می‌شود
- ساختار منو/پنل موجود دست نخورده می‌ماند؛ کیت فقط داخل `#p-notes` / `#p-rems` / `#p-cartable` mount می‌شود
