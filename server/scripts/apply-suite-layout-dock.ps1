# Suite layout: sync BR, role BC, compact report bottom, larger module tiles
# powershell -ExecutionPolicy Bypass -File .\server\scripts\apply-suite-layout-dock.ps1
$ErrorActionPreference = 'Stop'
$root = 'D:\smart-platform-alm'
if (-not (Test-Path (Join-Path $root 'suite.html'))) {
  $root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
}
$utf8 = New-Object System.Text.UTF8Encoding $false

function Patch-File([string]$path, [scriptblock]$fn) {
  if (-not (Test-Path $path)) { Write-Host "skip $path"; return }
  $t = [IO.File]::ReadAllText($path, $utf8)
  $n = & $fn $t
  if ($null -eq $n) { return }
  [IO.File]::WriteAllText($path, $n, $utf8)
  Write-Host "OK $path"
}

# --- suite.html CSS + layout script ---
$layoutCss = @'

/* __sfSuiteLayoutDock CSS */
.grid{grid-template-columns:repeat(auto-fill,minmax(112px,1fr))!important;gap:8px!important}
.mod{padding:10px 6px!important;border-radius:12px!important}
.mod .ic{font-size:1.2rem!important;margin-bottom:3px!important}
.mod .nm{font-size:.72rem!important}
.mod .ds{font-size:.58rem!important}
.section h3{font-size:.8rem!important;margin-bottom:6px!important}
#sfSyncChip{
  position:fixed!important;bottom:14px!important;right:14px!important;left:auto!important;
  z-index:160!important;max-width:42vw;font:11px Tahoma,sans-serif!important;
  pointer-events:none!important
}
#sfRoleChip{
  position:fixed!important;bottom:14px!important;left:50%!important;right:auto!important;
  transform:translateX(-50%)!important;z-index:160!important;
  max-width:min(420px,90vw)!important;text-align:center!important;
  font:11px Tahoma,sans-serif!important
}
#sfReportCard{
  position:fixed!important;bottom:52px!important;left:50%!important;transform:translateX(-50%)!important;
  width:auto!important;max-width:min(520px,94vw)!important;
  max-height:min(28vh,220px)!important;overflow:auto!important;
  margin:0!important;padding:8px 10px!important;z-index:155!important;
  border-radius:12px!important;border:1px solid #334155!important;
  background:rgba(15,23,42,.96)!important;box-shadow:0 6px 20px rgba(0,0,0,.35)!important;
  font-size:.7rem!important
}
#sfReportCard b{font-size:.78rem!important}
#sfRepBody{font-size:.68rem!important;color:#94a3b8!important}
#sfRepBody > div{grid-template-columns:1fr 1fr!important;gap:4px!important}
#sfExcelExportBtn{width:auto!important;display:inline-block!important;margin:4px 0 0!important;padding:5px 8px!important;font-size:.68rem!important}
#sfOfflineFxBar{bottom:14px!important;left:14px!important;right:auto!important}
body{padding-bottom:90px!important}
'@

$layoutJs = @'
<script>
/* __sfSuiteLayoutDock — enforce positions */
(function () {
  if (window.__sfSuiteLayoutDock) return;
  window.__sfSuiteLayoutDock = true;

  function place() {
    var sync = document.getElementById("sfSyncChip");
    if (sync) {
      sync.style.position = "fixed";
      sync.style.bottom = "14px";
      sync.style.right = "14px";
      sync.style.left = "auto";
      sync.style.top = "auto";
      sync.style.zIndex = "160";
      sync.style.pointerEvents = "none";
    }
    var role = document.getElementById("sfRoleChip");
    if (role) {
      role.style.position = "fixed";
      role.style.bottom = "14px";
      role.style.left = "50%";
      role.style.right = "auto";
      role.style.top = "auto";
      role.style.transform = "translateX(-50%)";
      role.style.zIndex = "160";
      role.style.textAlign = "center";
      role.style.maxWidth = "min(420px, 90vw)";
    }
    var rep = document.getElementById("sfReportCard");
    if (rep) {
      // detach from top of page flow if still in main
      if (rep.parentElement && rep.parentElement !== document.body) {
        document.body.appendChild(rep);
      }
      rep.style.position = "fixed";
      rep.style.bottom = "52px";
      rep.style.left = "50%";
      rep.style.right = "auto";
      rep.style.top = "auto";
      rep.style.transform = "translateX(-50%)";
      rep.style.width = "auto";
      rep.style.maxWidth = "min(520px, 94vw)";
      rep.style.maxHeight = "min(28vh, 220px)";
      rep.style.overflow = "auto";
      rep.style.margin = "0";
      rep.style.padding = "8px 10px";
      rep.style.zIndex = "155";
      rep.style.boxShadow = "0 6px 20px rgba(0,0,0,.35)";
    }
  }

  // compact report body renderer override hook
  var obs = new MutationObserver(function () { place(); });
  if (document.body) obs.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { place(); setInterval(place, 1500); });
  } else {
    place();
    setInterval(place, 1500);
  }
})();
</script>
'@

