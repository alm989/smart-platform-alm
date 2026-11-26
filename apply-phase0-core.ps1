# Phase0 core.js security patches
# Run: powershell -ExecutionPolicy Bypass -File .\apply-phase0-core.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$core = Join-Path $root 'core.js'
if (!(Test-Path $core)) { throw "core.js not found: $core" }

$t = [IO.File]::ReadAllText($core)
$orig = $t

# version bump
$t = $t -replace 'var CORE_VERSION = 3\.1;', 'var CORE_VERSION = 3.2;'
$t = $t -replace 'Smart Suite Core v3\.1', 'Smart Suite Core v3.2 (Phase0 security)'

# defaultAuth: do not seed plain credentials for new storage
$oldDefault = @'
  function defaultAuth() {
    return {
      users: [{ user: "admin", pass: "admin", name: "مدیر", role: "admin" }],
      pin2: "1234",
      session: null
    };
  }
'@
$newDefault = @'
  function defaultAuth() {
    /* Phase0: no plain default passwords seeded into LocalStorage */
    return {
      users: [],
      pin2: null,
      session: null,
      legacyLocal: true
    };
  }
'@
if ($t.Contains('user: "admin", pass: "admin"')) {
  $t = $t.Replace($oldDefault, $newDefault)
}

# getAuth: do not force pin2 to 1234
$t = $t.Replace(
  "    if (a.pin2 == null) a.pin2 = `"1234`";
    return a;",
  "    /* Phase0: do not force insecure default pin */
    return a;")

# remove on-screen credentials
$t = $t.Replace(
  "'<p style=`\"margin:10px 0 0;text-align:center;font-size:.65rem;color:#64748b`\">admin / admin · پین: ۱۲۳۴</p></div>';",
  "'<p style=`\"margin:10px 0 0;text-align:center;font-size:.65rem;color:#64748b`\">از حساب تعریف‌شده در سرور استفاده کنید</p></div>';")

# also handle HTML entity / alternate quote forms
$t = $t -replace 'admin / admin · پین: ۱۲۳۴', 'از حساب تعریف‌شده در سرور استفاده کنید'
$t = $t -replace 'admin / admin · پین: 1234', 'از حساب تعریف‌شده در سرور استفاده کنید'

# inject getPublicSession before SmartCore export if missing
if ($t -notmatch 'getPublicSession') {
  $inject = @'
  function getPublicSession() {
    var a = getAuth();
    var s = a && a.session;
    if (!s) return null;
    return { user: s.user, name: s.name || s.user, role: s.role || 'guest', at: s.at || null };
  }

'@
  $t = $t.Replace('  global.SmartCore = {', $inject + '  global.SmartCore = {')
  $t = $t.Replace('    userRole: userRole,', "    userRole: userRole,`r`n    getPublicSession: getPublicSession,")
}

# disable core facilities bootstrap when autoload present
$oldBoot = '/* ========== Auto facilities bootstrap ========== */'
if ($t.Contains($oldBoot)) {
  $bootStart = $t.IndexOf($oldBoot)
  if ($bootStart -ge 0) {
    $newBoot = @'
/* ========== Auto facilities bootstrap (Phase0: defer to facilities-autoload when present) ========== */
(function () {
  "use strict";
  function hasAutoload() {
    try {
      return !!(document.querySelector('script[src*="facilities-autoload"]') || window.__sfAutoloadBootstrapped);
    } catch (e) { return false; }
  }
  function detectMod() {
    var path = (location.pathname || "").split("/").pop() || "";
    try { path = decodeURIComponent(path); } catch (e) {}
    path = path.replace(/\.html?$/i, "");
    var aliases = { "file-hub": "filehub", "pr-media": "pr" };
    var id = aliases[path] || path || "cashbox";
    var title = id;
    try {
      if (window.SmartCore && Array.isArray(SmartCore.MODULES)) {
        var m = SmartCore.MODULES.find(function (x) {
          return x.id === id || x.file === path + ".html" || x.file === id + ".html";
        });
        if (m) { id = m.id; title = m.title || m.id; }
      }
    } catch (e2) {}
    return { id: id, title: title };
  }
  function hasPanels() {
    return !!(document.getElementById("p-notes") || document.getElementById("p-rems") || document.getElementById("p-cartable"));
  }
  function initFacilities() {
    if (!hasPanels() || window.__sfFacilitiesInited) return;
    if (!window.SuiteFacilities || typeof SuiteFacilities.init !== "function") return;
    window.__sfFacilitiesInited = true;
    var d = detectMod();
    try {
      SuiteFacilities.init({ moduleId: d.id, moduleTitle: d.title });
    } catch (e) {
      console.warn("[SmartCore] facilities init", e);
      window.__sfFacilitiesInited = false;
    }
  }
  function loadFacilities() {
    if (hasAutoload()) return; /* single owner: facilities-autoload.js */
    if (!hasPanels()) return;
    if (window.SuiteFacilities) { initFacilities(); return; }
    if (document.querySelector('script[src*="suite-facilities.js"]')) {
      var tries = 0;
      var t = setInterval(function () {
        tries++;
        if (window.SuiteFacilities || tries > 50) {
          clearInterval(t);
          initFacilities();
        }
      }, 40);
      return;
    }
    var d = detectMod();
    var s = document.createElement("script");
    s.src = "suite-facilities.js";
    s.setAttribute("data-module", d.id);
    s.setAttribute("data-title", d.title);
    s.onload = function () { initFacilities(); };
    s.onerror = function () {
      console.warn("[SmartCore] suite-facilities.js failed — CSP: script-src 'self' 'unsafe-inline'");
    };
    (document.head || document.documentElement).appendChild(s);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadFacilities);
  } else {
    setTimeout(loadFacilities, 0);
  }
})();
'@
    $t = $t.Substring(0, $bootStart) + $newBoot
  }
}

if ($t -eq $orig) {
  Write-Host 'No changes applied (patterns may already be patched or differ).'
} else {
  Copy-Item $core ($core + '.bak-phase0') -Force
  [IO.File]::WriteAllText($core, $t, [Text.UTF8Encoding]::new($false))
  Write-Host 'OK: core.js patched (backup: core.js.bak-phase0)'
}

# copy to public if exists
$pub = Join-Path $root 'server\public'
if (Test-Path $pub) {
  Copy-Item $core (Join-Path $pub 'core.js') -Force
  $fa = Join-Path $root 'facilities-autoload.js'
  if (Test-Path $fa) { Copy-Item $fa (Join-Path $pub 'facilities-autoload.js') -Force }
  Write-Host 'OK: copied to server/public'
}
