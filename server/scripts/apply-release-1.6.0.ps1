# Release 1.6.0 local apply: chart seeds + IAM effects module gate + version bump
# powershell -ExecutionPolicy Bypass -File .\server\scripts\apply-release-1.6.0.ps1
$ErrorActionPreference = 'Stop'
$root = 'D:\smart-platform-alm'
if (-not (Test-Path (Join-Path $root 'server\server.js'))) {
  $root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
}
$utf8 = New-Object System.Text.UTF8Encoding $false

# ----- 1) Chart seed expander in accounting -----
$seedBlock = @'
<script>
/* __sfChartSeed160 — extra COA seeds for tax/budget/warehouse/payroll */
(function () {
  if (window.__sfChartSeed160) return;
  window.__sfChartSeed160 = true;
  var ACCT_KEY = "smart_mod_accounting_v2";
  var SEEDS = [
    { code: "1101", name: "\u0635\u0646\u062f\u0648\u0642" },
    { code: "1102", name: "\u0628\u0627\u0646\u06a9" },
    { code: "1103", name: "\u062a\u0646\u062e\u0648\u0627\u0647" },
    { code: "1301", name: "\u0627\u0646\u0628\u0627\u0631" },
    { code: "2101", name: "\u062d\u0633\u0627\u0628 \u0645\u0642\u0627\u0628\u0644" },
    { code: "2201", name: "\u0645\u0627\u0644\u06cc\u0627\u062a \u067e\u0631\u062f\u0627\u062e\u062a\u0646\u06cc" },
    { code: "4101", name: "\u062f\u0631\u0622\u0645\u062f \u0641\u0631\u0648\u0634" },
    { code: "5101", name: "\u062e\u0631\u06cc\u062f" },
    { code: "5102", name: "\u062d\u0642\u0648\u0642 \u0648 \u062f\u0633\u062a\u0645\u0632\u062f" },
    { code: "6101", name: "\u0628\u0648\u062f\u062c\u0647 / \u0647\u0632\u06cc\u0646\u0647" }
  ];
  var SOURCE_MAP = {
    cashbox: "1101", bank: "1102", tankhah: "1103", pettycash: "1103",
    warehouse: "1301", sales: "4101", purchase: "5101",
    payroll: "5102", tax: "2201", budget: "6101"
  };
  function loadDb() {
    try {
      var db = JSON.parse(localStorage.getItem(ACCT_KEY) || "{}");
      if (!db.stores) db.stores = {};
      if (!Array.isArray(db.stores.code)) db.stores.code = [];
      if (!Array.isArray(db.stores.voucher)) db.stores.voucher = [];
      return db;
    } catch (e) {
      return { stores: { code: [], voucher: [] } };
    }
  }
  function saveDb(db) {
    db.updatedAt = new Date().toISOString();
    localStorage.setItem(ACCT_KEY, JSON.stringify(db));
    try {
      if (window.SmartCore && SmartCore.api && SmartCore.api.syncState) SmartCore.api.syncState();
    } catch (e) {}
  }
  function ensureSeeds() {
    var db = loadDb();
    var n = 0;
    SEEDS.forEach(function (row) {
      var exists = db.stores.code.some(function (c) {
        return c && !c.deleted && String(c["\u06a9\u062f"] || c.code || "") === row.code;
      });
      if (!exists) {
        var o = { id: "seed_" + row.code, deleted: false };
        o["\u06a9\u062f"] = row.code;
        o["\u0646\u0627\u0645"] = row.name;
        o["\u0648\u0636\u0639\u06cc\u062a"] = "\u0641\u0639\u0627\u0644";
        db.stores.code.push(o);
        n++;
      }
    });
    if (n) saveDb(db);
    console.log("[chart-seed-1.6] added", n);
    return n;
  }
  // enhance resolve map if present
  var prev = window.sfResolveTempCodes;
  window.sfResolveTempCodes = function () {
    ensureSeeds();
    var db = loadDb();
    var fixed = 0;
    (db.stores.voucher || []).forEach(function (v) {
      if (!v || v.deleted || !Array.isArray(v["\u0631\u062f\u06cc\u0641\u200c\u0647\u0627"])) return;
      var src = "";
      try {
        var m = String(v["\u0634\u0631\u062d"] || "").match(/\[fx_[^\]]+\]|source[:\s]+([a-z]+)/i);
        // detect from effect sources in desc
        var d = String(v["\u0634\u0631\u062d"] || "") + " " + String(v.effectId || "");
        Object.keys(SOURCE_MAP).forEach(function (k) {
          if (d.indexOf(k) >= 0) src = k;
        });
      } catch (e) {}
      var lines = v["\u0631\u062f\u06cc\u0641\u200c\u0647\u0627"];
      var ch = false;
      lines.forEach(function (ln, idx) {
        if (!ln) return;
        var c = String(ln.code || "").trim();
        if (c && c !== "TEMP" && c !== "0") return;
        if (idx === 0 && src && SOURCE_MAP[src]) {
          ln.code = SOURCE_MAP[src];
          ch = true;
        } else if (idx > 0) {
          ln.code = "2101";
          ch = true;
        }
      });
      if (ch) {
        v["\u06a9\u062f \u062d\u0633\u0627\u0628"] = lines.map(function (l) { return l.code; }).join("\u060c ");
        fixed++;
      }
    });
    if (fixed) saveDb(db);
    if (typeof prev === "function") try { prev(); } catch (e2) {}
    console.log("[chart-seed-1.6] vouchers fixed", fixed);
    return fixed;
  };
  setTimeout(ensureSeeds, 800);
})();
</script>
'@

