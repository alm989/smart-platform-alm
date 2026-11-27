# Smart Platform ALM — Stable Release 1.6.1

**تاریخ قفل:** 2026-11-27  
**شاخه:** `main`  
**هدف:** همسان‌سازی GitHub ↔ پوشه `D:\smart-platform-alm` ↔ سرور محلی `127.0.0.1:8787` بدون خطای شناخته‌شده.

---

## شامل و تأییدشده

| حوزه | وضعیت |
|------|--------|
| JWT + scrypt + RBAC ماژولی | پایدار |
| مخفی‌سازی credential در کنسول سرور | پایدار |
| Effects: cashbox/bank/tankhah/sales/purchase/payroll/warehouse/tax/budget | پایدار |
| حسابداری: اثر → موقت → TEMP → دائم | پایدار |
| online-first effects + صف آفلاین | پایدار |
| backup/restore + audit | پایدار |
| گزارش مدیریتی (عناوین فارسی، بدون flicker اصلی) | پایدار |
| نوار پایین سوئیت (همگام / نقش / آفلاین / ⚙️) | پایدار |
| CSV کنار عنوان | اختیاری — بعداً |

**نسخه health مورد انتظار:** `1.6.0` یا برچسب اسکریپت‌های اعمال‌شده محلی.

---

## همسان‌سازی محلی (یک‌بار)

در **PowerShell**:

```powershell
cd D:\smart-platform-alm
git pull origin main
powershell -ExecutionPolicy Bypass -File .\server\scripts\stabilize-local-1.6.1.ps1
```

سپس سرور را ریستارت و Ctrl+F5 روی سوئیت.

---

## تگ Git (روی PC شما)

```powershell
cd D:\smart-platform-alm
git tag -a v1.6.1 -m "Stable ALM 1.6.1"
git push origin v1.6.1
```

## Zip پشتیبان

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmm'
Compress-Archive -Path 'D:\smart-platform-alm\*' -DestinationPath "D:\smart-platform-alm-v1.6.1-$stamp.zip" -Force
```

---

## چک سلامت بعد از همگام

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/health
git status
git log -1 --oneline
```

مرورگر: ورود admin، سوئیت بدون خطای قرمز بحرانی در Console (403های جزئی ماژول‌های غیرمجاز نقش قابل چشم‌پوشی‌اند).

---

*نسخه پایدار برای توقف توسعه UI جزئی و ادامه بعدی.*
