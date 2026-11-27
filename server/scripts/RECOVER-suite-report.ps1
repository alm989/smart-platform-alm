# RECOVER suite report UI — removes old ReportCard2 that shows [object Object] + huge CSV
# Run AFTER: git pull origin main
# powershell -ExecutionPolicy Bypass -File .\server\scripts\RECOVER-suite-report.ps1
$ErrorActionPreference = 'Stop'
$root = 'D:\smart-platform-alm'
if (-not (Test-Path (Join-Path $root 'suite.html'))) {
  $root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}
$utf8 = New-Object System.Text.UTF8Encoding $false

$jsSrc = Join-Path $root 'server\public\suite-report-panel.js'
if (-not (Test-Path $jsSrc)) { throw "Missing $jsSrc — git pull first" }

# Mirror JS everywhere
Copy-Item -LiteralPath $jsSrc -Destination (Join-Path $root 'suite-report-panel.js') -Force
Copy-Item -LiteralPath $jsSrc -Destination (Join-Path $root 'server\public\suite-report-panel.js') -Force
Write-Host 'OK suite-report-panel.js'

function Fix-Suite([string]$path) {
  if (-not (Test-Path $path)) { Write-Host "skip $path"; return }
  $t = [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)

  # Remove ALL old report / excel inline modules
  $patterns = @(
    '(?s)<script>\s*/\* __sfReportCard2[\s\S]*?</script>\s*',
    '(?s)<script>\s*/\* __sfReport[\s\S]*?</script>\s*',
    '(?s)<script>\s*/\* __sfCsvBesideTitle[\s\S]*?</script>\s*',
    '(?s)<script>\s*/\* __sfSuiteDock[\s\S]*?</script>\s*',
    '(?s)<script>\s*/\* __sfSuiteBottom[\s\S]*?</script>\s*',
    '(?s)<script>\s*/\* __sfExcel[\s\S]*?</script>\s*',
    '(?s)<script[^>]*src=["''][^"'']*suite-report-panel\.js[^"'']*["''][^>]*>\s*</script>\s*'
  )
  foreach ($p in $patterns) { $t = [regex]::Replace($t, $p, '') }

  # Also remove unlabeled excel helper that injects full-width green button (sfExcelExportBtn builder without our panel)
  $t = [regex]::Replace($t, '(?s)<script>\s*\(function\s*\(\s*\)\s*\{[\s\S]*?sfExcelExportBtn[\s\S]*?\}\)\s*\(\s*\)\s*;\s*</script>\s*', '')

  if ($t -notmatch 'charset') {
    $t = $t.Replace('<head>', "<head>`r`n<meta charset=`"utf-8`">")
  }

  $inject = @'
<script src="suite-report-panel.js?v=20261127e"></script>
<script>
/* __sfSuiteBottomDockMini */
(function () {
  if (window.__sfSuiteBottomDockMini) return;
  window.__sfSuiteBottomDockMini = true;
  function ensureDock() {
    var dock = document.getElementById("sfBottomDock");
    if (!dock) {
      dock = document.createElement("div");
      dock.id = "sfBottomDock";
      dock.style.cssText = "position:fixed;left:0;right:0;bottom:0;height:42px;z-index:200;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 12px;box-sizing:border-box;background:rgba(2,6,23,.96);border-top:1px solid #334155;direction:rtl;font-family:Tahoma,sans-serif";
      dock.innerHTML = '<div id="sfDockRight" style="display:flex;align-items:center;gap:8px;flex:1;justify-content:flex-start"></div><div id="sfDockCenter" style="display:flex;align-items:center;gap:8px;flex:1.4;justify-content:center"></div><div id="sfDockLeft" style="display:flex;align-items:center;gap:8px;flex:1;justify-content:flex-end"></div>';
      document.body.appendChild(dock);
    }
    document.body.style.paddingBottom = "160px";
    function move(slot, el) {
      if (!slot || !el) return;
      if (el.parentElement !== slot) slot.appendChild(el);
      el.style.position = "static";
      el.style.left = el.style.right = el.style.top = el.style.bottom = "auto";
      el.style.transform = "none";
    }
    var r = document.getElementById("sfDockRight");
    var c = document.getElementById("sfDockCenter");
    var l = document.getElementById("sfDockLeft");
    move(r, document.getElementById("sfSyncChip"));
    move(c, document.getElementById("suiteJwtBar"));
    move(l, document.getElementById("sfOfflineFxBar"));
    move(l, document.getElementById("gearBtn"));
    var rep = document.getElementById("sfReportCard");
    if (rep) {
      rep.style.position = "fixed";
      rep.style.left = "8px";
      rep.style.right = "8px";
      rep.style.bottom = "42px";
      rep.style.height = "88px";
      rep.style.maxHeight = "88px";
      rep.style.zIndex = "190";
      rep.style.margin = "0";
      if (rep.parentElement !== document.body) document.body.appendChild(rep);
    }
  }
  setInterval(ensureDock, 1000);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureDock);
  else ensureDock();
})();
</script>
</body>
'@

  if ($t -match '</body>') {
    $t = [regex]::Replace($t, '</body>\s*</html>\s*$', ($inject + "`r`n</html>"))
    if ($t -notmatch 'suite-report-panel\.js') {
      $t = $t.Replace('</body>', $inject)
    }
  } else {
    $t = $t + $inject
  }

  [IO.File]::WriteAllText($path, $t, $utf8)
  Write-Host "FIXED $path"
}

Fix-Suite (Join-Path $root 'suite.html')
Fix-Suite (Join-Path $root 'server\public\suite.html')

Write-Host ''
Write-Host 'IMPORTANT: Do NOT run COPY-MODULES.bat after this (it overwrites public from root).'
Write-Host 'Root suite.html is already fixed; if you must run COPY-MODULES, run this script AGAIN after it.'
Write-Host 'Then: Ctrl+F5 on http://127.0.0.1:8787/suite.html'