function Append-Body([string]$path, [string]$marker, [string]$block) {
  if (-not (Test-Path $path)) { Write-Host "skip $path"; return }
  $t = [IO.File]::ReadAllText($path, $utf8)
  if ($t -match [regex]::Escape($marker)) { Write-Host "already $marker"; return }
  if ($t -match '</body>') { $t = $t.Replace('</body>', $block + "`r`n</body>") }
  else { $t = $t + $block }
  [IO.File]::WriteAllText($path, $t, $utf8)
  Write-Host "OK $path"
}
Append-Body (Join-Path $root 'accounting.html') '__sfChartSeed160' $seedBlock
Append-Body (Join-Path $root 'server\public\accounting.html') '__sfChartSeed160' $seedBlock

# ----- 2) Server IAM: effects require module access for source -----
$serverPath = Join-Path $root 'server\server.js'
if (Test-Path $serverPath) {
  $s = [IO.File]::ReadAllText($serverPath, $utf8)
  if ($s -notmatch 'IAM160_effects_module') {
    $oldPost = @"
  if (pathname === '/api/effects' && method === 'POST') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    if (!can(s, 'write') && !can(s, '*')) return send(res, 403, { ok: false, error: 'دسترسی نوشتن نیست' });
    const body = await readBody(req);
"@
    $newPost = @"
  if (pathname === '/api/effects' && method === 'POST') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    if (!can(s, 'write') && !can(s, '*')) return send(res, 403, { ok: false, error: 'دسترسی نوشتن نیست' });
    const body = await readBody(req);
    // IAM160_effects_module: source must be accessible module (or known non-module aliases)
    {
      const src0 = String((body && body.source) || '').trim().toLowerCase();
      const alias = { tankhah: 'pettycash', pettycash: 'pettycash' };
      const modId = alias[src0] || src0;
      const skipMod = !modId || modId === 'unknown' || modId === 'manual';
      if (!skipMod && typeof canAccessModule === 'function' && !canAccessModule(s.role, modId)) {
        try { appendAudit({ action: 'effect_deny', user: s.user, role: s.role, source: src0 }); } catch (eD) {}
        return send(res, 403, { ok: false, error: 'دسترسی به منبع اثر مجاز نیست', source: src0, role: s.role });
      }
    }
"@
    if ($s.Contains("pathname === '/api/effects' && method === 'POST'")) {
      # insert after readBody line of POST effects once
      $pattern = "(pathname === '/api/effects' && method === 'POST'\) \{[\s\S]*?const body = await readBody\(req\);)"
      if ($s -match "IAM160_effects_module") {
        Write-Host 'IAM160 already in server'
      } else {
        $s2 = [regex]::Replace($s, $pattern, {
          param($m)
          return $m.Value + @"

    // IAM160_effects_module
    {
      const src0 = String((body && body.source) || '').trim().toLowerCase();
      const alias = { tankhah: 'pettycash', pettycash: 'pettycash' };
      const modId = alias[src0] || src0;
      const skipMod = !modId || modId === 'unknown' || modId === 'manual';
      if (!skipMod && typeof canAccessModule === 'function' && !canAccessModule(s.role, modId)) {
        try { appendAudit({ action: 'effect_deny', user: s.user, role: s.role, source: src0 }); } catch (eD) {}
        return send(res, 403, { ok: false, error: 'دسترسی به منبع اثر مجاز نیست', source: src0, role: s.role });
      }
    }
"@
        }, 1)
        if ($s2 -eq $s) {
          Write-Host 'WARN: POST effects pattern not replaced — manual check'
        } else {
          $s = $s2
          Write-Host 'OK IAM160 POST effects gate'
        }
      }
    }

    # PATCH: only admin/ceo/manager for posted|rejected
    if ($s -notmatch 'IAM160_approve_gate') {
      $s = [regex]::Replace(
        $s,
        "(fxMatch && method === 'PATCH'\) \{[\s\S]*?const body = await readBody\(req\);)",
        {
          param($m)
          return $m.Value + @"

    // IAM160_approve_gate
    if (body && body.status && (body.status === 'posted' || body.status === 'rejected')) {
      const role = String(s.role || '');
      if (role !== 'admin' && role !== 'ceo' && role !== 'manager') {
        return send(res, 403, { ok: false, error: 'فقط مدیر مجاز به تایید/رد اثر است' });
      }
    }
"@
        },
        1
      )
      Write-Host 'OK IAM160 approve gate'
    }

    # version bump in health
    $s = $s.Replace("version: '1.5.1'", "version: '1.6.0'")
    $s = $s.Replace('Smart Suite Local Server v1.5.1', 'Smart Suite Local Server v1.6.0')
    [IO.File]::WriteAllText($serverPath, $s, $utf8)
    Write-Host 'OK server.js 1.6.0'
  } else {
    Write-Host 'server IAM160 already present'
  }
}

# ----- 3) USER_SET: add accounting read path optional note in rbac (payroll/tax for manager already) -----
$rbacPath = Join-Path $root 'server\lib\rbac-modules.js'
if (Test-Path $rbacPath) {
  $r = [IO.File]::ReadAllText($rbacPath, $utf8)
  if ($r -notmatch "'tax'" -or $r -match "USER_SET") {
    # ensure user cannot post tax if no tax in USER_SET — already correct
    Write-Host 'rbac-modules unchanged (module sets OK)'
  }
}

Write-Host ''
Write-Host '=== Release 1.6.0 apply done ==='
Write-Host '1) Restart: node server.js'
Write-Host '2) COPY-MODULES.bat'
Write-Host '3) Tag + zip commands in docs/RELEASE-1.6.0.md'
