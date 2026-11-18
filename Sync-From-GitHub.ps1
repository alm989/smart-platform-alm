# Sync-From-GitHub.ps1 — GitHub to D:\smart-platform-alm
# powershell -ExecutionPolicy Bypass -File .\Sync-From-GitHub.ps1
# Does NOT touch: server\data  server\backups

$ErrorActionPreference = "Continue"
$Root = "D:\smart-platform-alm"
$Base = "https://raw.githubusercontent.com/alm989/smart-platform-alm/main"
$Server = Join-Path $Root "server"
$Public = Join-Path $Server "public"

function EnsureDir($p) {
  if (-not (Test-Path -LiteralPath $p)) {
    New-Item -ItemType Directory -Path $p -Force | Out-Null
  }
}

function Dl($relPath, $destPath) {
  $url = $Base + "/" + ($relPath -replace "\\", "/")
  $parent = Split-Path -Parent $destPath
  EnsureDir $parent
  try {
    Invoke-WebRequest -Uri $url -OutFile $destPath -UseBasicParsing -TimeoutSec 90
    Write-Host ("  OK  " + $relPath)
    return $true
  } catch {
    Write-Host ("  SKIP " + $relPath)
    return $false
  }
}

Write-Host "========================================"
Write-Host " Smart Suite - Sync from GitHub"
Write-Host (" Target: " + $Root)
Write-Host "========================================"

EnsureDir $Root
EnsureDir $Server
EnsureDir $Public
EnsureDir (Join-Path $Server "scripts")
EnsureDir (Join-Path $Server "lib")
EnsureDir (Join-Path $Server "docs")
EnsureDir (Join-Path $Server "data")
EnsureDir (Join-Path $Server "data\modules")
EnsureDir (Join-Path $Server "backups")

Write-Host ""
Write-Host "[1] Client core"
$client = @("core.js","server-bridge.js","suite-facilities.js","facilities-autoload.js","cartable-api.js")
foreach ($name in $client) {
  $local = Join-Path $Root $name
  if (Dl $name $local) {
    Copy-Item -LiteralPath $local -Destination (Join-Path $Public $name) -Force
  }
}

Write-Host ""
Write-Host "[2] Server runtime"
$srv = @(
  @{ r = "server/server.js"; d = "server.js" },
  @{ r = "server/START.bat"; d = "START.bat" },
  @{ r = "server/BACKUP-MIRROR.bat"; d = "BACKUP-MIRROR.bat" },
  @{ r = "server/COPY-MODULES.bat"; d = "COPY-MODULES.bat" },
  @{ r = "server/OPS-CHECKLIST.md"; d = "OPS-CHECKLIST.md" },
  @{ r = "server/SECURITY-HARDENING.md"; d = "SECURITY-HARDENING.md" }
)
foreach ($item in $srv) {
  Dl $item.r (Join-Path $Server $item.d) | Out-Null
}
# config.json: only download if missing (protect local host/jwtSecret/pass settings)
$cfg = Join-Path $Server "config.json"
if (-not (Test-Path -LiteralPath $cfg)) {
  Dl "server/config.json" $cfg | Out-Null
} else {
  Write-Host "  KEEP server/config.json (local)"
}

Write-Host ""
Write-Host "[3] Scripts / lib / docs"
$extra = @(
  "server/scripts/secure-setup.js",
  "server/scripts/seed-modules.js",
  "server/scripts/mirror-backups.js",
  "server/scripts/apply-extra-backup-hook.js",
  "server/scripts/apply-jwt-auth.js",
  "server/scripts/apply-optimistic-lock.js",
  "server/scripts/apply-module-rbac-jwt.js",
  "server/scripts/register-daily-mirror.ps1",
  "server/lib/jwt.js",
  "server/lib/rbac-modules.js",
  "server/docs/ARCHITECTURE-API-SECURITY.md"
)
foreach ($rel in $extra) {
  $tail = $rel.Substring("server/".Length)
  Dl $rel (Join-Path $Server $tail) | Out-Null
}

Write-Host ""
Write-Host "[4] HTML modules to public"
$html = @(
  "suite.html","cashbox.html","bank.html","accounting.html","sales.html",
  "warehouse.html","payroll.html","personnel.html","purchase.html",
  "customers.html","secretariat.html","secretary.html","ceo.html","manager.html"
)
foreach ($h in $html) {
  $dest = Join-Path $Public $h
  if (Dl $h $dest) {
    Copy-Item -LiteralPath $dest -Destination (Join-Path $Root $h) -Force -ErrorAction SilentlyContinue
  }
}

Write-Host ""
Write-Host "[5] Sync script self-update"
Dl "Sync-From-GitHub.ps1" (Join-Path $Root "Sync-From-GitHub.ps1") | Out-Null

Write-Host ""
Write-Host "========================================"
Write-Host " Done. Not touched: server\data  server\backups"
Write-Host " Next:"
Write-Host "   cd D:\smart-platform-alm\server"
Write-Host "   node scripts\apply-jwt-auth.js"
Write-Host "   node scripts\apply-module-rbac-jwt.js"
Write-Host "   node server.js"
Write-Host "========================================"
