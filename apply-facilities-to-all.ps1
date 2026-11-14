# اعمال امکانات یکپارچه روی همه ماژول‌های HTML
# اجرا: در پوشه ریپو PowerShell:  .\apply-facilities-to-all.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

$map = @{
  "accounting.html" = @{ id = "accounting"; title = "حسابداری" }
  "archive.html" = @{ id = "archive"; title = "بایگانی" }
  "assistant.html" = @{ id = "assistant"; title = "دستیار" }
  "audit.html" = @{ id = "audit"; title = "حسابرسی" }
  "bank.html" = @{ id = "bank"; title = "بانک" }
  "budget.html" = @{ id = "budget"; title = "بودجه" }
  "cashbox.html" = @{ id = "cashbox"; title = "صندوق" }
  "ceo.html" = @{ id = "ceo"; title = "مدیرعامل" }
  "chat.html" = @{ id = "chat"; title = "چت" }
  "contracts.html" = @{ id = "contracts"; title = "قراردادها" }
  "correspondence.html" = @{ id = "correspondence"; title = "مکاتبات" }
  "customers.html" = @{ id = "customers"; title = "مشتریان" }
  "file-hub.html" = @{ id = "filehub"; title = "هاب فایل" }
  "fixedassets.html" = @{ id = "fixedassets"; title = "دارایی ثابت" }
  "fleet.html" = @{ id = "fleet"; title = "ناوگان" }
  "lawyer.html" = @{ id = "lawyer"; title = "وکیل" }
  "manager.html" = @{ id = "manager"; title = "مدیریت" }
  "meeting.html" = @{ id = "meeting"; title = "متینگ" }
  "multicompany.html" = @{ id = "multicompany"; title = "چندشرکتی" }
  "payroll.html" = @{ id = "payroll"; title = "حقوق" }
  "personnel.html" = @{ id = "personnel"; title = "پرسنلی" }
  "pettycash.html" = @{ id = "pettycash"; title = "تنخواه" }
  "pr-media.html" = @{ id = "pr"; title = "روابط عمومی" }
  "production.html" = @{ id = "production"; title = "تولید" }
  "projects.html" = @{ id = "projects"; title = "پروژه" }
  "purchase.html" = @{ id = "purchase"; title = "خرید" }
  "sales.html" = @{ id = "sales"; title = "فروش" }
  "secretariat.html" = @{ id = "secretariat"; title = "دبیرخانه" }
  "secretary.html" = @{ id = "secretary"; title = "منشی" }
  "sysadmin.html" = @{ id = "sysadmin"; title = "مدیر سیستم" }
  "tax.html" = @{ id = "tax"; title = "مالیات" }
  "warehouse.html" = @{ id = "warehouse"; title = "انبار" }
  "change-engine.html" = @{ id = "change-engine"; title = "موتور تغییر" }
  "control-center.html" = @{ id = "control-center"; title = "مرکز کنترل" }
}

$n = 0
foreach ($file in $map.Keys) {
  $path = Join-Path $root $file
  if (-not (Test-Path $path)) {
    Write-Host "skip missing: $file"
    continue
  }
  $text = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
  $orig = $text

  # CSP: allow same-origin scripts
  $text = $text -replace "script-src 'unsafe-inline'", "script-src 'self' 'unsafe-inline'"

  $id = $map[$file].id
  $title = $map[$file].title
  $inject = "<script src=`"core.js`"></script>`r`n<script src=`"suite-facilities.js`" data-module=`"$id`" data-title=`"$title`"></script>`r`n<script src=`"facilities-autoload.js`"></script>"

  if ($text -match 'suite-facilities\.js') {
    Write-Host "already wired: $file"
  } else {
    $text = $text -replace '<script src="core\.js"></script>', $inject
  }

  if ($text -ne $orig) {
    [System.IO.File]::WriteAllText($path, $text, [System.Text.UTF8Encoding]::new($false))
    $n++
    Write-Host "patched: $file -> $id"
  }
}

Write-Host "Done. Patched $n files."
Write-Host "Commit and push when ready."
