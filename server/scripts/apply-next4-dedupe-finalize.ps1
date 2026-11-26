# Next-4: (1) client effect dedupe  (2) finalize temp voucher -> permanent
# powershell -ExecutionPolicy Bypass -File .\server\scripts\apply-next4-dedupe-finalize.ps1
$ErrorActionPreference = 'Stop'
$root = 'D:\smart-platform-alm'
if (-not (Test-Path (Join-Path $root 'accounting.html'))) {
  $root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
}
$utf8 = New-Object System.Text.UTF8Encoding $false

function Append-BeforeBody([string]$path, [string]$marker, [string]$block) {
  if (-not (Test-Path $path)) { Write-Host "skip $path"; return }
  $t = [IO.File]::ReadAllText($path, $utf8)
  if ($t -match [regex]::Escape($marker)) { Write-Host "already $marker `$path"; return }
  if ($t -match '</body>') { $t = $t.Replace('</body>', $block + "`r`n</body>") }
  else { $t = $t + $block }
  [IO.File]::WriteAllText($path, $t, $utf8)
  Write-Host "OK $path"
}

# --- Shared client helper: deduped POST /api/effects ---
$dedupeBlock = @'
<script>
/* __sfEffectDedupe — avoid duplicate pending effects for same sourceId */
(function () {
  if (window.__sfEffectDedupe) return;
  window.__sfEffectDedupe = true;

  function tok() {
    return sessionStorage.getItem("smart_suite_api_token") || "";
  }

  /**
   * sfPostEffectDeduped(payload)
   * payload: { source, sourceId, date, amount, side, accountHint, desc }
   */
  window.sfPostEffectDeduped = function (payload) {
    payload = payload || {};
    var t = tok();
    if (!t) return Promise.resolve({ ok: false, error: "no-token" });
    if (!payload.source || !payload.amount) {
      return Promise.resolve({ ok: false, error: "invalid" });
    }
    if (!payload.sourceId) {
      payload.sourceId = payload.source + "_" + Date.now();
    }
    var H = { Authorization: "Bearer " + t, "Content-Type": "application/json" };
    var q = "/api/effects?source=" + encodeURIComponent(payload.source);
    return fetch(q, { headers: { Authorization: "Bearer " + t } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var items = (j && j.items) || [];
        var hit = items.find(function (x) {
          return x && String(x.sourceId) === String(payload.sourceId) &&
            (x.status === "pending" || x.status === "posted");
        });
        if (hit) {
          console.log("[effect-dedupe] skip existing", hit.id, payload.sourceId);
          return { ok: true, deduped: true, item: hit };
        }
        return fetch("/api/effects", {
          method: "POST",
          headers: H,
          body: JSON.stringify(payload)
        }).then(function (r2) { return r2.json(); });
      })
      .catch(function (e) {
        console.warn("[effect-dedupe]", e);
        return { ok: false, error: String(e && e.message || e) };
      });
  };

  // Patch known queue helpers if present
  function wrap(name, source, defaultSide, defaultHint) {
    var prev = window[name];
    if (typeof prev !== "function" || prev._deduped) return;
    window[name] = function (opts) {
      opts = opts || {};
      var amount = opts.amount;
      if (amount == null) return prev(opts);
      return window.sfPostEffectDeduped({
        source: source,
        sourceId: opts.sourceId || (source + "_" + String(opts.desc || "") + "_" + String(amount)).slice(0, 80),
        date: opts.date || "",
        amount: Math.abs(Number(amount) || 0),
        side: opts.side || defaultSide,
        accountHint: opts.accountHint || defaultHint,
        desc: opts.desc || defaultHint
      });
    };
    window[name]._deduped = true;
  }
  function tryWrap() {
    wrap("sfQueueCashEffect", "cashbox", "debit", "\u0635\u0646\u062f\u0648\u0642");
    wrap("sfQueueBankEffect", "bank", "debit", "\u0628\u0627\u0646\u06a9");
    wrap("sfQueueTanEffect", "tankhah", "debit", "\u062a\u0646\u062e\u0648\u0627\u0647");
    wrap("sfQueueSalesEffect", "sales", "credit", "\u0641\u0631\u0648\u0634");
    wrap("sfQueuePurchaseEffect", "purchase", "debit", "\u062e\u0631\u06cc\u062f");
  }
  tryWrap();
  setInterval(tryWrap, 2000);
})();
</script>
'@

