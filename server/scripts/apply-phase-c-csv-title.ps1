# Phase C: CSV beside report title + cache bust
# powershell -ExecutionPolicy Bypass -File .\server\scripts\apply-phase-c-csv-title.ps1
$ErrorActionPreference = 'Stop'
$root = 'D:\smart-platform-alm'
if (-not (Test-Path (Join-Path $root 'server\public\suite-report-panel.js'))) {
  $root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}
$utf8 = New-Object System.Text.UTF8Encoding $false
$js = Join-Path $root 'server\public\suite-report-panel.js'
if (-not (Test-Path $js)) { throw "missing $js — git pull first" }

Copy-Item -LiteralPath $js -Destination (Join-Path $root 'suite-report-panel.js') -Force
Copy-Item -LiteralPath $js -Destination (Join-Path $root 'server\public\suite-report-panel.js') -Force
Write-Host 'JS mirrored root + public'

function Patch-Html([string]$path) {
  if (-not (Test-Path $path)) { Write-Host "skip $path"; return }
  $t = [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)
  $t = [regex]::Replace($t, 'suite-report-panel\.js(\?v=[^"'']*)?', 'suite-report-panel.js?v=20261127d')
  if ($t -notmatch 'suite-report-panel\.js') {
    if ($t -match '</body>') {
      $t = $t.Replace('</body>', "<script src=`"suite-report-panel.js?v=20261127d`"></script>`r`n</body>")
    }
  }
  # strip old csv-beside inline if any
  $t = [regex]::Replace($t, '(?s)<script>\s*/\* __sfCsvBesideTitle[\s\S]*?</script>\s*', '')
  [IO.File]::WriteAllText($path, $t, $utf8)
  Write-Host "OK $path"
}

Patch-Html (Join-Path $root 'suite.html')
Patch-Html (Join-Path $root 'server\public\suite.html')

$bat = Join-Path $root 'server\COPY-MODULES.bat'
if (Test-Path $bat) {
  Push-Location (Join-Path $root 'server')
  cmd /c "COPY-MODULES.bat < nul"
  Pop-Location
  Copy-Item -LiteralPath $js -Destination (Join-Path $root 'server\public\suite-report-panel.js') -Force
  Copy-Item -LiteralPath $js -Destination (Join-Path $root 'suite-report-panel.js') -Force
}

Write-Host ''
Write-Host 'Phase C applied. Ctrl+F5 on suite.html'
Write-Host 'Expect RIGHT: [گزارش مدیریتی] [خروجی CSV]   LEFT: [بروزرسانی]'
