# Suite: one bottom row (offline | role | sync) + full-width report under it
# powershell -ExecutionPolicy Bypass -File .\server\scripts\apply-suite-bottom-dock-row.ps1
$ErrorActionPreference = 'Stop'
$root = 'D:\smart-platform-alm'
if (-not (Test-Path (Join-Path $root 'suite.html'))) {
  $root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
}
$utf8 = New-Object System.Text.UTF8Encoding $false

$css = @'

/* __sfSuiteBottomDockRow CSS */
#sfBottomDock{
  position:fixed!important;bottom:0!important;left:0!important;right:0!important;
  z-index:170!important;display:flex!important;align-items:center!important;
  justify-content:space-between!important;gap:10px!important;
  padding:8px 14px!important;box-sizing:border-box!important;
  background:rgba(2,6,23,.92)!important;border-top:1px solid #334155!important;
  backdrop-filter:blur(6px);direction:rtl!important;font-family:Tahoma,sans-serif!important
}
#sfBottomDock .sf-dock-left,
#sfBottomDock .sf-dock-center,
#sfBottomDock .sf-dock-right{
  display:flex!important;align-items:center!important;gap:8px!important;min-width:0
}
#sfBottomDock .sf-dock-left{justify-content:flex-start!important;flex:1!important;padding-right:8px!important}
#sfBottomDock .sf-dock-center{justify-content:center!important;flex:1.4!important}
#sfBottomDock .sf-dock-right{justify-content:flex-end!important;flex:1!important}
#sfBottomDock #sfSyncChip,
#sfBottomDock #sfRoleChip,
#sfBottomDock #sfOfflineFxBar,
#sfBottomDock #sfOfflineFxBadge,
#sfBottomDock #sfOfflineFxFlush{
  position:static!important;transform:none!important;left:auto!important;right:auto!important;bottom:auto!important;top:auto!important;
  margin:0!important;pointer-events:auto!important
}
#sfBottomDock #sfSyncChip{
  pointer-events:none!important;white-space:nowrap!important;
  background:rgba(15,23,42,.95)!important;border:1px solid #334155!important;
  border-radius:8px!important;padding:5px 10px!important;font-size:11px!important;color:#e2e8f0!important
}
#sfBottomDock #sfRoleChip{
  white-space:nowrap!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;
  background:rgba(15,23,42,.95)!important;border:1px solid #334155!important;
  border-radius:8px!important;padding:5px 10px!important;font-size:11px!important;color:#e2e8f0!important;text-align:center!important
}
#sfBottomDock #sfOfflineFxFlush{
  background:#0f766e!important;color:#fff!important;border:none!important;border-radius:8px!important;
  padding:5px 10px!important;font-weight:700!important;font-size:11px!important;cursor:pointer!important
}
#sfBottomDock #sfOfflineFxBadge{
  background:#b45309!important;color:#fff!important;padding:4px 8px!important;border-radius:999px!important;font-size:11px!important;font-weight:700!important
}
#sfReportCard{
  position:fixed!important;left:10px!important;right:10px!important;bottom:48px!important;
  width:auto!important;max-width:none!important;transform:none!important;
  max-height:min(26vh,200px)!important;overflow:auto!important;
  margin:0!important;padding:8px 12px!important;z-index:165!important;
  border-radius:12px!important;border:1px solid #334155!important;
  background:rgba(15,23,42,.97)!important;box-shadow:0 6px 18px rgba(0,0,0,.35)!important;
  box-sizing:border-box!important
}
#sfReportCard b{font-size:.8rem!important}
#sfRepBody{font-size:.7rem!important}
#sfRepBody > div{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))!important;gap:6px!important}
body{padding-bottom:calc(48px + min(26vh,200px) + 12px)!important}
#sfOfflineFxBar{background:transparent!important;box-shadow:none!important}
'@