# --- Finalize temp voucher ---
$finalizeBlock = @'
<script>
/* __sfFinalizeTempVoucher — موقت to دائم with real codes */
(function () {
  if (window.__sfFinalizeTempVoucher) return;
  window.__sfFinalizeTempVoucher = true;

  var ACCT_KEY = "smart_mod_accounting_v2";

  function tok() {
    return sessionStorage.getItem("smart_suite_api_token") || "";
  }
  function loadDb() {
    try {
      var db = JSON.parse(localStorage.getItem(ACCT_KEY) || "{}");
      if (!db.stores) db.stores = {};
      if (!Array.isArray(db.stores.voucher)) db.stores.voucher = [];
      return db;
    } catch (e) {
      return { stores: { voucher: [] } };
    }
  }
  function saveDb(db) {
    db.updatedAt = new Date().toISOString();
    localStorage.setItem(ACCT_KEY, JSON.stringify(db));
    try {
      if (window.SmartCore && SmartCore.api && SmartCore.api.syncState) SmartCore.api.syncState();
    } catch (e) {}
  }
  function linesOk(lines) {
    if (!Array.isArray(lines) || !lines.length) return false;
    for (var i = 0; i < lines.length; i++) {
      var c = String((lines[i] && lines[i].code) || "").trim();
      if (!c || c === "TEMP" || c === "0") return false;
    }
    return true;
  }
  function balOk(lines) {
    var d = 0, c = 0;
    lines.forEach(function (l) {
      d += Number(l.debit) || 0;
      c += Number(l.credit) || 0;
    });
    return Math.round((d - c) * 100) === 0 && d > 0;
  }
  function patchEffectVoucherRef(effectId, voucherId) {
    if (!effectId || !tok()) return Promise.resolve();
    // list + find by id then patch if API supports voucherRef only via status patch
    return fetch("/api/effects", {
      headers: { Authorization: "Bearer " + tok() }
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var hit = ((j && j.items) || []).find(function (x) { return x && x.id === effectId; });
        if (!hit) return;
        return fetch("/api/effects/" + encodeURIComponent(effectId), {
          method: "PATCH",
          headers: {
            Authorization: "Bearer " + tok(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            status: hit.status === "pending" ? "posted" : hit.status,
            voucherRef: "perm:" + voucherId
          })
        });
      })
      .catch(function () {});
  }

  window.sfFinalizeTempVoucher = function (voucherId) {
    var db = loadDb();
    var v = (db.stores.voucher || []).find(function (x) {
      return x && !x.deleted && String(x.id) === String(voucherId);
    });
    if (!v) {
      alert("\u0633\u0646\u062f \u06cc\u0627\u0641\u062a \u0646\u0634\u062f");
      return false;
    }
    var lines = v["\u0631\u062f\u06cc\u0641\u200c\u0647\u0627"] || [];
    if (!linesOk(lines)) {
      alert("\u0647\u0645\u0647 \u0631\u062f\u06cc\u0641\u200c\u0647\u0627 \u0628\u0627\u06cc\u062f \u06a9\u062f \u062d\u0633\u0627\u0628 \u0648\u0627\u0642\u0639\u06cc (\u063a\u06cc\u0631 TEMP) \u062f\u0627\u0634\u062a\u0647 \u0628\u0627\u0634\u0646\u062f");
      try { if (typeof sfResolveTempCodes === "function") sfResolveTempCodes(); } catch (e) {}
      return false;
    }
    if (!balOk(lines)) {
      alert("\u0633\u0646\u062f \u0646\u0627\u062a\u0631\u0627\u0632 \u0627\u0633\u062a");
      return false;
    }
    v["\u0648\u0636\u0639\u06cc\u062a"] = "\u062f\u0627\u0626\u0645";
    v.finalizedAt = new Date().toISOString();
    saveDb(db);
    if (v.effectId) patchEffectVoucherRef(v.effectId, v.id);
    if (window.SmartCore && SmartCore.toast) {
      SmartCore.toast("\u0633\u0646\u062f " + (v["\u0634\u0645\u0627\u0631\u0647"] || "") + " \u062f\u0627\u0626\u0645 \u0634\u062f");
    }
    try { if (typeof renderDash === "function") renderDash(); } catch (e2) {}
    return true;
  };

  function ensureUi() {
    if (document.getElementById("sfFinalizeBox")) return;
    var host = document.querySelector("#p-list-voucher .card") ||
      document.querySelector("#p-rep-temp .card") ||
      document.getElementById("sfFxPanel") ||
      document.querySelector(".main");
    if (!host) return;
    var box = document.createElement("div");
    box.id = "sfFinalizeBox";
    box.style.cssText = "margin:10px;padding:12px;border:1px solid #334155;border-radius:12px;background:#0f172a;color:#e2e8f0;font-family:Tahoma,sans-serif;direction:rtl";
    box.innerHTML =
      "<b style=\"color:#a78bfa\">\u0642\u0637\u0639\u06cc\u200c\u0633\u0627\u0632\u06cc \u0633\u0646\u062f \u0645\u0648\u0642\u062a</b>" +
      "<div style=\"margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center\">" +
      "<select id=\"sfFinSel\" style=\"flex:1;min-width:180px;padding:6px;border-radius:8px;border:1px solid #334155;background:#020617;color:#e2e8f0\"></select>" +
      "<button type=\"button\" id=\"sfFinGo\" style=\"background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer;font-family:inherit\">\u062f\u0627\u0626\u0645 \u06a9\u0631\u062f\u0646</button>" +
      "<button type=\"button\" id=\"sfFinRef\" style=\"background:#334155;color:#e2e8f0;border:none;border-radius:8px;padding:7px 10px;cursor:pointer;font-family:inherit\">\u0628\u0631\u0648\u0632</button>" +
      "</div>";
    host.insertBefore(box, host.firstChild);
    function fill() {
      var sel = document.getElementById("sfFinSel");
      if (!sel) return;
      var db = loadDb();
      var temps = (db.stores.voucher || []).filter(function (v) {
        return v && !v.deleted && (v["\u0648\u0636\u0639\u06cc\u062a"] || "\u0645\u0648\u0642\u062a") === "\u0645\u0648\u0642\u062a";
      });
      sel.innerHTML = temps.map(function (v) {
        return "<option value=\"" + v.id + "\">#" +
          (v["\u0634\u0645\u0627\u0631\u0647"] || "?") + " — " +
          (v["\u0634\u0631\u062d"] || "").slice(0, 40) + "</option>";
      }).join("") || "<option value=\"\">—</option>";
    }
    document.getElementById("sfFinRef").onclick = fill;
    document.getElementById("sfFinGo").onclick = function () {
      var id = document.getElementById("sfFinSel").value;
      if (!id) return;
      if (window.sfFinalizeTempVoucher(id)) fill();
    };
    fill();
  }

  setTimeout(ensureUi, 1000);
  setInterval(ensureUi, 4000);
})();
</script>
'@

# inject dedupe into suite + financial modules (loads early enough for wrappers)
$targetsDedupe = @(
  'suite.html', 'server\public\suite.html',
  'cashbox.html', 'server\public\cashbox.html',
  'bank.html', 'server\public\bank.html',
  'pettycash.html', 'server\public\pettycash.html',
  'sales.html', 'server\public\sales.html',
  'purchase.html', 'server\public\purchase.html',
  'accounting.html', 'server\public\accounting.html'
)
foreach ($rel in $targetsDedupe) {
  Append-BeforeBody (Join-Path $root $rel) '__sfEffectDedupe' $dedupeBlock
}

Append-BeforeBody (Join-Path $root 'accounting.html') '__sfFinalizeTempVoucher' $finalizeBlock
Append-BeforeBody (Join-Path $root 'server\public\accounting.html') '__sfFinalizeTempVoucher' $finalizeBlock

Write-Host ''
Write-Host 'Next-4 applied:'
Write-Host ' 1) sfPostEffectDeduped + wrap queue helpers'
Write-Host ' 2) Finalize temp voucher UI (موقت -> دائم)'
Write-Host 'COPY-MODULES.bat + Ctrl+Shift+R'
