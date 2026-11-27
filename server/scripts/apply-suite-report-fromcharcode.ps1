# Bulletproof Persian labels (fromCharCode) + stop report flicker + charset
# powershell -ExecutionPolicy Bypass -File .\server\scripts\apply-suite-report-fromcharcode.ps1
$ErrorActionPreference = 'Stop'
$root = 'D:\smart-platform-alm'
if (-not (Test-Path (Join-Path $root 'suite.html'))) {
  $root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
}
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

# Pure ASCII script — Persian only via fromCharCode numbers
$block = @'
<script>
/* __sfReportFromChar */
(function () {
  if (window.__sfReportFromChar) return;
  window.__sfReportFromChar = true;

  function u() {
    var a = arguments, s = "", i;
    for (i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return s;
  }
  // Persian labels (code points only — encoding-proof)
  var L = {
    title: u(0x6AF,0x632,0x627,0x631,0x634,0x20,0x645,0x62F,0x6CC,0x631,0x6CC,0x62A,0x6CC),
    refresh: u(0x628,0x631,0x648,0x632,0x631,0x633,0x627,0x646,0x6CC),
    csv: u(0x62E,0x631,0x648,0x62C,0x6CC,0x20) + "CSV",
    user: u(0x6A9,0x627,0x631,0x628,0x631),
    role: u(0x646,0x642,0x634),
    time: u(0x632,0x645,0x627,0x646),
    version: u(0x646,0x633,0x62E,0x647),
    modules: u(0x645,0x627,0x698,0x648,0x644,0x200C,0x647,0x627),
    backups: u(0x67E,0x634,0x62A,0x6CC,0x628,0x627,0x646),
    cartable: u(0x6A9,0x627,0x631,0x62A,0x627,0x628,0x644),
    users: u(0x6A9,0x627,0x631,0x628,0x631,0x627,0x646),
    loading: u(0x628,0x627,0x631,0x6AF,0x630,0x627,0x631,0x6CC),
    error: u(0x62E,0x637,0x627),
    dash: "-"
  };

  function tok() { return sessionStorage.getItem("smart_suite_api_token") || ""; }
  function faNum(n) {
    if (n == null || n === "") return L.dash;
    try { return Number(n).toLocaleString("fa-IR"); } catch (e) { return String(n); }
  }
  function shortTime(s) {
    if (!s) return L.dash;
    s = String(s);
    if (/T\d{2}:/.test(s)) return s.replace("T", " ").replace(/\.\d+Z?$/, "").slice(0, 16);
    return s.length > 20 ? s.slice(0, 16) : s;
  }
  function num() {
    for (var i = 0; i < arguments.length; i++) {
      var v = arguments[i];
      if (v == null || v === "") continue;
      if (typeof v === "number") return v;
      if (typeof v !== "object") { var n = Number(v); if (isFinite(n)) return n; return v; }
      if (typeof v.count === "number") return v.count;
    }
    return null;
  }
  function rowsFrom(j) {
    j = j || {};
    var t = j.totals || {};
    return [
      [L.user, j.by || j.user || L.dash],
      [L.role, j.role || L.dash],
      [L.time, shortTime(j.at || j.time)],
      [L.version, j.version || L.dash],
      [L.modules, faNum(num(t.modules, j.modules, j.moduleRegistryCount))],
      [L.backups, faNum(num(t.backups, j.backups))],
      [L.cartable, faNum(num(t.cartableItems, t.cartable, j.cartableItems))],
      [L.users, faNum(num(t.users, j.users))]
    ];
  }

  function styleBtn(el, bg) {
    el.style.background = bg;
    el.style.color = "#fff";
    el.style.border = "none";
    el.style.borderRadius = "8px";
    el.style.padding = "4px 14px";
    el.style.fontSize = "11px";
    el.style.fontWeight = "700";
    el.style.cursor = "pointer";
    el.style.fontFamily = "Tahoma,sans-serif";
    el.style.height = "28px";
    el.style.minWidth = "96px";
    el.style.display = "inline-flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.boxSizing = "border-box";
    el.style.lineHeight = "1";
  }

  var built = false;
  function ensure() {
    var box = document.getElementById("sfReportCard");
    if (!box) {
      box = document.createElement("div");
      box.id = "sfReportCard";
      document.body.appendChild(box);
    }
    box.style.position = "fixed";
    box.style.left = "8px";
    box.style.right = "8px";
    box.style.bottom = "42px";
    box.style.height = "88px";
    box.style.maxHeight = "88px";
    box.style.overflow = "hidden";
    box.style.padding = "6px 10px";
    box.style.zIndex = "190";
    box.style.boxSizing = "border-box";
    box.style.background = "rgba(15,23,42,.98)";
    box.style.border = "1px solid #334155";
    box.style.borderBottom = "none";
    box.style.borderRadius = "10px 10px 0 0";
    box.style.fontFamily = "Tahoma,sans-serif";
    box.style.direction = "rtl";

    if (!built || !document.getElementById("sfRepBody") || !document.getElementById("sfRepRefresh")) {
      box.innerHTML = "";
      var head = document.createElement("div");
      head.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px";
      var title = document.createElement("b");
      title.style.color = "#7dd3fc";
      title.style.fontSize = "12px";
      title.textContent = L.title;
      var actions = document.createElement("div");
      actions.style.cssText = "display:flex;gap:8px;align-items:center";
      var bCsv = document.createElement("button");
      bCsv.type = "button";
      bCsv.id = "sfExcelExportBtn";
      bCsv.textContent = L.csv;
      styleBtn(bCsv, "#059669");
      bCsv.onclick = exportCsv;
      var bRef = document.createElement("button");
      bRef.type = "button";
      bRef.id = "sfRepRefresh";
      bRef.textContent = L.refresh;
      styleBtn(bRef, "#0ea5e9");
      bRef.onclick = load;
      actions.appendChild(bCsv);
      actions.appendChild(bRef);
      head.appendChild(title);
      head.appendChild(actions);
      var body = document.createElement("div");
      body.id = "sfRepBody";
      body.style.height = "50px";
      body.style.overflow = "hidden";
      box.appendChild(head);
      box.appendChild(body);
      built = true;
    } else {
      // only restyle buttons — do not rebuild (prevents flicker)
      var bCsv2 = document.getElementById("sfExcelExportBtn");
      var bRef2 = document.getElementById("sfRepRefresh");
      if (bCsv2) { bCsv2.textContent = L.csv; styleBtn(bCsv2, "#059669"); }
      if (bRef2) { bRef2.textContent = L.refresh; styleBtn(bRef2, "#0ea5e9"); }
    }
    return box;
  }

  function paint(j) {
    var body = document.getElementById("sfRepBody");
    if (!body) return;
    body.innerHTML = "";
    var grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px;height:100%";
    rowsFrom(j).forEach(function (r) {
      var cell = document.createElement("div");
      cell.style.cssText = "background:rgba(2,6,23,.55);border:1px solid #1e293b;border-radius:6px;padding:3px 5px;min-width:0";
      var k = document.createElement("div");
      k.style.cssText = "color:#94a3b8;font-size:10px;line-height:1.2";
      k.textContent = r[0];
      var v = document.createElement("div");
      v.style.cssText = "color:#e2e8f0;font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
      v.textContent = String(r[1]);
      v.title = String(r[1]);
      cell.appendChild(k);
      cell.appendChild(v);
      grid.appendChild(cell);
    });
    body.appendChild(grid);
  }

  var loading = false;
  function load() {
    if (loading) return;
    loading = true;
    ensure();
    var body = document.getElementById("sfRepBody");
    if (body && !body.querySelector("[data-ok]")) {
      body.textContent = L.loading + "...";
    }
    var t = tok();
    var p = t
      ? fetch("/api/reports/summary", { headers: { Authorization: "Bearer " + t } })
      : Promise.reject();
    p.then(function (r) {
      if (!r.ok) throw new Error("http");
      return r.json();
    }).catch(function () {
      return fetch("/api/health").then(function (r) { return r.json(); });
    }).then(function (j) {
      paint(j);
      var body2 = document.getElementById("sfRepBody");
      if (body2) body2.setAttribute("data-ok", "1");
    }).catch(function () {
      var body3 = document.getElementById("sfRepBody");
      if (body3) body3.textContent = L.error;
    }).then(function () { loading = false; });
  }

  function exportCsv() {
    var t = tok();
    fetch("/api/reports/summary", { headers: t ? { Authorization: "Bearer " + t } : {} })
      .then(function (r) { return r.json(); })
      .catch(function () { return fetch("/api/health").then(function (r) { return r.json(); }); })
      .then(function (j) {
        var rows = rowsFrom(j);
        var lines = ["\ufeff" + L.title];
        rows.forEach(function (r) {
          lines.push('"' + r[0] + '","' + String(r[1]).replace(/"/g, "'") + '"');
        });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
        a.download = "report.csv";
        a.click();
      });
  }

  // Kill older report scripts' intervals by claiming flags
  window.__sfReportCard2 = true;
  window.__sfReportCardFixed = true;
  window.__sfReportCompact = true;
  window.__sfReportFaLabels = true;
  window.__sfReportFaFix2 = true;

  function boot() {
    // force charset if missing
    if (!document.querySelector("meta[charset]")) {
      var m = document.createElement("meta");
      m.setAttribute("charset", "utf-8");
      if (document.head) document.head.insertBefore(m, document.head.firstChild);
    }
    ensure();
    load();
    // soft keep-alive: only restyle, reload data every 60s not 3s
    setInterval(function () { ensure(); }, 5000);
    setInterval(function () { load(); }, 60000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
</script>
'@

function Patch([string]$path) {
  if (-not (Test-Path $path)) { Write-Host "skip $path"; return }
  $t = [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)
  # charset in head
  if ($t -notmatch 'charset\s*=\s*["'']?utf-8') {
    if ($t -match '<head>') {
      $t = $t.Replace('<head>', "<head>`r`n<meta charset=`"utf-8`">")
    }
  }
  $t = [regex]::Replace($t, '(?s)<script>\s*/\* __sfReportFromChar[\s\S]*?</script>\s*', '')
  if ($t -match '</body>') { $t = $t.Replace('</body>', $block + "`r`n</body>") }
  else { $t = $t + $block }
  [IO.File]::WriteAllText($path, $t, $utf8NoBom)
  Write-Host "OK $path"
}

Patch (Join-Path $root 'suite.html')
Patch (Join-Path $root 'server\public\suite.html')
Write-Host 'Done. COPY-MODULES + hard refresh (Ctrl+F5)'
