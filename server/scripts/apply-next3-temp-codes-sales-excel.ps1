# Next-3: (1) TEMP->chart codes  (2) sales+purchase effects  (3) Excel/CSV report export
# powershell -ExecutionPolicy Bypass -File .\server\scripts\apply-next3-temp-codes-sales-excel.ps1
$ErrorActionPreference = 'Stop'
$root = 'D:\smart-platform-alm'
if (-not (Test-Path (Join-Path $root 'suite.html'))) {
  $root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
}
$utf8 = New-Object System.Text.UTF8Encoding $false

function Append-BeforeBody([string]$path, [string]$marker, [string]$block) {
  if (-not (Test-Path $path)) { Write-Host "skip $path"; return }
  $t = [IO.File]::ReadAllText($path, $utf8)
  if ($t -match [regex]::Escape($marker)) { Write-Host "already $marker in $path"; return }
  if ($t -match '</body>') {
    $t = $t.Replace('</body>', $block + "`r`n</body>")
  } else {
    $t = $t + $block
  }
  [IO.File]::WriteAllText($path, $t, $utf8)
  Write-Host "OK $path ($marker)"
}

# ========== 1) TEMP code resolver in accounting ==========
$tempBlock = @'
<script>
/* __sfResolveTempCodes — map TEMP lines to chart of accounts */
(function () {
  if (window.__sfResolveTempCodes) return;
  window.__sfResolveTempCodes = true;

  var ACCT_KEY = "smart_mod_accounting_v2";
  var DEFAULTS = {
    cashbox: { code: "1101", name: "\u0635\u0646\u062f\u0648\u0642" },
    bank: { code: "1102", name: "\u0628\u0627\u0646\u06a9" },
    tankhah: { code: "1103", name: "\u062a\u0646\u062e\u0648\u0627\u0647" },
    pettycash: { code: "1103", name: "\u062a\u0646\u062e\u0648\u0627\u0647" },
    sales: { code: "4101", name: "\u062f\u0631\u0622\u0645\u062f \u0641\u0631\u0648\u0634" },
    purchase: { code: "5101", name: "\u062e\u0631\u06cc\u062f" },
    counter: { code: "2101", name: "\u062d\u0633\u0627\u0628 \u0645\u0642\u0627\u0628\u0644" }
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
  function findCode(db, hint) {
    var h = String(hint || "").trim();
    if (!h) return null;
    var list = db.stores.code || [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (!c || c.deleted) continue;
      var code = String(c["\u06a9\u062f"] || c.code || "");
      var name = String(c["\u0646\u0627\u0645"] || c.name || "");
      if (code === h || name === h) return { code: code, name: name };
      if (name && h && name.indexOf(h) >= 0) return { code: code, name: name };
      if (name && h && h.indexOf(name) >= 0) return { code: code, name: name };
    }
    return null;
  }
  function ensureDefaultCodes(db) {
    var need = [
      { "\u06a9\u062f": "1101", "\u0646\u0627\u0645": "\u0635\u0646\u062f\u0648\u0642", "\u0648\u0636\u0639\u06cc\u062a": "\u0641\u0639\u0627\u0644" },
      { "\u06a9\u062f": "1102", "\u0646\u0627\u0645": "\u0628\u0627\u0646\u06a9", "\u0648\u0636\u0639\u06cc\u062a": "\u0641\u0639\u0627\u0644" },
      { "\u06a9\u062f": "1103", "\u0646\u0627\u0645": "\u062a\u0646\u062e\u0648\u0627\u0647", "\u0648\u0636\u0639\u06cc\u062a": "\u0641\u0639\u0627\u0644" },
      { "\u06a9\u062f": "2101", "\u0646\u0627\u0645": "\u062d\u0633\u0627\u0628 \u0645\u0642\u0627\u0628\u0644", "\u0648\u0636\u0639\u06cc\u062a": "\u0641\u0639\u0627\u0644" },
      { "\u06a9\u062f": "4101", "\u0646\u0627\u0645": "\u062f\u0631\u0622\u0645\u062f \u0641\u0631\u0648\u0634", "\u0648\u0636\u0639\u06cc\u062a": "\u0641\u0639\u0627\u0644" },
      { "\u06a9\u062f": "5101", "\u0646\u0627\u0645": "\u062e\u0631\u06cc\u062f", "\u0648\u0636\u0639\u06cc\u062t": "\u0641\u0639\u0627\u0644" }
    ];
    // fix typo in status for 5101 - use correct unicode
    need[5]["\u0648\u0636\u0639\u06cc\u062a"] = "\u0641\u0639\u0627\u0644";
    var changed = false;
    need.forEach(function (row) {
      var exists = (db.stores.code || []).some(function (c) {
        return c && !c.deleted && String(c["\u06a9\u062f"] || "") === row["\u06a9\u062f"];
      });
      if (!exists) {
        row.id = "seed_" + row["\u06a9\u062f"];
        row.deleted = false;
        db.stores.code.push(row);
        changed = true;
      }
    });
    return changed;
  }
  function resolveVoucher(v, db) {
    if (!v || !Array.isArray(v["\u0631\u062f\u06cc\u0641\u200c\u0647\u0627"])) return false;
    var lines = v["\u0631\u062f\u06cc\u0641\u200c\u0647\u0627"];
    var changed = false;
    var srcHint = "";
    try {
      var m = String(v["\u0634\u0631\u062d"] || "").match(/\u0645\u0646\u0628\u0639:\s*([a-zA-Z_]+)/);
      if (m) srcHint = m[1];
    } catch (e) {}
    lines.forEach(function (ln, idx) {
      if (!ln) return;
      var code = String(ln.code || "").trim();
      if (code && code !== "TEMP" && code !== "0") return;
      var hint = ln.desc || "";
      var found = findCode(db, hint);
      if (!found && idx === 0 && srcHint && DEFAULTS[srcHint]) {
        found = DEFAULTS[srcHint];
      }
      if (!found && idx > 0) found = DEFAULTS.counter;
      if (!found && idx === 0) found = DEFAULTS.cashbox;
      if (found) {
        ln.code = found.code;
        changed = true;
      }
    });
    if (changed) {
      v["\u06a9\u062f \u062d\u0633\u0627\u0628"] = lines.map(function (l) { return l.code; }).join("\u060c ");
    }
    return changed;
  }
  function resolveAll() {
    var db = loadDb();
    var seeded = ensureDefaultCodes(db);
    var n = 0;
    (db.stores.voucher || []).forEach(function (v) {
      if (v && !v.deleted && resolveVoucher(v, db)) n++;
    });
    if (seeded || n) saveDb(db);
    if (n && window.SmartCore && SmartCore.toast) {
      SmartCore.toast("\u06a9\u062f \u062d\u0633\u0627\u0628 TEMP \u0628\u0631\u0627\u06cc " + n + " \u0633\u0646\u062f \u062d\u0644 \u0634\u062f");
    }
    console.log("[resolve-temp] vouchers fixed:", n, "seeded:", seeded);
    return n;
  }
  function patchFormLines() {
    var body = document.getElementById("vBody");
    if (!body) return;
    var db = loadDb();
    ensureDefaultCodes(db);
    Array.prototype.forEach.call(body.querySelectorAll("tr"), function (tr, idx) {
      var codeInp = tr.querySelector(".vl-code");
      if (!codeInp) return;
      var c = (codeInp.value || "").trim();
      if (c && c !== "TEMP" && c !== "0") return;
      var desc = ((tr.querySelector(".vl-desc") || {}).value) || "";
      var found = findCode(db, desc) || (idx === 0 ? DEFAULTS.cashbox : DEFAULTS.counter);
      if (found) codeInp.value = found.code;
    });
  }
  window.sfResolveTempCodes = resolveAll;
  window.sfPatchVoucherFormCodes = patchFormLines;

  // button on effects panel / voucher
  function ensureBtn() {
    if (document.getElementById("sfResolveTempBtn")) return;
    var host = document.getElementById("sfFxPanel") || document.querySelector("#p-voucher .card") || document.querySelector(".main");
    if (!host) return;
    var b = document.createElement("button");
    b.id = "sfResolveTempBtn";
    b.type = "button";
    b.textContent = "\u062d\u0644 \u06a9\u062f TEMP \u2192 \u06a9\u062f\u06cc\u0646\u06af";
    b.style.cssText = "margin:8px;background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;font-family:Tahoma,sans-serif;font-size:.72rem";
    b.onclick = function () {
      resolveAll();
      patchFormLines();
      try { if (typeof renderDash === "function") renderDash(); } catch (e) {}
    };
    host.appendChild(b);
  }

  setTimeout(function () { resolveAll(); ensureBtn(); }, 1200);
  setInterval(ensureBtn, 3000);
})();
</script>
'@

# ========== 2) Sales + Purchase effects ==========
function Make-EffectBlock($source, $marker, $hint, $sideDefault) {
  return @"
<script>
/* $marker */
(function () {
  if (window.$marker) return;
  window.$marker = true;
  function tok() { return sessionStorage.getItem("smart_suite_api_token") || ""; }
  function toEnNum(s) {
    var FA = "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9";
    return Number(String(s || "")
      .replace(/[\u06f0-\u06f9]/g, function (d) { return String(FA.indexOf(d)); })
      .replace(/[^\d.-]/g, "")) || 0;
  }
  function postEffect(payload) {
    var t = tok();
    if (!t) return Promise.resolve(null);
    return fetch("/api/effects", {
      method: "POST",
      headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok) console.log("[$source-effect] queued", j.item && j.item.id);
        return j;
      }).catch(function () { return null; });
  }
  window.sfQueue${source}Effect = function (opts) {
    opts = opts || {};
    var amount = toEnNum(opts.amount);
    if (!amount) return Promise.resolve(null);
    return postEffect({
      source: "$source",
      sourceId: opts.sourceId || ("${source}_" + Date.now()),
      date: opts.date || "",
      amount: Math.abs(amount),
      side: opts.side || "$sideDefault",
      accountHint: opts.accountHint || "$hint",
      desc: opts.desc || "$hint"
    });
  };
  function bindSaveHooks() {
    document.querySelectorAll("button, input[type=button]").forEach(function (b) {
      if (b._sfFx) return;
      var lab = ((b.textContent || "") + " " + (b.value || "")).trim();
      if (!/\u062b\u0628\u062a|\u0630\u062e\u06cc\u0631\u0647|save/i.test(lab)) return;
      b._sfFx = true;
      b.addEventListener("click", function () {
        setTimeout(function () {
          try {
            var amtEl = document.querySelector('input[data-f*="\u0645\u0628\u0644\u063a"]') ||
              document.querySelector('input.amount') ||
              document.querySelector('input[data-f*="\u062c\u0645\u0639"]') ||
              document.querySelector('input[data-f*="\u0642\u06cc\u0645\u062a"]');
            var descEl = document.querySelector('input[data-f*="\u0634\u0631\u062d"]') ||
              document.querySelector('textarea[data-f*="\u0634\u0631\u062d"]');
            var dateEl = document.querySelector("input.jdate") ||
              document.querySelector('input[data-f*="\u062a\u0627\u0631\u06cc\u062e"]');
            if (!amtEl) return;
            var amount = toEnNum(amtEl.value);
            if (!amount) return;
            window.sfQueue${source}Effect({
              amount: amount,
              desc: (descEl && descEl.value) || "$hint",
              date: (dateEl && dateEl.value) || "",
              side: "$sideDefault",
              accountHint: "$hint"
            });
          } catch (e) {}
        }, 400);
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindSaveHooks);
  else bindSaveHooks();
  setInterval(bindSaveHooks, 2500);
})();
</script>
"@
}

# Fix the dynamic function - PowerShell variable expansion for sales/purchase
$salesBlock = @'
<script>
/* __sfSalesEffect */
(function () {
  if (window.__sfSalesEffect) return;
  window.__sfSalesEffect = true;
  function tok() { return sessionStorage.getItem("smart_suite_api_token") || ""; }
  function toEnNum(s) {
    var FA = "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9";
    return Number(String(s || "")
      .replace(/[\u06f0-\u06f9]/g, function (d) { return String(FA.indexOf(d)); })
      .replace(/[^\d.-]/g, "")) || 0;
  }
  function postEffect(payload) {
    var t = tok();
    if (!t) return Promise.resolve(null);
    return fetch("/api/effects", {
      method: "POST",
      headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok) console.log("[sales-effect] queued", j.item && j.item.id);
        return j;
      }).catch(function () { return null; });
  }
  window.sfQueueSalesEffect = function (opts) {
    opts = opts || {};
    var amount = toEnNum(opts.amount);
    if (!amount) return Promise.resolve(null);
    return postEffect({
      source: "sales",
      sourceId: opts.sourceId || ("sales_" + Date.now()),
      date: opts.date || "",
      amount: Math.abs(amount),
      side: opts.side || "credit",
      accountHint: opts.accountHint || "\u0641\u0631\u0648\u0634",
      desc: opts.desc || "\u0641\u0627\u06a9\u062a\u0648\u0631 \u0641\u0631\u0648\u0634"
    });
  };
  function bindSaveHooks() {
    document.querySelectorAll("button, input[type=button]").forEach(function (b) {
      if (b._sfFx) return;
      var lab = ((b.textContent || "") + " " + (b.value || "")).trim();
      if (!/\u062b\u0628\u062a|\u0630\u062e\u06cc\u0631\u0647|save/i.test(lab)) return;
      b._sfFx = true;
      b.addEventListener("click", function () {
        setTimeout(function () {
          try {
            var amtEl = document.querySelector('input[data-f*="\u0645\u0628\u0644\u063a"]') ||
              document.querySelector("input.amount") ||
              document.querySelector('input[data-f*="\u062c\u0645\u0639"]') ||
              document.querySelector('input[data-f*="\u0642\u06cc\u0645\u062a"]');
            var descEl = document.querySelector('input[data-f*="\u0634\u0631\u062d"]');
            var dateEl = document.querySelector("input.jdate") || document.querySelector('input[data-f*="\u062a\u0627\u0631\u06cc\u062e"]');
            if (!amtEl) return;
            var amount = toEnNum(amtEl.value);
            if (!amount) return;
            window.sfQueueSalesEffect({
              amount: amount,
              desc: (descEl && descEl.value) || "\u0641\u0631\u0648\u0634",
              date: (dateEl && dateEl.value) || "",
              side: "credit",
              accountHint: "\u0641\u0631\u0648\u0634"
            });
          } catch (e) {}
        }, 400);
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindSaveHooks);
  else bindSaveHooks();
  setInterval(bindSaveHooks, 2500);
})();
</script>
'@

$purchaseBlock = @'
<script>
/* __sfPurchaseEffect */
(function () {
  if (window.__sfPurchaseEffect) return;
  window.__sfPurchaseEffect = true;
  function tok() { return sessionStorage.getItem("smart_suite_api_token") || ""; }
  function toEnNum(s) {
    var FA = "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9";
    return Number(String(s || "")
      .replace(/[\u06f0-\u06f9]/g, function (d) { return String(FA.indexOf(d)); })
      .replace(/[^\d.-]/g, "")) || 0;
  }
  function postEffect(payload) {
    var t = tok();
    if (!t) return Promise.resolve(null);
    return fetch("/api/effects", {
      method: "POST",
      headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok) console.log("[purchase-effect] queued", j.item && j.item.id);
        return j;
      }).catch(function () { return null; });
  }
  window.sfQueuePurchaseEffect = function (opts) {
    opts = opts || {};
    var amount = toEnNum(opts.amount);
    if (!amount) return Promise.resolve(null);
    return postEffect({
      source: "purchase",
      sourceId: opts.sourceId || ("purchase_" + Date.now()),
      date: opts.date || "",
      amount: Math.abs(amount),
      side: opts.side || "debit",
      accountHint: opts.accountHint || "\u062e\u0631\u06cc\u062f",
      desc: opts.desc || "\u062e\u0631\u06cc\u062f"
    });
  };
  function bindSaveHooks() {
    document.querySelectorAll("button, input[type=button]").forEach(function (b) {
      if (b._sfFx) return;
      var lab = ((b.textContent || "") + " " + (b.value || "")).trim();
      if (!/\u062b\u0628\u062a|\u0630\u062e\u06cc\u0631\u0647|save/i.test(lab)) return;
      b._sfFx = true;
      b.addEventListener("click", function () {
        setTimeout(function () {
          try {
            var amtEl = document.querySelector('input[data-f*="\u0645\u0628\u0644\u063a"]') ||
              document.querySelector("input.amount") ||
              document.querySelector('input[data-f*="\u062c\u0645\u0639"]');
            var descEl = document.querySelector('input[data-f*="\u0634\u0631\u062d"]');
            var dateEl = document.querySelector("input.jdate") || document.querySelector('input[data-f*="\u062a\u0627\u0631\u06cc\u062e"]');
            if (!amtEl) return;
            var amount = toEnNum(amtEl.value);
            if (!amount) return;
            window.sfQueuePurchaseEffect({
              amount: amount,
              desc: (descEl && descEl.value) || "\u062e\u0631\u06cc\u062f",
              date: (dateEl && dateEl.value) || "",
              side: "debit",
              accountHint: "\u062e\u0631\u06cc\u062f"
            });
          } catch (e) {}
        }, 400);
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindSaveHooks);
  else bindSaveHooks();
  setInterval(bindSaveHooks, 2500);
})();
</script>
'@

# ========== 3) Excel/CSV export on suite ==========
$excelBlock = @'
<script>
/* __sfExcelExport — management report CSV/Excel download */
(function () {
  if (window.__sfExcelExport) return;
  window.__sfExcelExport = true;

  function tok() {
    return sessionStorage.getItem("smart_suite_api_token") || "";
  }
  function csvEscape(v) {
    var s = String(v == null ? "" : v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function downloadCsv(filename, rows) {
    var bom = "\uFEFF";
    var body = rows.map(function (r) {
      return r.map(csvEscape).join(",");
    }).join("\r\n");
    var blob = new Blob([bom + body], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
  }
  function flattenSummary(j) {
    var rows = [["key", "value"]];
    rows.push(["at", j.at || ""]);
    rows.push(["by", j.by || ""]);
    rows.push(["role", j.role || ""]);
    var t = j.totals || {};
    Object.keys(t).forEach(function (k) {
      rows.push(["totals." + k, t[k]]);
    });
    if (j.modules && typeof j.modules === "object") {
      Object.keys(j.modules).forEach(function (k) {
        rows.push(["module." + k, JSON.stringify(j.modules[k])]);
      });
    }
    return rows;
  }
  async function exportReport() {
    var t = tok();
    if (!t) {
      alert("\u0627\u0628\u062a\u062f\u0627 \u0648\u0627\u0631\u062f \u0634\u0648\u06cc\u062f");
      return;
    }
    var H = { Authorization: "Bearer " + t };
    var summary = null;
    try {
      var r = await fetch("/api/reports/summary", { headers: H });
      summary = await r.json();
    } catch (e) {}
    if (!summary || !summary.ok) {
      try {
        var h = await fetch("/api/health").then(function (x) { return x.json(); });
        summary = { ok: true, at: new Date().toISOString(), totals: h, by: "health-fallback" };
      } catch (e2) {
        alert("\u062e\u0637\u0627 \u062f\u0631 \u062f\u0631\u06cc\u0627\u0641\u062a \u06af\u0632\u0627\u0631\u0634");
        return;
      }
    }
    var rows = flattenSummary(summary);
    // also effects snapshot
    try {
      var er = await fetch("/api/effects", { headers: H });
      var ej = await er.json();
      rows.push([]);
      rows.push(["effects_id", "source", "amount", "side", "status", "date", "desc"]);
      (ej.items || []).slice(0, 500).forEach(function (it) {
        rows.push([it.id, it.source, it.amount, it.side, it.status, it.date, it.desc]);
      });
    } catch (e3) {}
    var stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadCsv("smart-suite-report-" + stamp + ".csv", rows);
    if (window.SmartCore && SmartCore.toast) SmartCore.toast("CSV \u062f\u0627\u0646\u0644\u0648\u062f \u0634\u062f");
  }
  window.sfExportManagementReport = exportReport;

  function ensureBtn() {
    if (document.getElementById("sfExcelExportBtn")) return;
    var host = document.getElementById("sfReportCard") ||
      document.getElementById("sfReportCard2") ||
      document.querySelector(".settings-panel") ||
      document.body;
    if (!host) return;
    var b = document.createElement("button");
    b.id = "sfExcelExportBtn";
    b.type = "button";
    b.textContent = "\u062e\u0631\u0648\u062c\u06cc Excel/CSV \u06af\u0632\u0627\u0631\u0634";
    b.style.cssText = "margin:8px;background:#059669;color:#fff;border:none;border-radius:10px;padding:8px 12px;font-weight:700;cursor:pointer;font-family:Tahoma,sans-serif;font-size:.75rem;display:block;width:calc(100% - 16px)";
    b.onclick = function () { exportReport(); };
    host.appendChild(b);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(ensureBtn, 600); });
  else setTimeout(ensureBtn, 600);
  setInterval(ensureBtn, 3000);
})();
</script>
'@

# Apply
Append-BeforeBody (Join-Path $root 'accounting.html') '__sfResolveTempCodes' $tempBlock
Append-BeforeBody (Join-Path $root 'server\public\accounting.html') '__sfResolveTempCodes' $tempBlock

Append-BeforeBody (Join-Path $root 'sales.html') '__sfSalesEffect' $salesBlock
Append-BeforeBody (Join-Path $root 'server\public\sales.html') '__sfSalesEffect' $salesBlock

Append-BeforeBody (Join-Path $root 'purchase.html') '__sfPurchaseEffect' $purchaseBlock
Append-BeforeBody (Join-Path $root 'server\public\purchase.html') '__sfPurchaseEffect' $purchaseBlock

Append-BeforeBody (Join-Path $root 'suite.html') '__sfExcelExport' $excelBlock
Append-BeforeBody (Join-Path $root 'server\public\suite.html') '__sfExcelExport' $excelBlock

Write-Host ''
Write-Host '=== Next-3 applied ==='
Write-Host '1) Accounting: button resolve TEMP + auto seed 1101/1102/1103/2101/4101/5101'
Write-Host '2) Sales/Purchase: effect queue on save'
Write-Host '3) Suite: Excel/CSV export button'
Write-Host 'Run COPY-MODULES.bat and Ctrl+Shift+R'
