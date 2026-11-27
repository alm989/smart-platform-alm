# Final suite bottom layout: one dock row + compact report above; no overlap; fix [object Object]
# powershell -ExecutionPolicy Bypass -File .\server\scripts\apply-suite-dock-final.ps1
$ErrorActionPreference = 'Stop'
$root = 'D:\smart-platform-alm'
if (-not (Test-Path (Join-Path $root 'suite.html'))) {
  $root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
}
$utf8 = New-Object System.Text.UTF8Encoding $false

$css = @'

/* __sfSuiteDockFinal CSS */
#sfBottomDock{
  position:fixed!important;bottom:0!important;left:0!important;right:0!important;
  height:42px!important;z-index:200!important;
  display:flex!important;align-items:center!important;justify-content:space-between!important;
  gap:8px!important;padding:0 12px!important;box-sizing:border-box!important;
  background:rgba(2,6,23,.96)!important;border-top:1px solid #334155!important;
  direction:rtl!important;font-family:Tahoma,sans-serif!important
}
#sfBottomDock .slot{display:flex!important;align-items:center!important;gap:8px!important;min-width:0}
#sfBottomDock .slot-r{flex:1;justify-content:flex-start}
#sfBottomDock .slot-c{flex:1.6;justify-content:center}
#sfBottomDock .slot-l{flex:1;justify-content:flex-end}
#sfBottomDock #sfSyncChip,
#sfBottomDock #sfRoleChip,
#sfBottomDock #suiteJwtBar,
#sfBottomDock #sfOfflineFxBar,
#sfBottomDock #gearBtn{
  position:static!important;transform:none!important;left:auto!important;right:auto!important;
  bottom:auto!important;top:auto!important;margin:0!important
}
#sfBottomDock #sfSyncChip{
  pointer-events:none!important;white-space:nowrap!important;font-size:11px!important;
  background:rgba(15,23,42,.95)!important;border:1px solid #334155!important;
  border-radius:8px!important;padding:4px 10px!important;color:#e2e8f0!important
}
#sfBottomDock #suiteJwtBar{
  display:flex!important;align-items:center!important;gap:8px!important;
  position:static!important;background:transparent!important;border:none!important;
  box-shadow:none!important;padding:0!important;font-size:11px!important;color:#e2e8f0!important
}
#sfBottomDock #gearBtn{
  display:grid!important;place-items:center!important;width:34px!important;height:34px!important;
  border-radius:50%!important;border:1px solid #334155!important;background:#1e293b!important;
  font-size:1rem!important;cursor:pointer!important;box-shadow:none!important
}
#sfBottomDock #sfOfflineFxFlush{
  background:#0f766e!important;color:#fff!important;border:none!important;border-radius:8px!important;
  padding:4px 10px!important;font-size:11px!important;font-weight:700!important;cursor:pointer!important
}
#sfReportCard{
  position:fixed!important;left:8px!important;right:8px!important;bottom:42px!important;
  height:110px!important;max-height:110px!important;overflow:auto!important;
  width:auto!important;max-width:none!important;transform:none!important;
  margin:0!important;padding:6px 10px!important;z-index:190!important;
  border-radius:10px 10px 0 0!important;border:1px solid #334155!important;border-bottom:none!important;
  background:rgba(15,23,42,.97)!important;box-sizing:border-box!important;
  box-shadow:0 -4px 16px rgba(0,0,0,.25)!important
}
#sfReportCard > div:first-child{margin-bottom:4px!important}
#sfReportCard b{font-size:.75rem!important}
#sfRepRefresh{padding:3px 8px!important;font-size:.65rem!important}
#sfRepBody{font-size:.65rem!important}
#sfRepBody .sf-rep-grid{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(110px,1fr))!important;gap:4px!important}
#sfRepBody .sf-rep-cell{background:rgba(2,6,23,.55)!important;border:1px solid #1e293b!important;border-radius:8px!important;padding:4px 6px!important}
#sfRepBody .sf-rep-cell .k{color:#64748b!important;font-size:.58rem!important}
#sfRepBody .sf-rep-cell .v{color:#e2e8f0!important;font-weight:700!important;font-size:.68rem!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
body.sf-dock-pad{padding-bottom:160px!important}
.settings-panel{bottom:50px!important;left:12px!important}
.gear-btn{display:none!important}
.gear-btn.show{display:none!important}
#sfBottomDock #gearBtn.show,#sfBottomDock #gearBtn{display:grid!important}
'@

