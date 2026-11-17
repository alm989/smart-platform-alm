# معماری و امنیت API — وضعیت و هدف JWT

## ۱) معماری فعلی

```
[مرورگر / ماژول HTML]
    │  HTTP 127.0.0.1:8787
    ▼
[server.js]
    ├─ static: public/*.html, core.js, bridge, …
    ├─ /api/auth/login  → token + نقش
    ├─ /api/me          → هویت جاری
    ├─ /api/data/:id    → خواندن/نوشتن JSON ماژول
    ├─ /api/cartable    → کارتابل
    └─ /api/backup      → پشتیبان
         │
         ▼
    [data/] users.json · modules/*.json · cartable.json
    [backups/] + backupExtraDir
```

| لایه | فناوری |
|------|--------|
| رمز عبور | scrypt |
| پین دوم | `pin2` سراسری در users.json |
| نشست قبل از JWT | توکن تصادفی **فقط در RAM سرور** |
| RBAC | نقش در نشست + `ROLE_PERMS` روی endpoint |
| UI RBAC | server-bridge مخفی‌کردن پنل‌ها |

---

## ۲) نقاط قوت

- bind روی `127.0.0.1` (عدم افشای شبکه)
- scrypt برای رمز
- rate limit ورود
- مجوز جدا برای read / write / cartable / backup
- قفل نسخه (baseVersion) در صورت فعال بودن هوک
- بدون dependency خارجی npm

---

## ۳) نقاط ضعف (قبل از JWT)

| ریسک | توضیح |
|------|--------|
| توکن فقط RAM | با ری‌استارت سرور همه نشست‌ها باطل می‌شوند (خوب برای امنیت، بد برای UX) |
| توکن غیرخودتوصیف | نقش داخل Map سرور است؛ مقیاس‌پذیری و چندprocess سخت |
| CORS `*` | برای localhost قابل قبول؛ برای شبکه خطرناک |
| پین سراسری | یک پین برای همه کاربران |
| logout واقعی محدود | تا انقضای RAM توکن معتبر می‌ماند |

---

## ۴) هدف JWT + RBAC

- توکن **HS256** امضاشده با `jwtSecret`
- Claimها: `sub` (user), `name`, `role`, `perms`, `iat`, `exp`, `jti`
- سرور فقط امضا و انقضا را چک می‌کند (نیازی به Map برای اعتبارسنجی عادی نیست)
- RBAC از `role` / `perms` داخل JWT خوانده می‌شود
- اختیاری: لیست `jti` باطل‌شده برای logout فوری

---

## ۵) ماتریس دسترسی (ثابت)

| نقش | read | write | cartable | backup | users |
|-----|------|-------|----------|--------|-------|
| admin / ceo | ✓ | ✓ | ✓ | ✓ | ✓ |
| manager | ✓ | ✓ | ✓ | ✓ | ✓* |
| user | ✓ | ✓ | ✓ | — | — |
| guest | ✓ | — | — | — | — |

\* در API فعلی manager به لیست کاربران برای کارتابل دسترسی دارد.
