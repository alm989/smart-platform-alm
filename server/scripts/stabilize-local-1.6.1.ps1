# Stabilize local tree to match origin/main — PowerShell only
# powershell -ExecutionPolicy Bypass -File .\server\scripts\stabilize-local-1.6.1.ps1
$ErrorActionPreference = 'Stop'
$root = 'D:\smart-platform-alm'
if (-not (Test-Path (Join-Path $root '.git'))) {
  if (Test-Path (Join-Path $PSScriptRoot '..\..\.git')) {
    $root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
  }
}
Set-Location $root
Write-Host "ROOT = $root"

Write-Host "`n=== 1) Git sync ==="
git fetch origin
git status
git pull origin main
$head = (git log -1 --oneline)
Write-Host "HEAD: $head"

Write-Host "`n=== 2) Key files present ==="
$need = @(
  'server\server.js',
  'server\public\suite.html',
  'server\public\suite-report-panel.js',
  'server\public\server-bridge.js',
  'server\lib\rbac-modules.js',
  'suite.html'
)
$missing = @()
foreach ($f in $need) {
  $p = Join-Path $root $f
  if (Test-Path $p) {
    $i = Get-Item $p
    Write-Host ("  OK {0}  ({1} bytes, {2})" -f $f, $i.Length, $i.LastWriteTime)
  } else {
    Write-Host "  MISSING $f" -ForegroundColor Red
    $missing += $f
  }
}
if ($missing.Count) { Write-Host "WARN: missing files — pull may have failed" -ForegroundColor Yellow }

Write-Host "`n=== 3) Mirror report panel JS (root + public) ==="
$js = Join-Path $root 'server\public\suite-report-panel.js'
if (Test-Path $js) {
  Copy-Item -LiteralPath $js -Destination (Join-Path $root 'suite-report-panel.js') -Force
  Write-Host '  suite-report-panel.js -> root'
}

Write-Host "`n=== 4) COPY-MODULES (HTML -> public) ==="
$bat = Join-Path $root 'server\COPY-MODULES.bat'
if (Test-Path $bat) {
  Push-Location (Join-Path $root 'server')
  cmd /c "COPY-MODULES.bat < nul"
  Pop-Location
  # re-assert JS after bat (bat may only copy html)
  if (Test-Path $js) {
    Copy-Item -LiteralPath $js -Destination (Join-Path $root 'server\public\suite-report-panel.js') -Force
    Copy-Item -LiteralPath $js -Destination (Join-Path $root 'suite-report-panel.js') -Force
  }
  Write-Host '  COPY-MODULES done'
} else {
  Write-Host '  COPY-MODULES.bat missing' -ForegroundColor Yellow
}

Write-Host "`n=== 5) Syntax check server.js ==="
Push-Location (Join-Path $root 'server')
node --check server.js
if ($LASTEXITCODE -ne 0) { throw "server.js syntax error" }
Write-Host '  server.js syntax OK'
Pop-Location

Write-Host "`n=== 6) Port / health (if server running) ==="
try {
  $h = Invoke-RestMethod -Uri 'http://127.0.0.1:8787/api/health' -TimeoutSec 3
  Write-Host ("  health ok={0} version={1}" -f $h.ok, $h.version)
} catch {
  Write-Host '  server not running — start with: cd server; node server.js'
}

Write-Host "`n=== 7) Working tree ==="
git status --short
if (-not (git status --porcelain)) {
  Write-Host '  clean — matches last commit' -ForegroundColor Green
} else {
  Write-Host '  local modifications present (see above)' -ForegroundColor Yellow
}

Write-Host "`n=== STABLE 1.6.1 local sync finished ==="
Write-Host 'Next: restart node if needed, Ctrl+F5 on suite.html'
Write-Host 'Optional tag: git tag -a v1.6.1 -m "Stable 1.6.1"; git push origin v1.6.1'
