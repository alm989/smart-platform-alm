# Persian labels for management report titles
# powershell -ExecutionPolicy Bypass -File .\server\scripts\apply-suite-report-fa-labels.ps1
$ErrorActionPreference = 'Stop'
$root = 'D:\smart-platform-alm'
if (-not (Test-Path (Join-Path $root 'suite.html'))) {
  $root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
}
$utf8 = New-Object System.Text.UTF8Encoding $false

$js = @'
<script>
/* __sfReportFaLabels */
(function () {
  if (window.__sfReportFaLabels) return;
  window.__sfReportFaLabels = true;

  var MAP = {
    user: "\u06a9\u0627\u0631\u0628\u0631",
    by: "\u06a9\u0627\u0631\u0628\u0631",
    role: "\u0646\u0642\u0634",
    at: "\u0632\u0645\u0627\u0646",
    time: "\u0632\u0645\u0627\u0646",
    version: "\u0646\u0633\u062e\u0647",
    auth: "\u0627\u062d\u0631\u0627\u0632 \u0647\u0648\u06cc\u062a",
    modules: "\u0645\u0627\u0698\u0648\u0644\u200c\u0647\u0627",
    module: "\u0645\u0627\u0698\u0648\u0644\u200c\u0647\u0627",
    moduleRegistryCount: "\u062b\u0628\u062a \u0645\u0627\u0698\u0648\u0644",
    moduleBytes: "\u062d\u062c\u0645 \u062f\u0627\u062f\u0647",
    backups: "\u067e\u0634\u062a\u06cc\u0628\u0627\u0646",
    users: "\u06a9\u0627\u0631\u0628\u0631\u0627\u0646",
    cartableItems: "\u06a9\u0627\u0631\u062a\u0627\u0628\u0644",
    cartable: "\u06a9\u0627\u0631\u062a\u0627\u0628\u0644",
    publicExists: "\u0641\u0648\u0644\u062f\u0631 public",
    ok: "\u0648\u0636\u0639\u06cc\u062a",
    "\u06a9\u0627\u0631\u0628\u0631": "\u06a9\u0627\u0631\u0628\u0631",
    "\u0646\u0642\u0634": "\u0646\u0642\u0634",
    "\u0632\u0645\u0627\u0646": "\u0632\u0645\u0627\u0646",
    "\u0646\u0633\u062e\u0647": "\u0646\u0633\u062e\u0647",
    "\u0645\u0627\u0698\u0648\u0644": "\u0645\u0627\u0698\u0648\u0644\u200c\u0647\u0627",
    "\u067e\u0634\u062a\u06cc\u0628\u0627\u0646": "\u067e\u0634\u062a\u06cc\u0628\u0627\u0646",
    "\u06a9\u0627\u0631\u062a\u0627\u0628\u0644": "\u06a9\u0627\u0631\u062a\u0627\u0628\u0644",
    "\u06a9\u0627\u0631\u0628\u0631\u0627\u0646": "\u06a9\u0627\u0631\u0628\u0631\u0627\u0646"
  };

  function faLabel(k) {
    if (k == null) return "";
    var s = String(k).trim();
    if (MAP[s]) return MAP[s];
    var low = s.toLowerCase();
    if (MAP[low]) return MAP[low];
    return s;
  }

  function retitle() {
    var body = document.getElementById("sfRepBody");
    if (!body) return;
    body.querySelectorAll(".sf-rep-cell .k, .sf-rep-cell > div:first-child").forEach(function (el) {
      var t = (el.textContent || "").trim();
      if (!t) return;
      var n = faLabel(t);
      if (n && n !== t) el.textContent = n;
    });
    // also plain text pairs if old renderer
    body.querySelectorAll("div").forEach(function (el) {
      if (el.classList && el.classList.contains("v")) return;
      var t = (el.textContent || "").trim();
      if (MAP[t] || MAP[t.toLowerCase()]) el.textContent = faLabel(t);
    });
  }

  // Prefer rewriting load output when compact report builds cells
  var _cellObs = new MutationObserver(function () { retitle(); });
  function watch() {
    var body = document.getElementById("sfRepBody");
    if (body) _cellObs.observe(body, { childList: true, subtree: true, characterData: true });
    retitle();
  }

  // Override compact load if present: patch after each refresh click
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t && (t.id === "sfRepRefresh" || (t.closest && t.closest("#sfRepRefresh")))) {
      setTimeout(retitle, 400);
      setTimeout(retitle, 1200);
    }
  }, true);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch);
  else watch();
  setInterval(retitle, 2000);
})();
</script>
'@

# Also harden compact report source labels if block exists — inject MAP into next load via extra script only
function Patch([string]$path) {
  if (-not (Test-Path $path)) { Write-Host "skip $path"; return }
  $t = [IO.File]::ReadAllText($path, $utf8)
  $t = [regex]::Replace($t, '(?s)<script>\s*/\* __sfReportFaLabels[\s\S]*?</script>\s*', '')
  if ($t -match '</body>') { $t = $t.Replace('</body>', $js + "`r`n</body>") }
  else { $t = $t + $js }

  # If compact report items array uses English keys in labels already Persian — also replace English leftovers in script strings
  $t = $t.Replace('["ماژول"', '["ماژول‌ها"')
  $t = $t.Replace("add(rows, \"modules\"", "add(rows, \"ماژول‌ها\"")
  $t = $t.Replace("add(rows, 'modules'", "add(rows, 'ماژول‌ها'")
  $t = $t.Replace('add(rows, "backups"', 'add(rows, "پشتیبان"')
  $t = $t.Replace('add(rows, "moduleRegistryCount"', 'add(rows, "ثبت ماژول"')
  $t = $t.Replace('add(rows, "publicExists"', 'add(rows, "پوشه عمومی"')

  [IO.File]::WriteAllText($path, $t, $utf8)
  Write-Host "OK $path"
}

Patch (Join-Path $root 'suite.html')
Patch (Join-Path $root 'server\public\suite.html')
Write-Host 'Done. Ctrl+Shift+R'
