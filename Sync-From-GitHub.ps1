# Sync-From-GitHub.ps1
# One-click sync from GitHub → local smart-platform-alm
# Run in PowerShell:
#   cd D:\smart-platform-alm
#   powershell -ExecutionPolicy Bypass -File .\Sync-From-GitHub.ps1
#
# Does NOT overwrite: server\data\  server\backups\  users.json

$ErrorActionPreference = "Stop"
$Root = "D:\smart-platform-alm"
$RepoRaw = "https://raw.githubusercontent.com/alm989/smart-platform-alm/main"
$Server = Join-Path $Root "server"
$Public = Join-Path $Server "public"

function Ensure-Dir([string]$p) {
  if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null }
}

function Get-Raw([string]$rel, [string]$dest) {
  $url = "$RepoRaw/$($rel -replace '\\','/')"
  $dir = Split-Path -Parent $dest
  Ensure-Dir $dir
  try {
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -TimeoutSec 60
    Write-Host "  OK  $rel"
    return $true
  } catch {
    Write-Host "  SKIP $rel  ($($_.Exception.Message))"
    return $false
  }
}

Write-Host "========================================"
Write-Host " Smart Suite — Sync from GitHub"
Write-Host " Target: $Root"
Write-Host "========================================"

Ensure-Dir $Root
Ensure-Dir $Server
Ensure-Dir $Public
Ensure-Dir (Join-Path $Server "scripts")
Ensure-Dir (Join-Path $Server "lib")
Ensure-Dir (Join-Path $Server "docs")
Ensure-Dir (Join-Path $Server "data")
Ensure-Dir (Join-Path $Server "data\modules")
Ensure-Dir (Join-Path $Server "backups")

# --- core client files (repo root → root + public) ---
$clientFiles = @(
  "core.js",
  "server-bridge.js",
  "suite-facilities.js",
  "facilities-autoload.js",
  "cartable-api.js"
)

Write-Host "`n[1] Client core"
foreach ($f in $clientFiles) {
  $local = Join-Path $Root $f
  if (Get-Raw $f $local) {
    Copy-Item $local (Join-Path $Public $f) -Force
  }
}

# --- server runtime ---
Write-Host "`n[2] Server runtime"
$serverFiles = @(
  "server/server.js",
  "server/config.json",
  "server/START.bat",
  "server/BACKUP-MIRROR.bat",
  "server/COPY-MODULES.bat",
  "server/OPS-CHECKLIST.md",
  "server/SECURITY-HARDENING.md"
)
foreach ($f in $serverFiles) {
  $name = Split-Path $f -Leaf
  Get-Raw $f (Join-Path $Server $name) | Out-Null
}
# keep host localhost if config was overwritten with wrong host — user can edit

# --- server scripts / lib / docs ---
Write-Host "`n[3] Scripts / lib / docs"
$extra = @(
  "server/scripts/secure-setup.js",
  "server/scripts/seed-modules.js",
  "server/scripts/mirror-backups.js",
  "server/scripts/apply-extra-backup-hook.js",
  "server/scripts/apply-jwt-auth.js",
  "server/scripts/apply-optimistic-lock.js",
  "server/scripts/register-daily-mirror.ps1",
  "server/lib/jwt.js",
  "server/docs/ARCHITECTURE-API-SECURITY.md"
)
foreach ($f in $extra) {
  $rel = $f -replace '^server/', ''
  Get-Raw $f (Join-Path $Server $rel) | Out-Null
}

# --- suite + common modules into public (best-effort) ---
Write-Host "`n[4] HTML modules → public (best-effort)"
$htmlList = @(
  "suite.html",
  "cashbox.html",
  "bank.html",
  "accounting.html",
  "sales.html",
  "warehouse.html",
  "payroll.html",
  "personnel.html",
  "purchase.html",
  "customers.html",
  "secretariat.html",
  "secretary.html",
  "ceo.html",
  "manager.html"
)
foreach ($h in $htmlList) {
  $dest = Join-Path $Public $h
  # prefer root path on github
  if (-not (Get-Raw $h $dest)) {
    Get-Raw "server/public/$h" $dest | Out-Null
  }
  # also keep a copy at repo root if download worked
  if (Test-Path $dest) {
    Copy-Item $dest (Join-Path $Root $h) -Force -ErrorAction SilentlyContinue
  }
}

# --- self-update this script ---
Write-Host "`n[5] Sync script"
Get-Raw "Sync-From-GitHub.ps1" (Join-Path $Root "Sync-From-GitHub.ps1") | Out-Null

Write-Host "`n========================================"
Write-Host " Done. Protected (not touched):"
Write-Host "   server\data\"
Write-Host "   server\backups\"
Write-Host "========================================"
Write-Host ""
Write-Host "Next:"
Write-Host "  cd D:\smart-platform-alm\server"
Write-Host "  node scripts\apply-jwt-auth.js   # if not yet applied"
Write-Host "  node server.js"
Write-Host "  http://127.0.0.1:8787/suite.html"
Write-Host ""
