# Fix mojibake report labels (unicode-only) + CSV button size match refresh
# powershell -ExecutionPolicy Bypass -File .\server\scripts\apply-suite-report-fa-fix.ps1
$ErrorActionPreference = 'Stop'
$root = 'D:\smart-platform-alm'
if (-not (Test-Path (Join-Path $root 'suite.html'))) {
  $root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
}
$utf8 = New-Object System.Text.UTF8Encoding $true  # BOM helps some Windows tools

$block = @'
<script>
/* __sfReportFaFix2 — Persian labels only via \u escapes (no mojibake) */
(function () {
  if (window.__sfReportFaFix2) return;
  window.__sfReportFaFix2 = true;

  // All Persian via unicode escapes — safe in any file encoding
  var L = {
    title: "\u06AF\u0632\u0627\u0631\u0634 \u0645\u062F\u06CC\u0631\u06CC\u062A\u06CC",
    refresh: "\u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC",
    csv: "\u062E\u0631\u0648\u062C\u06CC CSV",
    user: "\u06A9\u0627\u0631\u0628\u0631",
    role: "\u0646\u0642\u0634",
    time: "\u0632\u0645\u0627\u0646",
    version: "\u0646\u0633\u062E\u0647",
    modules: "\u0645\u0627\u0698\u0648\u0644\u200C\u0647\u0627",
    backups: "\u067E\u0634\u062A\u06CC\u0628\u0627\u0646",
    cartable: "\u06A9\u0627\u0631\u062A\u0627\u0628\u0644",
    users: "\u06A9\u0627\u0631\u0628\u0631\u0627\u0646",
    loading: "\u0628\u0627\u0631\u06AF\u0630\u0627\u0631\u06CC",
    error: "\u062E\u0637\u0627"
  };

  function tok() {
    return sessionStorage.getItem("smart_suite_api_token") || "";
  }
  function faNum(n) {
    if (n == null || n === "") return "\u2014";
    try { return Number(n).toLocaleString("fa-IR"); } catch (e) { return String(n); }
  }
  function shortTime(s) {
    if (!s) return "\u2014";
    s = String(s);
    if (/T\d{2}:/.test(s)) return s.replace("T", " ").replace(/\.\d+Z?$/, "").slice(0, 16);
    return s.length > 20 ? s.slice(0, 16) : s;
  }
  function pick(j) {
    j = j || {};
    var t = j.totals || {};
    function n() {
      for (var i = 0; i < arguments.length; i++) {
        var v = arguments[i];
        if (v != null && v !== "" && typeof v !== "object") return v;
        if (typeof v === "object" && v && typeof v.count === "number") return v.count;
      }
      return null;
    }
    return [
      [L.user, j.by || j.user || "\u2014"],
      [L.role, j.role || "\u2014"],
      [L.time, shortTime(j.at || j.time)],
      [L.version, j.version || "\u2014"],
      [L.modules, faNum(n(t.modules, j.modules, j.moduleRegistryCount))],
      [L.backups, faNum(n(t.backups, j.backups))],
      [L.cartable, faNum(n(t.cartableItems, t.cartable, j.cartableItems))],
      [L.users, faNum(n(t.users, j.users))]
    ];
  }

  function styleBtn(el, bg) {
    if (!el) return;
    el.style.cssText =
      "background:" + bg + ";color:#fff;border:none;border-radius:8px;" +
      "padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;" +
      "font-family:Tahoma,sans-serif;height:28px;min-width:88px;" +
      "display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box";
  }

  function ensure() {
    var box = document.getElementById("sfReportCard");
    if (!box) {
      box = document.createElement("div");
      box.id = "sfReportCard";
      document.body.appendChild(box);
    }
    box.style.cssText =
      "position:fixed;left:8px;right:8px;bottom:42px;height:88px;max-height:88px;" +
      "overflow:hidden;padding:6px 10px;z-index:190;box-sizing:border-box;" +
      "background:rgba(15,23,42,.98);border:1px solid #334155;border-bottom:none;" +
      "border-radius:10px 10px 0 0;font-family:Tahoma,sans-serif;direction:rtl";

    box.innerHTML =
      "<div style=\"display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px\">" +
      "<b style=\"color:#7dd3fc;font-size:12px\">" + L.title + "</b>" +
      "<div style=\"display:flex;gap:8px;align-items:center\">" +
      "<button type=\"button\" id=\"sfExcelExportBtn\"></button>" +
      "<button type=\"button\" id=\"sfRepRefresh\"></button>" +
      "</div></div>" +
      "<div id=\"sfRepBody\" style=\"height:50px;overflow:hidden\"></div>";

    var bCsv = document.getElementById("sfExcelExportBtn");
    var bRef = document.getElementById("sfRepRefresh");
    if (bCsv) { bCsv.textContent = L.csv; styleBtn(bCsv, "#059669"); bCsv.onclick = exportCsv; }
    if (bRef) { bRef.textContent = L.refresh; styleBtn(bRef, "#0ea5e9"); bRef.onclick = load; }

    // remove competing huge excel buttons
    document.querySelectorAll("button,a").forEach(function (b) {
      if (b.id === "sfExcelExportBtn" || b.id === "sfRepRefresh") return;
      var tx = (b.textContent || "");
      if (/Excel|CSV|\u062E\u0631\u0648\u062C\u06CC/i.test(tx) && b.closest && b.closest("#sfReportCard")) {
        b.style.display = "none";
      }
    });
    return box;
  }

  function cell(k, v) {
    return "<div style=\"background:rgba(2,6,23,.55);border:1px solid #1e293b;border-radius:6px;" +
      "padding:3px 5px;min-width:0\">" +
      "<div style=\"color:#94a3b8;font-size:10px;line-height:1.2\">" + k + "</div>" +
      "<div style=\"color:#e2e8f0;font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden;" +
      "text-overflow:ellipsis\" title=\"" + String(v).replace(/"/g, "") + "\">" + v + "</div></div>";
  }

  function render(j) {
    var body = document.getElementById("sfRepBody");
    if (!body) return;
    var rows = pick(j);
    body.innerHTML =
      "<div style=\"display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px;height:100%\">" +
      rows.map(function (r) { return cell(r[0], r[1]); }).join("") +
      "</div>";
  }

  function load() {
    ensure();
    var body = document.getElementById("sfRepBody");
    if (body) body.innerHTML = "<div style=\"color:#94a3b8;font-size:11px;padding:6px\">" + L.loading + "\u2026</div>";
    var t = tok();
    var p = t
      ? fetch("/api/reports/summary", { headers: { Authorization: "Bearer " + t } })
      : Promise.reject();
    p.then(function (r) {
      if (!r.ok) throw new Error("http");
      return r.json();
    }).catch(function () {
      return fetch("/api/health").then(function (r) { return r.json(); });
    }).then(render).catch(function () {
      if (body) body.innerHTML = "<div style=\"color:#fca5a5;font-size:11px\">" + L.error + "</div>";
    });
  }

  function exportCsv() {
    var t = tok();
    fetch("/api/reports/summary", { headers: t ? { Authorization: "Bearer " + t } : {} })
      .then(function (r) { return r.json(); })
      .catch(function () { return fetch("/api/health").then(function (r) { return r.json(); }); })
      .then(function (j) {
        var rows = pick(j);
        var lines = ["\ufeff" + "\u0639\u0646\u0648\u0627\u0646,\u0645\u0642\u062F\u0627\u0631"];
        rows.forEach(function (r) {
          lines.push('"' + r[0] + '","' + String(r[1]).replace(/"/g, "'") + '"');
        });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
        a.download = "report.csv";
        a.click();
      });
  }

  // Disable older report painters that cause mojibake / English keys
  window.__sfReportCard2 = true;
  window.__sfReportCardFixed = true;
  window.__sfReportCompact = true;
  window.__sfReportFaLabels = true;

  function boot() {
    ensure();
    load();
    setInterval(function () {
      var body = document.getElementById("sfRepBody");
      // if missing grid or labels look like broken sequences, rebuild
      if (!body || !body.querySelector("div")) load();
      else ensure(); // keep buttons sized
    }, 3000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
</script>
'@

function Patch([string]$path) {
  if (-not (Test-Path $path)) { Write-Host "skip $path"; return }
  $t = [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)
  # remove previous fa-fix / compact competing if we fully replace behavior via flag
  $t = [regex]::Replace($t, '(?s)<script>\s*/\* __sfReportFaFix2[\s\S]*?</script>\s*', '')
  if ($t -match '</body>') { $t = $t.Replace('</body>', $block + "`r`n</body>") }
  else { $t = $t + $block }
  [IO.File]::WriteAllText($path, $t, $utf8)
  Write-Host "OK $path"
}

Patch (Join-Path $root 'suite.html')
Patch (Join-Path $root 'server\public\suite.html')
Write-Host 'Done. COPY-MODULES + Ctrl+Shift+R'
