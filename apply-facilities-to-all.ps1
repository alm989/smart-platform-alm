# Wire suite-facilities into all module HTML files (ASCII-only, encoding-safe)
# Run: powershell -ExecutionPolicy Bypass -File .\apply-facilities-to-all.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

# titles optional: SuiteFacilities / SmartCore can resolve Persian titles at runtime
$map = [ordered]@{
  "accounting.html"      = "accounting"
  "archive.html"         = "archive"
  "assistant.html"       = "assistant"
  "audit.html"           = "audit"
  "bank.html"            = "bank"
  "budget.html"          = "budget"
  "cashbox.html"         = "cashbox"
  "ceo.html"             = "ceo"
  "chat.html"            = "chat"
  "contracts.html"       = "contracts"
  "correspondence.html"  = "correspondence"
  "customers.html"       = "customers"
  "file-hub.html"        = "filehub"
  "fixedassets.html"     = "fixedassets"
  "fleet.html"           = "fleet"
  "lawyer.html"          = "lawyer"
  "manager.html"         = "manager"
  "meeting.html"         = "meeting"
  "multicompany.html"    = "multicompany"
  "payroll.html"         = "payroll"
  "personnel.html"       = "personnel"
  "pettycash.html"       = "pettycash"
  "pr-media.html"        = "pr"
  "production.html"      = "production"
  "projects.html"        = "projects"
  "purchase.html"        = "purchase"
  "sales.html"           = "sales"
  "secretariat.html"     = "secretariat"
  "secretary.html"       = "secretary"
  "sysadmin.html"        = "sysadmin"
  "tax.html"             = "tax"
  "warehouse.html"       = "warehouse"
  "change-engine.html"   = "change-engine"
  "control-center.html"  = "control-center"
}

$n = 0
foreach ($file in $map.Keys) {
  $path = Join-Path $root $file
  if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "skip missing: $file"
    continue
  }

  $text = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
  $orig = $text

  # CSP: allow same-origin external scripts
  $text = $text.Replace("script-src 'unsafe-inline'", "script-src 'self' 'unsafe-inline'")

  $id = [string]$map[$file]

  if ($text -match 'suite-facilities\.js') {
    Write-Host "already wired: $file"
  }
  else {
    $inject = "<script src=`"core.js`"></script>`r`n<script src=`"suite-facilities.js`" data-module=`"$id`" data-title=`"$id`"></script>`r`n<script src=`"facilities-autoload.js`"></script>"
    $text = $text.Replace('<script src="core.js"></script>', $inject)
    if ($text -eq $orig -or ($text -notmatch 'suite-facilities\.js')) {
      Write-Host "WARN: core.js tag not found or inject failed: $file"
      continue
    }
  }

  if ($text -ne $orig) {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($path, $text, $utf8NoBom)
    $n++
    Write-Host "patched: $file -> $id"
  }
}

Write-Host "Done. Patched $n files."
