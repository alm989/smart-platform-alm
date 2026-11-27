# Compact management report with visible fields; shrink Excel button; no page fill
# powershell -ExecutionPolicy Bypass -File .\server\scripts\apply-suite-report-compact.ps1
$ErrorActionPreference = 'Stop'
$root = 'D:\smart-platform-alm'
if (-not (Test-Path (Join-Path $root 'suite.html'))) {
  $root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
}
$utf8 = New-Object System.Text.UTF8Encoding $false

$css = @'

/* __sfReportCompact CSS */
#sfReportCard{
  position:fixed!important;left:8px!important;right:8px!important;bottom:42px!important;
  height:88px!important;max-height:88px!important;min-height:88px!important;
  overflow:hidden!important;padding:6px 10px!important;z-index:190!important;
  background:rgba(15,23,42,.98)!important;border:1px solid #334155!important;
  border-bottom:none!important;border-radius:10px 10px 0 0!important;
  box-sizing:border-box!important;transform:none!important;width:auto!important;max-width:none!important
}
#sfReportCard .sf-rep-head{
  display:flex!important;align-items:center!important;justify-content:space-between!important;
  gap:8px!important;margin-bottom:4px!important
}
#sfReportCard .sf-rep-head b{color:#7dd3fc!important;font-size:12px!important}
#sfRepRefresh{
  background:#0ea5e9!important;color:#fff!important;border:none!important;border-radius:6px!important;
  padding:2px 8px!important;font-size:11px!important;font-weight:700!important;cursor:pointer!important
}
#sfRepBody{height:54px!important;overflow:hidden!important}
#sfRepBody .sf-rep-grid{
  display:grid!important;
  grid-template-columns:repeat(8,minmax(0,1fr))!important;
  gap:4px!important;height:100%!important
}
#sfRepBody .sf-rep-cell{
  background:rgba(2,6,23,.6)!important;border:1px solid #1e293b!important;
  border-radius:6px!important;padding:3px 5px!important;min-width:0!important
}
#sfRepBody .sf-rep-cell .k{color:#64748b!important;font-size:9px!important;line-height:1.2!important}
#sfRepBody .sf-rep-cell .v{
  color:#e2e8f0!important;font-weight:700!important;font-size:11px!important;
  white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important
}
#sfExcelExportBtn,
button#sfExcelExportBtn,
a#sfExcelExportBtn{
  position:absolute!important;top:4px!important;left:90px!important;
  width:auto!important;max-width:140px!important;height:24px!important;
  padding:2px 8px!important;font-size:10px!important;line-height:1.2!important;
  border-radius:6px!important;margin:0!important;display:inline-flex!important;
  align-items:center!important;justify-content:center!important;
  background:#059669!important;color:#fff!important;border:none!important;
  z-index:2!important;box-shadow:none!important
}
#sfReportCard{position:fixed!important}
'@

