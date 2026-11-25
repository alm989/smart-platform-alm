# سخت‌سازی امنیتی — سرور محلی

## ۱) رمز و پین واقعی

هرگز برای کار واقعی از `admin/admin` و پین `1234` استفاده نکنید.

```powershell
cd D:\smart-platform-alm\server

# رمز قوی + پین جدید (۴ تا ۸ رقم)
node scripts\secure-setup.js --admin-pass "یک-رمز-قوی-خودتان" --pin "7482" --list

# کاربر عادی
node scripts\secure-setup.js --add-user "user:رمزقوی:کاربر عادی:user" --list
```

بعد از تغییر:

```javascript
// در Console مرورگر
sessionStorage.clear();
SmartCore.api.login("admin", "رمز-جدید", "7482").then(() => location.reload());
```

---

## ۲) فقط localhost

در `config.json`:

```json
"host": "127.0.0.1"
```

نباید `0.0.0.0` باشد مگر عمداً بخواهید از شبکه داخلی در دسترس باشد.

---

## ۳) مسیرها

| مسیر | نقش |
|------|-----|
| `D:\smart-platform-alm\server` | برنامه |
| `server\data` | داده زنده — بکاپ بگیرید |
| `server\backups` | پشتیبان محلی |
| `backupExtraDir` | کپی دوم (فلش/درایو دیگر) |
| `server\public` | فایل‌های HTML/JS سرو شده |

- `data\users.json` را در گیت یا اشتراک عمومی نگذارید.  
- پوشه `backups` و `data` در `.gitignore` بمانند.

---

## ۴) مرورگر

- فقط از `http://127.0.0.1:8787` استفاده کنید (نه IP شبکه مگر ضروری).  
- بعد از کار روی سیستم مشترک: خروج از سوئیت + بستن تب.  
- توکن در `sessionStorage` است؛ با بستن مرورگر پاک می‌شود.

---

## ۵) پشتیبان

- سرور روشن → پشتیبان خودکار حدود ساعت ۲.  
- Task Scheduler → آینه ساعت ۳ به `backupExtraDir`.  
- ماهانه یک‌بار `dir` روی هر دو مسیر پشتیبان را چک کنید.

---

## ۶) چک سریع امنیت

```powershell
cd D:\smart-platform-alm\server
node scripts\secure-setup.js --list
# همه pass باید scrypt باشند

Get-Content config.json | Select-String host
# host : 127.0.0.1

Invoke-RestMethod http://127.0.0.1:8787/api/health
```
