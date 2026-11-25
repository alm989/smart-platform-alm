# سرور محلی سامانه یکپارچه هوشمند

## پیش‌نیاز
- [Node.js LTS](https://nodejs.org) (نسخه ۱۸ یا بالاتر)
- پوشه ماژول‌ها در `D:\smart-platform-alm`

## نصب سریع روی ویندوز

### ۱) دریافت پوشه server
از گیت‌هاب پوشه `server` را دانلود کنید و بگذارید:
```
D:\smart-platform-alm\server\
```

### ۲) کپی ماژول‌ها داخل public
دوبار کلیک:
```
COPY-MODULES.bat
```
یا در PowerShell:
```powershell
cd D:\smart-platform-alm\server
.\COPY-MODULES.bat
```

### ۳) اجرا
دوبار کلیک:
```
START.bat
```

مرورگر:
```
http://127.0.0.1:8787/suite.html
```

ورود API / آینده:
- کاربر: `admin`
- رمز: `admin`
- پین: `1234`

## API موجود
| مسیر | توضیح |
|------|--------|
| GET `/api/health` | سلامت سرور |
| POST `/api/auth/login` | `{user,pass,pin}` → token |
| GET `/api/me` | کاربر جاری |
| GET `/api/users` | فهرست کاربران |
| GET `/api/data/:moduleId` | خواندن داده ماژول |
| PUT `/api/data/:moduleId` | ذخیره داده ماژول |
| GET/POST `/api/cartable` | کارتابل |
| POST `/api/backup` | پشتیبان (فقط admin) |

## ساختار
```
server/
  server.js
  config.json
  START.bat
  COPY-MODULES.bat
  public/     ← ماژول‌های HTML/JS
  data/       ← users + modules + cartable
  backups/
```

## شبکه داخلی
در `config.json` مقدار `host` روی `0.0.0.0` است.
از سیستم دیگر در همان شبکه:
```
http://IP-کامپیوتر-شما:8787/suite.html
```

## نکات
- وابستگی npm ندارد؛ فقط Node کافی است.
- داده ماژول‌ها فعلاً در مرورگر (localStorage) هم کار می‌کند؛ API برای فاز بعدی همگام‌سازی آماده است.
- پورت پیش‌فرض: **8787** (در `config.json` قابل تغییر).
