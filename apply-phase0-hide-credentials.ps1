# Phase0 — hide credentials everywhere (suite.html + server-bridge + core)
# Run from repo root:
#   powershell -ExecutionPolicy Bypass -File .\apply-phase0-hide-credentials.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Patch-File([string]$rel, [scriptblock]$fn) {
  $path = Join-Path $root $rel
  if (!(Test-Path $path)) { Write-Host "skip missing: $rel"; return }
  $t = [IO.File]::ReadAllText($path)
  $n = & $fn $t
  if ($n -eq $t) { Write-Host "no change: $rel"; return }
  Copy-Item $path ($path + '.bak-cred') -Force
  [IO.File]::WriteAllText($path, $n, [Text.UTF8Encoding]::new($false))
  Write-Host "patched: $rel"
}

# --- suite.html ---
Patch-File 'suite.html' {
  param($t)
  $t = $t.Replace(
    'admin / admin · پین: ۱۲۳۴',
    'از حساب سرور استفاده کنید')
  $t = $t.Replace(
    'admin / admin · پین: 1234',
    'از حساب سرور استفاده کنید')
  $t = $t -replace 'users:\s*\[\{\s*user:\s*"admin",\s*pass:\s*"admin",\s*name:\s*"مدیر",\s*role:\s*"admin"\s*\}\]', 'users: []'
  $t = $t -replace 'pin2:\s*"1234"', 'pin2: null'
  $t = $t.Replace('if (a.pin2 == null) a.pin2 = "1234";', '/* Phase0: no forced default pin */')
  return $t
}

# --- core.js ---
Patch-File 'core.js' {
  param($t)
  $t = $t.Replace('admin / admin · پین: ۱۲۳۴', 'از حساب تعریف‌شده در سرور استفاده کنید')
  $t = $t.Replace('admin / admin · پین: 1234', 'از حساب تعریف‌شده در سرور استفاده کنید')
  $t = $t -replace 'users:\s*\[\{\s*user:\s*"admin",\s*pass:\s*"admin",\s*name:\s*"مدیر",\s*role:\s*"admin"\s*\}\]', 'users: []'
  $t = $t.Replace('if (a.pin2 == null) a.pin2 = "1234";', '/* Phase0: no forced default pin */')
  return $t
}

# --- server-bridge.js: never persist password/pin ---
Patch-File 'server-bridge.js' {
  param($t)
  # setLastLogin: store user only
  $t = $t.Replace(
    "sessionStorage.setItem(LAST_KEY, JSON.stringify({
        user: user, pass: pass, pin: pin || `"5678`", at: Date.now()
      }));",
    "sessionStorage.setItem(LAST_KEY, JSON.stringify({
        user: user, at: Date.now()
      }));")
  $t = $t.Replace(
    "sessionStorage.setItem(LAST_KEY, JSON.stringify({
        user: user, pass: pass, pin: pin || `"5678`", at: Date.now()
      }));",
    "sessionStorage.setItem(LAST_KEY, JSON.stringify({
        user: user, at: Date.now()
      }));")
  # getLastLogin: only user
  $t = $t.Replace(
    'if (o && o.user && o.pass) return o;',
    'if (o && o.user) return { user: o.user, at: o.at || null };')
  # remove hardcoded admin/admin auto-login attempts
  $t = $t.Replace(
    "attempts.push({ user: `"admin`", pass: `"admin`", pin: `"5678`" });
      attempts.push({ user: `"admin`", pass: `"admin`", pin: `"1234`" });",
    "/* Phase0: no hardcoded credential attempts */")
  $t = $t.Replace(
    "attempts.push({ user: `"admin`", pass: `"admin`", pin: `"5678`" });
      attempts.push({ user: `"admin`", pass: `"admin`", pin: `"1234`" });",
    "/* Phase0: no hardcoded credential attempts */")
  # credentials(): do not default to admin/admin
  $t = $t.Replace(
    'var user = (a.session && a.session.user) || "admin";
    var pass = "admin";
    var pin = a.pin2 || "5678";',
    'var user = (a.session && a.session.user) || "";
    var pass = "";
    var pin = "";')
  return $t
}

# copy critical files to public
$pub = Join-Path $root 'server\public'
if (Test-Path $pub) {
  foreach ($f in @('suite.html','core.js','server-bridge.js','facilities-autoload.js')) {
    $src = Join-Path $root $f
    if (Test-Path $src) {
      Copy-Item $src (Join-Path $pub $f) -Force
      Write-Host "copied to public: $f"
    }
  }
}

Write-Host ""
Write-Host "DONE. Next:"
Write-Host "  1) Restart server"
Write-Host "  2) In browser console:"
Write-Host "     sessionStorage.clear(); localStorage.removeItem('smart_users_suite_brain'); location.reload();"