$js = @'
<script>
/* __sfReportCompact — small fixed report with real fields */
(function () {
  if (window.__sfReportCompact) return;
  window.__sfReportCompact = true;

  function tok() {
    return sessionStorage.getItem("smart_suite_api_token") || "";
  }
  function fa(n) {
    try { return Number(n).toLocaleString("fa-IR"); } catch (e) { return String(n); }
  }
  function val(v) {
    if (v == null || v === "") return "—";
    if (typeof v === "number") return fa(v);
    if (typeof v === "boolean") return v ? "بله" : "خیر";
    if (Array.isArray(v)) return fa(v.length);
    if (typeof v === "object") {
      if (typeof v.count === "number") return fa(v.count);
      if (typeof v.total === "number") return fa(v.total);
      try { return fa(Object.keys(v).length); } catch (e) { return "—"; }
    }
    var s = String(v);
    if (s.length > 18 && /T\d{2}:/.test(s)) {
      // short ISO time
      try { return s.replace("T", " ").slice(0, 16); } catch (e2) { return s.slice(0, 16); }
    }
    return s;
  }

  function ensureCard() {
    var box = document.getElementById("sfReportCard");
    if (!box) {
      box = document.createElement("div");
      box.id = "sfReportCard";
      document.body.appendChild(box);
    }
    // kill huge children / old full-width buttons outside grid
    box.style.cssText =
      "position:fixed;left:8px;right:8px;bottom:42px;height:88px;max-height:88px;overflow:hidden;" +
      "padding:6px 10px;z-index:190;background:rgba(15,23,42,.98);border:1px solid #334155;" +
      "border-bottom:none;border-radius:10px 10px 0 0;box-sizing:border-box";
    if (!document.getElementById("sfRepBody") || !document.getElementById("sfRepRefresh")) {
      box.innerHTML =
        "<div class=\"sf-rep-head\">" +
        "<b>گزارش مدیریتی</b>" +
        "<div style=\"display:flex;gap:6px;align-items:center\">" +
        "<button type=\"button\" id=\"sfExcelExportBtn\" style=\"background:#059669;color:#fff;border:none;border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit\">خروجی CSV</button>" +
        "<button type=\"button\" id=\"sfRepRefresh\">بروزرسانی</button>" +
        "</div></div><div id=\"sfRepBody\"></div>";
    }
    var btn = document.getElementById("sfRepRefresh");
    if (btn) btn.onclick = load;
    var ex = document.getElementById("sfExcelExportBtn");
    if (ex && !ex._wired) {
      ex._wired = true;
      ex.onclick = function () {
        var t = tok();
        fetch("/api/reports/summary", { headers: t ? { Authorization: "Bearer " + t } : {} })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            var lines = ["key,value"];
            function put(k, v) { lines.push('"' + k + '","' + String(val(v)).replace(/"/g, "'") + '"'); }
            put("user", j.by || j.user);
            put("role", j.role);
            put("at", j.at || j.time);
            put("version", j.version);
            var tot = j.totals || {};
            Object.keys(tot).forEach(function (k) { put(k, tot[k]); });
            ["modules", "backups", "moduleRegistryCount"].forEach(function (k) { if (j[k] != null) put(k, j[k]); });
            var blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
            var a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "report-summary.csv";
            a.click();
          })
          .catch(function () { alert("خطا در خروجی"); });
      };
    }
    // shrink any other excel buttons left by old scripts
    document.querySelectorAll("button, a").forEach(function (b) {
      var tx = (b.textContent || "");
      if (/Excel|CSV|خروجی/i.test(tx) && b.id !== "sfExcelExportBtn") {
        if (b.closest && b.closest("#sfReportCard")) {
          b.style.maxWidth = "140px";
          b.style.width = "auto";
          b.style.height = "24px";
          b.style.padding = "2px 8px";
          b.style.fontSize = "10px";
        }
      }
    });
    return box;
  }

  function cell(k, v) {
    return "<div class=\"sf-rep-cell\"><div class=\"k\">" + k + "</div><div class=\"v\" title=\"" +
      String(v).replace(/"/g, "") + "\">" + v + "</div></div>";
  }

  function load() {
    ensureCard();
    var body = document.getElementById("sfRepBody");
    if (!body) return;
    body.innerHTML = "<div class=\"sf-rep-grid\">" + cell("…", "بارگذاری") + "</div>";
    var t = tok();
    var req = t
      ? fetch("/api/reports/summary", { headers: { Authorization: "Bearer " + t } })
      : Promise.reject(new Error("no-token"));
    req.then(function (r) {
      if (!r.ok) throw new Error("http");
      return r.json();
    }).catch(function () {
      return fetch("/api/health").then(function (r) { return r.json(); });
    }).then(function (j) {
      j = j || {};
      var tot = j.totals || {};
      var items = [
        ["کاربر", val(j.by || j.user)],
        ["نقش", val(j.role)],
        ["زمان", val(j.at || j.time)],
        ["نسخه", val(j.version)],
        ["ماژول", val(tot.modules != null ? tot.modules : j.modules)],
        ["پشتیبان", val(tot.backups != null ? tot.backups : j.backups)],
        ["کارتابل", val(tot.cartableItems != null ? tot.cartableItems : tot.cartable)],
        ["کاربران", val(tot.users != null ? tot.users : null)]
      ];
      // fill missing from flat health
      if (items[4][1] === "—" && j.moduleRegistryCount != null) items[4][1] = val(j.moduleRegistryCount);
      body.innerHTML = "<div class=\"sf-rep-grid\">" +
        items.map(function (x) { return cell(x[0], x[1]); }).join("") +
        "</div>";
    }).catch(function () {
      body.innerHTML = "<div class=\"sf-rep-grid\">" + cell("وضعیت", "خطا") + "</div>";
    });
  }

  function boot() {
    // disable older report rebuilders fighting us
    window.__sfReportCard2 = true;
    window.__sfReportCardFixed = true;
    ensureCard();
    load();
    setInterval(function () {
      ensureCard();
      // if body empty or plain text blob without grid, reload
      var body = document.getElementById("sfRepBody");
      if (body && !body.querySelector(".sf-rep-grid")) load();
    }, 2500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
</script>
'@

function Patch([string]$path) {
  if (-not (Test-Path $path)) { Write-Host "skip $path"; return }
  $t = [IO.File]::ReadAllText($path, $utf8)
  $t = [regex]::Replace($t, '(?s)/\* __sfReportCompact CSS \*/.*?(?=</style>)', '')
  $t = [regex]::Replace($t, '(?s)<script>\s*/\* __sfReportCompact[\s\S]*?</script>\s*', '')
  if ($t -match '</style>') { $t = $t.Replace('</style>', $css + "`r`n</style>") }
  if ($t -match '</body>') { $t = $t.Replace('</body>', $js + "`r`n</body>") }
  else { $t = $t + $js }
  [IO.File]::WriteAllText($path, $t, $utf8)
  Write-Host "OK $path"
}

Patch (Join-Path $root 'suite.html')
Patch (Join-Path $root 'server\public\suite.html')
Write-Host 'Done. Ctrl+Shift+R'