$js = @'
<script>
/* __sfSuiteDockFinal */
(function () {
  if (window.__sfSuiteDockFinal) return;
  window.__sfSuiteDockFinal = true;

  function ensureDock() {
    var dock = document.getElementById("sfBottomDock");
    if (!dock) {
      dock = document.createElement("div");
      dock.id = "sfBottomDock";
      // RTL flex: first visual on the right
      dock.innerHTML =
        '<div class="slot slot-r" data-s="sync"></div>' +
        '<div class="slot slot-c" data-s="role"></div>' +
        '<div class="slot slot-l" data-s="tools"></div>';
      document.body.appendChild(dock);
    }
    document.body.classList.add("sf-dock-pad");
    return dock;
  }

  function move(slot, el) {
    if (!slot || !el) return;
    if (el.parentElement !== slot) slot.appendChild(el);
    el.style.position = "static";
    el.style.left = el.style.right = el.style.top = el.style.bottom = "auto";
    el.style.transform = "none";
  }

  function place() {
    var dock = ensureDock();
    var sSync = dock.querySelector('[data-s="sync"]');
    var sRole = dock.querySelector('[data-s="role"]');
    var sTools = dock.querySelector('[data-s="tools"]');

    var sync = document.getElementById("sfSyncChip");
    var jwt = document.getElementById("suiteJwtBar");
    var roleChip = document.getElementById("sfRoleChip");
    var off = document.getElementById("sfOfflineFxBar");
    var gear = document.getElementById("gearBtn");

    // Prefer JWT bar (has logout). Hide duplicate role chip.
    if (roleChip && jwt) roleChip.style.display = "none";

    move(sSync, sync);
    if (jwt) {
      move(sRole, jwt);
      jwt.style.display = "flex";
    } else if (roleChip) {
      roleChip.style.display = "";
      move(sRole, roleChip);
    }

    if (!off) {
      off = document.createElement("div");
      off.id = "sfOfflineFxBar";
      off.style.display = "flex";
      off.style.gap = "6px";
      off.style.alignItems = "center";
    }
    move(sTools, off);
    if (gear) {
      gear.classList.add("show");
      move(sTools, gear);
    }

    var rep = document.getElementById("sfReportCard");
    if (rep) {
      if (rep.parentElement !== document.body) document.body.appendChild(rep);
      rep.style.position = "fixed";
      rep.style.left = "8px";
      rep.style.right = "8px";
      rep.style.bottom = "42px";
      rep.style.height = "110px";
      rep.style.maxHeight = "110px";
      rep.style.overflow = "auto";
      rep.style.zIndex = "190";
      rep.style.transform = "none";
      rep.style.width = "auto";
      rep.style.maxWidth = "none";
    }
  }

  // Fix report renderer: never show [object Object]
  function fmtVal(v) {
    if (v == null) return "";
    if (typeof v === "number") {
      try { return v.toLocaleString("fa-IR"); } catch (e) { return String(v); }
    }
    if (typeof v === "boolean") return v ? "بله" : "خیر";
    if (Array.isArray(v)) return String(v.length);
    if (typeof v === "object") {
      if (typeof v.count === "number") return String(v.count);
      if (typeof v.total === "number") return String(v.total);
      if (typeof v.length === "number") return String(v.length);
      try {
        var keys = Object.keys(v);
        if (keys.length <= 4) {
          return keys.map(function (k) {
            var x = v[k];
            if (x != null && typeof x !== "object") return k + ":" + x;
            return null;
          }).filter(Boolean).join(" | ") || String(keys.length);
        }
        return String(keys.length);
      } catch (e2) { return "-"; }
    }
    return String(v);
  }

  function patchReportRender() {
    // override by replacing load path render after card exists
    window.__sfReportFormat = fmtVal;
    var body = document.getElementById("sfRepBody");
    if (!body) return;
    // if already polluted with object Object, force refresh once
    if (/object Object/i.test(body.textContent || "")) {
      var btn = document.getElementById("sfRepRefresh");
      if (btn) btn.click();
    }
  }

  // Monkey-patch ensure: wrap fetch render if possible by observing sfRepBody
  var origFetch = window.fetch;
  // Safer: redefine render via interval by intercepting card HTML build
  function enhanceReportHtml() {
    var body = document.getElementById("sfRepBody");
    if (!body) return;
    // Convert any remaining [object Object] text cells if structure is grid of labels
    body.querySelectorAll("div").forEach(function (el) {
      if (/\[object Object\]/i.test(el.textContent || "")) {
        el.textContent = (el.textContent || "").replace(/\[object Object\]/gi, "-");
      }
    });
  }

  // Replace report render function by reinstalling compact card
  function installBetterReport() {
    if (window.__sfReportCardFixed) return;
    window.__sfReportCardFixed = true;
    function tok() { return sessionStorage.getItem("smart_suite_api_token") || ""; }
    function ensure() {
      var box = document.getElementById("sfReportCard");
      if (!box) {
        box = document.createElement("div");
        box.id = "sfReportCard";
        document.body.appendChild(box);
      }
      box.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
        '<b style="color:#7dd3fc">گزارش مدیریتی</b>' +
        '<button type="button" id="sfRepRefresh" style="background:#0ea5e9;color:#fff;border:none;border-radius:8px;padding:3px 8px;font-weight:700;cursor:pointer;font-family:inherit;font-size:11px">بروزرسانی</button>' +
        '</div><div id="sfRepBody" style="margin-top:4px">…</div>';
      document.getElementById("sfRepRefresh").onclick = load;
      return box;
    }
    function load() {
      ensure();
      var body = document.getElementById("sfRepBody");
      body.textContent = "در حال بارگذاری…";
      var t = tok();
      var p = t
        ? fetch("/api/reports/summary", { headers: { Authorization: "Bearer " + t } })
        : Promise.reject();
      p.then(function (r) { if (!r.ok) throw new Error("x"); return r.json(); })
        .catch(function () { return fetch("/api/health").then(function (r) { return r.json(); }); })
        .then(function (j) {
          var rows = [];
          function add(k, v) {
            if (v == null || v === "") return;
            if (typeof v === "object") v = fmtVal(v);
            else if (typeof v === "number") v = fmtVal(v);
            rows.push([k, v]);
          }
          add("کاربر", j.by || j.user);
          add("نقش", j.role);
          add("زمان", j.at || j.time);
          add("نسخه", j.version);
          add("auth", j.auth);
          var tot = j.totals || {};
          Object.keys(tot).forEach(function (k) { add(k, tot[k]); });
          ["modules", "backups", "moduleRegistryCount", "publicExists"].forEach(function (k) {
            if (j[k] != null && typeof j[k] !== "object") add(k, j[k]);
            else if (j[k] != null) add(k, fmtVal(j[k]));
          });
          body.innerHTML = '<div class="sf-rep-grid">' + rows.map(function (r) {
            return '<div class="sf-rep-cell"><div class="k">' + r[0] + '</div><div class="v">' + r[1] + '</div></div>';
          }).join("") + '</div>';
        })
        .catch(function () {
          body.textContent = "خطا در دریافت گزارش";
        });
    }
    ensure();
    load();
  }

  function boot() {
    place();
    installBetterReport();
    place();
    setInterval(function () { place(); enhanceReportHtml(); }, 1000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
</script>
'@

function Patch-Suite([string]$path) {
  if (-not (Test-Path $path)) { Write-Host "skip $path"; return }
  $t = [IO.File]::ReadAllText($path, $utf8)
  # strip older dock CSS/JS
  $t = [regex]::Replace($t, '(?s)/\* __sfSuiteLayoutDock CSS \*/.*?(?=</style>)', '')
  $t = [regex]::Replace($t, '(?s)/\* __sfSuiteBottomDockRow CSS \*/.*?(?=</style>)', '')
  $t = [regex]::Replace($t, '(?s)/\* __sfSuiteDockFinal CSS \*/.*?(?=</style>)', '')
  $t = [regex]::Replace($t, '(?s)<script>\s*/\* __sfSuiteLayoutDock[\s\S]*?</script>\s*', '')
  $t = [regex]::Replace($t, '(?s)<script>\s*/\* __sfSuiteBottomDockRow[\s\S]*?</script>\s*', '')
  $t = [regex]::Replace($t, '(?s)<script>\s*/\* __sfSuiteDockFinal[\s\S]*?</script>\s*', '')
  if ($t -match '</style>') { $t = $t.Replace('</style>', $css + "`r`n</style>") }
  if ($t -match '</body>') { $t = $t.Replace('</body>', $js + "`r`n</body>") }
  else { $t = $t + $js }
  [IO.File]::WriteAllText($path, $t, $utf8)
  Write-Host "OK $path"
}

Patch-Suite (Join-Path $root 'suite.html')
Patch-Suite (Join-Path $root 'server\public\suite.html')

# jwt gate: default bar not fixed top so dock can own it
@('suite-jwt-gate.js', 'server\public\suite-jwt-gate.js') | ForEach-Object {
  $p = Join-Path $root $_
  if (-not (Test-Path $p)) { return }
  $t = [IO.File]::ReadAllText($p, $utf8)
  $t2 = $t -replace 'position:\s*fixed;\s*top:\s*\d+px;\s*right:\s*\d+px', 'position:static'
  $t2 = $t2 -replace 'position:fixed;top:10px;right:10px', 'position:static'
  # common pattern in file
  $t2 = $t2 -replace 'bar\.style\.cssText\s*=\s*"[^"]*position:fixed[^"]*"',
    'bar.style.cssText="display:flex;align-items:center;gap:8px;font:11px Tahoma,sans-serif;color:#e2e8f0"'
  if ($t2 -ne $t) {
    [IO.File]::WriteAllText($p, $t2, $utf8)
    Write-Host "OK $_ jwt bar static"
  } else {
    # inject id suiteJwtBar if missing and force static via appended note — try replace position fixed in create
    if ($t -match 'suiteJwtBar' -and $t -match 'position:fixed') {
      $t3 = $t.Replace('position:fixed', 'position:static')
      [IO.File]::WriteAllText($p, $t3, $utf8)
      Write-Host "OK $_ fixed->static"
    } else {
      Write-Host "note $_ (check manually if bar still top)"
    }
  }
}

Write-Host 'Done. COPY-MODULES + hard refresh suite.html'
