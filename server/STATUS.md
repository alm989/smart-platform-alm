# وضعیت سامانه — Smart Suite Local

به‌روزرسانی: 2026-11-18

## اجرا

| مورد | مقدار |
|------|--------|
| مسیر | `D:\smart-platform-alm\server` |
| آدرس | `http://127.0.0.1:8787/suite.html` |
| نسخه API | 1.5.x (JWT + modules) |
| احراز هویت | scrypt + پین + JWT HS256 |
| شبکه | فقط `127.0.0.1` |

## نقش‌ها و ماژول

| نقش | لانچر |
|-----|--------|
| admin / ceo | همه ماژول‌ها + چرخ‌دنده |
| manager | مالی و عملیاتی (بدون sysadmin) |
| user | حدود ۱۵ ماژول روزمره |
| guest | حداقل (خواندن) |

فیلتر: API (`/api/data/:id` → 403) + کاشی‌های `suite.html`

## اجزای کلیدی

| فایل | نقش |
|------|-----|
| `server.js` | API + استاتیک |
| `lib/jwt.js` | JWT HS256 |
| `lib/rbac-modules.js` | لیست ماژول هر نقش |
| `public/server-bridge.js` | همگام‌سازی + RBAC UI |
| `public/suite-jwt-gate.js` | ورود/خروج JWT سوئیت |
| `suite-facilities.js` | یادداشت / یادآوری / کارتابل |
| `cartable-api.js` | کارتابل API-اول |

## عملیات

```text
cd D:\smart-platform-alm
powershell -ExecutionPolicy Bypass -File .\Sync-From-GitHub.ps1

cd server
node server.js
```

پشتیبان: `backups\` + `backupExtraDir`  
کاربران: `node scripts\secure-setup.js --list`

## تست سریع

1. `/api/health` → ok + auth scrypt+jwt  
2. ورود admin → همه کاشی‌ها + نوار نقش راست  
3. ورود user → حدود ۱۵ ماژول  
4. `sysadmin` با user → 403 یا برگشت به سوئیت  
5. خروج سرور → فرم JWT دوباره

## امنیتی

- رمز پیش‌فرض را عوض کنید (`secure-setup.js`)  
- `config.json` → `host: 127.0.0.1` و `jwtSecret` تصادفی  
- `data\` و `backups\` را در گیت commit نکنید  
