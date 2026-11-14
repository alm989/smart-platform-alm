# کارتابل مشترک (SuiteCartable)

## اصل طراحی
- **یادداشت** و **یادآوری**: مختص همان ماژول (`smart_mod_notes_*` / `smart_mod_rem_*`)
- **کارتابل**: سراسری بین همه ماژول‌ها (`suite_cartable_v1` + IndexedDB)

## فایل‌ها
| فایل | نقش |
|------|-----|
| `suite-cartable.js` | هسته مشترک ارسال/دریافت/دانلود/بایگانی |
| `cartable-demo.html` | تست امن بدون دست زدن به ماژول‌ها |

## تست سریع
1. `cartable-demo.html` را باز کنید
2. با نقش **بانک** برای **حسابداری** فایل/پیام بفرستید
3. نقش را به **حسابداری** عوض کنید → باید در صندوق ورودی باشد

## اتصال کم‌تهاجمی به یک ماژول (بعد از تأیید تست)
داخل همان ماژول، بعد از `core.js`:

```html
<script src="suite-cartable.js"></script>
<script>
  // ترجیحاً بعد از تعریف MOD
  if (window.SuiteCartable) {
    SuiteCartable.init({ moduleId: 'bank', moduleTitle: 'بانک' });
  }
</script>
```

یا:

```html
<script src="suite-cartable.js" data-module="bank" data-title="بانک"></script>
```

اگر `#p-cartable` وجود داشته باشد، UI داخل همان پنل mount می‌شود و منطق قدیمی لیست ساده را به‌صورت افزایشی پوشش می‌دهد.

## نکات ایمنی
- ماژول‌های تولیدی هنوز **تغییر نکرده‌اند** تا ریسک خرابی صفر بماند
- پس از تأیید `cartable-demo.html`، اتصال تدریجی از بانک/صندوق/حسابداری شروع شود