$js = @'
<script>
/* __sfSuiteBottomDockRow */
(function () {
  if (window.__sfSuiteBottomDockRow) return;
  window.__sfSuiteBottomDockRow = true;

  function ensureDock() {
    var dock = document.getElementById("sfBottomDock");
    if (!dock) {
      dock = document.createElement("div");
      dock.id = "sfBottomDock";
      dock.innerHTML =
        '<div class="sf-dock-right" data-slot="right"></div>' +
        '<div class="sf-dock-center" data-slot="center"></div>' +
        '<div class="sf-dock-left" data-slot="left"></div>';
      // RTL: visual right = first flex with direction rtl... use explicit slots:
      // User wants: offline slightly right of left, role center, sync bottom-right
      // In LTR flex space-between with direction:rtl on dock:
      // first child appears on the right. So order: right(sync), center(role), left(offline)
      document.body.appendChild(dock);
    }
    return dock;
  }

  function moveInto(slotEl, node) {
    if (!slotEl || !node) return;
    if (node.parentElement !== slotEl) slotEl.appendChild(node);
    node.style.position = "static";
    node.style.left = "auto";
    node.style.right = "auto";
    node.style.bottom = "auto";
    node.style.top = "auto";
    node.style.transform = "none";
  }

  function place() {
    var dock = ensureDock();
    var slotRight = dock.querySelector('[data-slot="right"]');
    var slotCenter = dock.querySelector('[data-slot="center"]');
    var slotLeft = dock.querySelector('[data-slot="left"]');

    var sync = document.getElementById("sfSyncChip");
    var role = document.getElementById("sfRoleChip");
    var off = document.getElementById("sfOfflineFxBar");

    // create offline bar shell if only badge exists later
    if (!off) {
      off = document.createElement("div");
      off.id = "sfOfflineFxBar";
      off.style.display = "flex";
      off.style.alignItems = "center";
      off.style.gap = "8px";
    }

    moveInto(slotRight, sync);
    moveInto(slotCenter, role);
    // offline a bit toward center from left: put in left slot (visual left in RTL is physical left)
    moveInto(slotLeft, off);
    // nudge offline slightly to the right (toward center)
    if (off) {
      off.style.marginRight = "0";
      off.style.marginLeft = "12px"; // LTR margin: in RTL dock, margin-inline-start helps
      off.style.marginInlineStart = "12px";
    }

    var rep = document.getElementById("sfReportCard");
    if (rep) {
      if (rep.parentElement !== document.body) document.body.appendChild(rep);
      rep.style.position = "fixed";
      rep.style.left = "10px";
      rep.style.right = "10px";
      rep.style.bottom = "48px";
      rep.style.width = "auto";
      rep.style.maxWidth = "none";
      rep.style.transform = "none";
      rep.style.zIndex = "165";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      place();
      setInterval(place, 1200);
    });
  } else {
    place();
    setInterval(place, 1200);
  }
  try {
    new MutationObserver(function () { place(); }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
})();
</script>
'@

function Patch-Suite([string]$path) {
  if (-not (Test-Path $path)) { Write-Host "skip $path"; return }
  $t = [IO.File]::ReadAllText($path, $utf8)
  # remove previous dock CSS block if present (both variants)
  $t = [regex]::Replace($t, '(?s)/\* __sfSuiteLayoutDock CSS \*/.*?(?=</style>)', '')
  $t = [regex]::Replace($t, '(?s)/\* __sfSuiteBottomDockRow CSS \*/.*?(?=</style>)', '')
  if ($t -match '</style>') {
    $t = $t.Replace('</style>', $css + "`r`n</style>")
  }
  $t = [regex]::Replace($t, '(?s)<script>\s*/\* __sfSuiteLayoutDock[\s\S]*?</script>\s*', '')
  $t = [regex]::Replace($t, '(?s)<script>\s*/\* __sfSuiteBottomDockRow[\s\S]*?</script>\s*', '')
  if ($t -match '</body>') {
    $t = $t.Replace('</body>', $js + "`r`n</body>")
  } else {
    $t = $t + $js
  }
  [IO.File]::WriteAllText($path, $t, $utf8)
  Write-Host "OK $path"
}

Patch-Suite (Join-Path $root 'suite.html')
Patch-Suite (Join-Path $root 'server\public\suite.html')
Write-Host 'Done. Ctrl+Shift+R on suite'
