# Prefer online POST /api/effects; offline only on network/5xx; surface 403
# powershell -ExecutionPolicy Bypass -File .\server\scripts\apply-fix-effects-online-first.ps1
$ErrorActionPreference = 'Stop'
$root = 'D:\smart-platform-alm'
if (-not (Test-Path (Join-Path $root 'suite.html'))) {
  $root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
}
$utf8 = New-Object System.Text.UTF8Encoding $false

$block = @'
<script>
/* __sfEffectsOnlineFirst — POST online first; offline only if network fails */
(function () {
  if (window.__sfEffectsOnlineFirst) return;
  window.__sfEffectsOnlineFirst = true;

  function tok() {
    return sessionStorage.getItem("smart_suite_api_token") || "";
  }

  window.sfPostEffectOnline = function (payload) {
    payload = payload || {};
    var t = tok();
    if (!payload.sourceId) {
      payload.sourceId = (payload.source || "fx") + "_" + Date.now();
    }
    if (!payload.amount) {
      return Promise.resolve({ ok: false, error: "no-amount" });
    }
    if (!t) {
      if (typeof window.sfOfflineQueueEffect === "function") {
        return window.sfOfflineQueueEffect(payload).then(function (j) {
          return Object.assign({ reason: "no-token" }, j);
        });
      }
      return Promise.resolve({ ok: false, error: "no-token" });
    }
    return fetch("/api/effects", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + t,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source: payload.source,
        sourceId: payload.sourceId,
        date: payload.date || "",
        amount: payload.amount,
        side: payload.side || "debit",
        accountHint: payload.accountHint || "",
        desc: payload.desc || ""
      })
    }).then(function (r) {
      return r.json().then(function (j) {
        j = j || {};
        j.httpStatus = r.status;
        if (r.ok && j.ok) {
          console.log("[effect-online] ok", j.item && j.item.id, payload.source);
          return j;
        }
        // 401/403: do NOT silent-offline (permission issue)
        if (r.status === 401 || r.status === 403) {
          console.warn("[effect-online] forbidden", r.status, j);
          return { ok: false, error: j.error || "forbidden", httpStatus: r.status, offlineSkipped: true };
        }
        // other errors -> offline queue
        if (typeof window.sfOfflineQueueEffect === "function") {
          return window.sfOfflineQueueEffect(payload).then(function (o) {
            return Object.assign({ reason: "http-" + r.status }, o);
          });
        }
        return j;
      });
    }).catch(function (e) {
      console.warn("[effect-online] network", e);
      if (typeof window.sfOfflineQueueEffect === "function") {
        return window.sfOfflineQueueEffect(payload).then(function (o) {
          return Object.assign({ reason: "network" }, o);
        });
      }
      return { ok: false, error: String(e && e.message || e) };
    });
  };

  // Override deduped helper to use online-first
  window.sfPostEffectDeduped = function (payload) {
    payload = payload || {};
    var t = tok();
    if (!t) return window.sfPostEffectOnline(payload);
    var src = payload.source || "";
    return fetch("/api/effects?source=" + encodeURIComponent(src) + "&limit=100",
      { headers: { Authorization: "Bearer " + t } })
      .then(function (r) { return r.json().then(function (j) { return { r: r, j: j }; }); })
      .then(function (pack) {
        if (pack.r.ok && pack.j && pack.j.items) {
          var hit = pack.j.items.find(function (x) {
            return x && String(x.sourceId) === String(payload.sourceId) &&
              (x.status === "pending" || x.status === "posted");
          });
          if (hit) {
            console.log("[effect-dedupe] existing", hit.id);
            return { ok: true, deduped: true, item: hit };
          }
        }
        return window.sfPostEffectOnline(payload);
      })
      .catch(function () {
        return window.sfPostEffectOnline(payload);
      });
  };
  window.sfPostEffectDeduped._offWrap = true;

  function rewire(name, source, side, hint) {
    window[name] = function (opts) {
      opts = opts || {};
      var amount = Number(opts.amount);
      if (!amount) {
        var FA = "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9";
        amount = Number(String(opts.amount || "").replace(/[\u06f0-\u06f9]/g, function (d) {
          return String(FA.indexOf(d));
        }).replace(/[^\d.-]/g, "")) || 0;
      }
      if (!amount) return Promise.resolve({ ok: false, error: "no-amount" });
      return window.sfPostEffectDeduped({
        source: source,
        sourceId: opts.sourceId || (source + "_" + Date.now()),
        date: opts.date || "",
        amount: Math.abs(amount),
        side: opts.side || side,
        accountHint: opts.accountHint || hint,
        desc: opts.desc || hint
      });
    };
  }

  function wireAll() {
    rewire("sfQueuePayrollEffect", "payroll", "debit", "\u062d\u0642\u0648\u0642");
    rewire("sfQueueWarehouseEffect", "warehouse", "debit", "\u0627\u0646\u0628\u0627\u0631");
    rewire("sfQueueCashEffect", "cashbox", "debit", "\u0635\u0646\u062f\u0648\u0642");
    rewire("sfQueueBankEffect", "bank", "debit", "\u0628\u0627\u0646\u06a9");
    rewire("sfQueueSalesEffect", "sales", "credit", "\u0641\u0631\u0648\u0634");
    rewire("sfQueuePurchaseEffect", "purchase", "debit", "\u062e\u0631\u06cc\u062f");
  }
  wireAll();
  setInterval(wireAll, 2500);
})();
</script>
'@

function Patch([string]$path) {
  if (-not (Test-Path $path)) { Write-Host "skip $path"; return }
  $t = [IO.File]::ReadAllText($path, $utf8)
  if ($t -match '__sfEffectsOnlineFirst') { Write-Host "already $path"; return }
  if ($t -match '</body>') { $t = $t.Replace('</body>', $block + "`r`n</body>") }
  else { $t = $t + $block }
  [IO.File]::WriteAllText($path, $t, $utf8)
  Write-Host "OK $path"
}

@(
  'suite.html','server\public\suite.html',
  'payroll.html','server\public\payroll.html',
  'warehouse.html','server\public\warehouse.html',
  'accounting.html','server\public\accounting.html',
  'cashbox.html','server\public\cashbox.html',
  'bank.html','server\public\bank.html'
) | ForEach-Object { Patch (Join-Path $root $_) }

Write-Host 'Done. Ctrl+Shift+R then retest sfQueuePayrollEffect'
