# چک‌لیست عملیاتی — سامانه یکپارچه هوشمند

مسیر سرور: `D:\smart-platform-alm\server`  
آدرس: `http://127.0.0.1:8787/suite.html`

---

## هر روز / هر بار استفاده

| # | کار | دستور / اقدام | OK |
|---|-----|----------------|-----|
| 1 | روشن کردن سرور | `cd D:\smart-platform-alm\server` سپس `node server.js` یا `START.bat` | ☐ |
| 2 | سلامت | `Invoke-RestMethod http://127.0.0.1:8787/api/health` → `ok: True` | ☐ |
| 3 | باز کردن سوئیت | مرورگر: `http://127.0.0.1:8787/suite.html` | ☐ |
| 4 | ورود | admin + رمز + پین (یا نقش مناسب) | ☐ |
| 5 | خاموش کردن | در پنجره سرور: `Ctrl+C` | ☐ |

---

## پشتیبان

| # | کار | اقدام | OK |
|---|-----|--------|-----|
| 1 | پشتیبان از سوئیت | چرخ‌دنده → پشتیبان سرور (فقط admin/ceo) | ☐ |
| 2 | آینه درایو دوم | `node scripts\mirror-backups.js` یا `BACKUP-MIRROR.bat` | ☐ |
| 3 | مسیر اصلی | `D:\smart-platform-alm\server\backups` | ☐ |
| 4 | مسیر دوم | طبق `config.json` → `backupExtraDir` (مثلاً `D:\smart-platform-backups`) | ☐ |

پشتیبان روزانه سرور حدود ساعت تنظیم‌شده در `dailyBackupHour` (پیش‌فرض ۲ بامداد) هم اجرا می‌شود **اگر سرور روشن باشد**.

---

## کاربران و نقش‌ها

| نقش | دسترسی خلاصه |
|-----|----------------|
| admin / ceo | همه چیز + چرخ‌دنده + کاربران + پشتیبان |
| manager | کار روزمره + پشتیبان/بازیابی |
| user | کار روزمره؛ بدون کاربران و بازیابی اضطراری |
| guest | فقط مشاهده (ثبت قفل) |

مدیریت کاربران/رمز/پین:

```text
cd D:\smart-platform-alm\server
node scripts\secure-setup.js --list
node scripts\secure-setup.js --admin-pass "..." --pin "...."
node scripts\secure-setup.js --add-user "name:pass:نام:role"
```

---

## عیب‌یابی سریع

| مشکل | کار |
|------|-----|
| پورت اشغال | `netstat -ano \| findstr :8787` سپس `taskkill /PID ... /F` |
| 401 مکرر | یک‌بار `SmartCore.api.login("admin","رمز","پین")` در Console |
| ماژول باز نمی‌شود | `COPY-MODULES.bat` یا کپی HTML به `public\` |
| سرور از پوشه اشتباه | حتماً `cd D:\smart-platform-alm\server` |

---

## امنیت حداقلی (هفته‌ای یک‌بار)

| # | کار | OK |
|---|-----|-----|
| 1 | رمز admin قوی است (نه admin) | ☐ |
| 2 | پین غیر از 1234 | ☐ |
| 3 | `config.host` = `127.0.0.1` | ☐ |
| 4 | پوشه پشتیبان دوم در دسترس است | ☐ |
