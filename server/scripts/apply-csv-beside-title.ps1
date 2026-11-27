# Force CSV button beside report title + cache-bust JS
# Run in PowerShell:
#   cd D:\smart-platform-alm
#   git pull origin main
#   powershell -ExecutionPolicy Bypass -File .\server\scripts\apply-csv-beside-title.ps1
$ErrorActionPreference = 'Stop'
$root = 'D:\smart-platform-alm'
if (-not (Test-Path (Join-Path $root 'server\public\suite-report-panel.js'))) {
  $root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
}
$utf8 = New-Object System.Text.UTF8Encoding $false

$jsSrc = Join-Path $root 'server\public\suite-report-panel.js'
if (-not (Test-Path $jsSrc)) { throw "missing $jsSrc — run git pull first" }

# Copy to all locations COPY-MODULES / browser might use
$dests = @(
  (Join-Path $root 'suite-report-panel.js'),
  (Join-Path $root 'server\public\suite-report-panel.js'),
  (Join-Path $root 'server\suite-report-panel.js')
)
foreach ($d in $dests) {
  $dir = Split-Path $d -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  Copy-Item -LiteralPath $jsSrc -Destination $d -Force
  Write-Host "copied -> $d"
}

# Tiny fix: always move CSV next to title <b> inside #sfReportCard
$fixJs = @'
<script>
/* __sfCsvBesideTitle */
(function () {
  if (window.__sfCsvBesideTitle) return;
  window.__sfCsvBesideTitle = true;
  function place() {
    var box = document.getElementById("sfReportCard");
    if (!box) return;
    var csv = document.getElementById("sfExcelExportBtn");
    if (!csv) return;
    var title = null;
    var bs = box.querySelectorAll("b");
    for (var i = 0; i < bs.length; i++) {
      title = bs[i];
      break;
    }
    if (!title) return;
    // put title + csv in one RTL group at the start of head
    var head = title.parentElement;
    while (head && head !== box && head.parentElement !== box) head = head.parentElement;
    if (!head || head === box) {
      head = box.firstElementChild;
    }
    if (!head) return;
    head.style.display = "flex";
    head.style.alignItems = "center";
    head.style.justifyContent = "space-between";
    head.style.direction = "rtl";
    head.style.gap = "8px";

    var grp = document.getElementById("sfTitleCsvGrp");
    if (!grp) {
      grp = document.createElement("div");
      grp.id = "sfTitleCsvGrp";
      grp.style.cssText = "display:flex;align-items:center;gap:8px;direction:rtl";
    }
    if (title.parentElement !== grp) grp.appendChild(title);
    if (csv.parentElement !== grp) grp.appendChild(csv);
    // order: title then csv (RTL: title on the right, csv to its left = beside)
    if (grp.firstChild !== title) grp.insertBefore(title, grp.firstChild);
    if (title.nextSibling !== csv) grp.insertBefore(csv, title.nextSibling);

    if (grp.parentElement !== head) head.insertBefore(grp, head.firstChild);

    // refresh stays on the other side
    var ref = document.getElementById("sfRepRefresh");
    if (ref && ref.parentElement !== head) head.appendChild(ref);
  }
  place();
  setInterval(place, 800);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", place);
})();
</script>
'@

function Patch-Html([string]$path) {
  if (-not (Test-Path $path)) { Write-Host "skip $path"; return }
  $t = [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)
  # cache-bust script src
  $t = $t -replace 'suite-report-panel\.js(\?v=[^"'']*)?', 'suite-report-panel.js?v=20261127c'
  if ($t -notmatch 'suite-report-panel\.js') {
    if ($t -match '</body>') {
      $t = $t.Replace('</body>', "<script src=`"suite-report-panel.js?v=20261127c`"></script>`r`n</body>")
    }
  }
  $t = [regex]::Replace($t, '(?s)<script>\s*/\* __sfCsvBesideTitle[\s\S]*?</script>\s*', '')
  if ($t -match '</body>') {
    $t = $t.Replace('</body>', $fixJs + "`r`n</body>")
  } else {
    $t = $t + $fixJs
  }
  [IO.File]::WriteAllText($path, $t, $utf8)
  Write-Host "OK $path"
}

Patch-Html (Join-Path $root 'suite.html')
Patch-Html (Join-Path $root 'server\public\suite.html')

Write-Host ''
Write-Host 'Now hard-refresh: Ctrl+F5 on suite.html'
Write-Host 'CSV must sit beside title on the right.'
