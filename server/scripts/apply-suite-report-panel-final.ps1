# Remove competing report scripts; load single suite-report-panel.js
# powershell -ExecutionPolicy Bypass -File .\server\scripts\apply-suite-report-panel-final.ps1
$ErrorActionPreference = 'Stop'
$root = 'D:\smart-platform-alm'
if (-not (Test-Path (Join-Path $root 'suite.html'))) {
  $root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
}
$utf8 = New-Object System.Text.UTF8Encoding $false

# Ensure JS exists in root public path too
$srcJs = Join-Path $root 'server\public\suite-report-panel.js'
$dstJs = Join-Path $root 'suite-report-panel.js'
if (Test-Path $srcJs) {
  Copy-Item $srcJs $dstJs -Force
  Write-Host 'copied suite-report-panel.js to root'
}

function Strip-And-Inject([string]$path) {
  if (-not (Test-Path $path)) { Write-Host "skip $path"; return }
  $t = [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)

  # Remove ALL previous report-related inline scripts
  $patterns = @(
    '(?s)<script>\s*/\* __sfReportCard2[\s\S]*?</script>\s*',
    '(?s)<script>\s*/\* __sfReportCompact[\s\S]*?</script>\s*',
    '(?s)<script>\s*/\* __sfReportFaLabels[\s\S]*?</script>\s*',
    '(?s)<script>\s*/\* __sfReportFaFix2[\s\S]*?</script>\s*',
    '(?s)<script>\s*/\* __sfReportFromChar[\s\S]*?</script>\s*',
    '(?s)<script>\s*/\* __sfReportCardFixed[\s\S]*?</script>\s*',
    '(?s)<script[^>]*src=["''][^"'']*suite-report-panel\.js["''][^>]*>\s*</script>\s*'
  )
  foreach ($p in $patterns) {
    $t = [regex]::Replace($t, $p, '')
  }

  # Also remove script blocks that only mention sfReportCard creation with PriorityA if marker lost
  $t = [regex]::Replace($t, '(?s)<script>\s*/\* __sfReport[\s\S]*?</script>\s*', '')

  if ($t -notmatch 'charset') {
    $t = $t.Replace('<head>', "<head>`r`n<meta charset=`"utf-8`">")
  }

  $tag = '<script src="suite-report-panel.js"></script>'
  if ($t -match '</body>') {
    $t = $t.Replace('</body>', $tag + "`r`n</body>")
  } else {
    $t = $t + $tag
  }

  [IO.File]::WriteAllText($path, $t, $utf8)
  Write-Host "OK $path"
}

Strip-And-Inject (Join-Path $root 'suite.html')
Strip-And-Inject (Join-Path $root 'server\public\suite.html')

# copy js into public (already there) and root
if (Test-Path $srcJs) {
  Copy-Item $srcJs (Join-Path $root 'server\public\suite-report-panel.js') -Force
}

Write-Host 'Done. Restart not required. COPY-MODULES + Ctrl+F5'
Write-Host 'Verify: view-source should have ONE suite-report-panel.js and NO __sfReportCard2'