Patch-File (Join-Path $root 'suite.html') {
  param($t)
  if ($t -match '__sfSuiteLayoutDock CSS') { Write-Host 'suite CSS already'; return $null }
  if ($t -match '</style>') {
    $t = $t.Replace('</style>', $layoutCss + "`r`n</style>")
  }
  if ($t -notmatch '__sfSuiteLayoutDock —') {
    if ($t -match '</body>') { $t = $t.Replace('</body>', $layoutJs + "`r`n</body>") }
    else { $t = $t + $layoutJs }
  }
  # shrink report card initial style if present
  $t = $t -replace 'margin:12px;padding:14px;border-radius:14px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;font-family:Tahoma,sans-serif',
    'margin:0;padding:8px 10px;border-radius:12px;border:1px solid #334155;background:rgba(15,23,42,.96);color:#e2e8f0;font-family:Tahoma,sans-serif;max-width:min(520px,94vw);max-height:min(28vh,220px);overflow:auto'
  return $t
}

Patch-File (Join-Path $root 'server\public\suite.html') {
  param($t)
  if ($t -match '__sfSuiteLayoutDock CSS') { Write-Host 'public suite CSS already'; return $null }
  if ($t -match '</style>') {
    $t = $t.Replace('</style>', $layoutCss + "`r`n</style>")
  }
  if ($t -notmatch '__sfSuiteLayoutDock —') {
    if ($t -match '</body>') { $t = $t.Replace('</body>', $layoutJs + "`r`n</body>") }
    else { $t = $t + $layoutJs }
  }
  $t = $t -replace 'margin:12px;padding:14px;border-radius:14px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;font-family:Tahoma,sans-serif',
    'margin:0;padding:8px 10px;border-radius:12px;border:1px solid #334155;background:rgba(15,23,42,.96);color:#e2e8f0;font-family:Tahoma,sans-serif;max-width:min(520px,94vw);max-height:min(28vh,220px);overflow:auto'
  return $t
}

# --- server-bridge: default sync chip bottom-right ---
@('server-bridge.js', 'server\public\server-bridge.js') | ForEach-Object {
  $p = Join-Path $root $_
  if (-not (Test-Path $p)) { return }
  $t = [IO.File]::ReadAllText($p, $utf8)
  $t2 = $t
  $t2 = $t2 -replace 'bottom:12px;left:12px;right:auto', 'bottom:14px;right:14px;left:auto'
  $t2 = $t2 -replace 'el\.style\.left\s*=\s*"12px";\s*el\.style\.right\s*=\s*"auto";\s*el\.style\.bottom\s*=\s*"12px"',
    'el.style.right="14px"; el.style.left="auto"; el.style.bottom="14px"'
  $t2 = $t2 -replace 'position:fixed;top:10px;right:10px;z-index:120',
    'position:fixed;bottom:14px;left:50%;right:auto;transform:translateX(-50%);top:auto;z-index:160'
  if ($t2 -ne $t) {
    [IO.File]::WriteAllText($p, $t2, $utf8)
    Write-Host "OK $_ bridge positions"
  } else {
    Write-Host "bridge $_ no text change (may already patched)"
  }
}

Write-Host 'Done. COPY-MODULES + Ctrl+Shift+R on suite.html'
