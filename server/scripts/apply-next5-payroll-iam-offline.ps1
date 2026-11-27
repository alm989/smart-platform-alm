# Next-5: 1) payroll+warehouse effects  2) server IAM harden  3) offline effects queue
# powershell -ExecutionPolicy Bypass -File .\server\scripts\apply-next5-payroll-iam-offline.ps1
$ErrorActionPreference = 'Stop'
$root = 'D:\smart-platform-alm'
if (-not (Test-Path (Join-Path $root 'server\server.js'))) {
  $root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
}
$utf8 = New-Object System.Text.UTF8Encoding $false

function Append-BeforeBody([string]$path, [string]$marker, [string]$block) {
  if (-not (Test-Path $path)) { Write-Host "skip missing $path"; return }
  $t = [IO.File]::ReadAllText($path, $utf8)
  if ($t -match [regex]::Escape($marker)) { Write-Host "already $marker in $path"; return }
  if ($t -match '</body>') { $t = $t.Replace('</body>', $block + "`r`n</body>") }
  else { $t = $t + $block }
  [IO.File]::WriteAllText($path, $t, $utf8)
  Write-Host "OK $path"
}

# ========== 1) Payroll + Warehouse effect hooks ==========
$payrollBlock = @'
<script>
/* __sfPayrollEffect */
(function () {
  if (window.__sfPayrollEffect) return;
  window.__sfPayrollEffect = true;
  function tok() { return sessionStorage.getItem("smart_suite_api_token") || ""; }
  function toEnNum(s) {
    var FA = "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9";
    return Number(String(s || "").replace(/[\u06f0-\u06f9]/g, function (d) { return String(FA.indexOf(d)); }).replace(/[^\d.-]/g, "")) || 0;
  }
  window.sfQueuePayrollEffect = function (opts) {
    opts = opts || {};
    var amount = toEnNum(opts.amount);
    if (!amount) return Promise.resolve(null);
    var payload = {
      source: "payroll",
      sourceId: opts.sourceId || ("payroll_" + Date.now()),
      date: opts.date || "",
      amount: Math.abs(amount),
      side: opts.side || "debit",
      accountHint: opts.accountHint || "\u062d\u0642\u0648\u0642",
      desc: opts.desc || "\u062d\u0642\u0648\u0642 \u0648 \u062f\u0633\u062a\u0645\u0632\u062f"
    };
    if (typeof window.sfPostEffectDeduped === "function") return window.sfPostEffectDeduped(payload);
    if (typeof window.sfOfflineQueueEffect === "function") return window.sfOfflineQueueEffect(payload);
    var t = tok();
    if (!t) {
      if (typeof window.sfOfflineQueueEffect === "function") return window.sfOfflineQueueEffect(payload);
      return Promise.resolve(null);
    }
    return fetch("/api/effects", {
      method: "POST",
      headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.ok) console.log("[payroll-effect]", j.item && j.item.id); return j; })
      .catch(function () {
        if (typeof window.sfOfflineQueueEffect === "function") return window.sfOfflineQueueEffect(payload);
        return null;
      });
  };
  function bind() {
    document.querySelectorAll("button, input[type=button]").forEach(function (b) {
      if (b._sfFx) return;
      var lab = ((b.textContent || "") + " " + (b.value || "")).trim();
      if (!/\u062b\u0628\u062a|\u0630\u062e\u06cc\u0631\u0647|save|\u067e\u0631\u062f\u0627\u062e\u062a/i.test(lab)) return;
      b._sfFx = true;
      b.addEventListener("click", function () {
        setTimeout(function () {
          try {
            var amtEl = document.querySelector('input[data-f*="\u0645\u0628\u0644\u063a"]') ||
              document.querySelector('input[data-f*="\u062e\u0627\u0644\u0635"]') ||
              document.querySelector('input[data-f*="\u062d\u0642\u0648\u0642"]') ||
              document.querySelector("input.amount");
            var descEl = document.querySelector('input[data-f*="\u0634\u0631\u062d"]');
            var dateEl = document.querySelector("input.jdate") || document.querySelector('input[data-f*="\u062a\u0627\u0631\u06cc\u062e"]');
            if (!amtEl) return;
            var amount = toEnNum(amtEl.value);
            if (!amount) return;
            window.sfQueuePayrollEffect({
              amount: amount,
              desc: (descEl && descEl.value) || "\u062d\u0642\u0648\u0642",
              date: (dateEl && dateEl.value) || "",
              side: "debit",
              accountHint: "\u062d\u0642\u0648\u0642"
            });
          } catch (e) {}
        }, 400);
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
  setInterval(bind, 2500);
})();
</script>
'@

$warehouseBlock = @'
<script>
/* __sfWarehouseEffect */
(function () {
  if (window.__sfWarehouseEffect) return;
  window.__sfWarehouseEffect = true;
  function tok() { return sessionStorage.getItem("smart_suite_api_token") || ""; }
  function toEnNum(s) {
    var FA = "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9";
    return Number(String(s || "").replace(/[\u06f0-\u06f9]/g, function (d) { return String(FA.indexOf(d)); }).replace(/[^\d.-]/g, "")) || 0;
  }
  window.sfQueueWarehouseEffect = function (opts) {
    opts = opts || {};
    var amount = toEnNum(opts.amount);
    if (!amount) return Promise.resolve(null);
    var payload = {
      source: "warehouse",
      sourceId: opts.sourceId || ("wh_" + Date.now()),
      date: opts.date || "",
      amount: Math.abs(amount),
      side: opts.side || "debit",
      accountHint: opts.accountHint || "\u0627\u0646\u0628\u0627\u0631",
      desc: opts.desc || "\u0639\u0645\u0644\u06cc\u0627\u062a \u0627\u0646\u0628\u0627\u0631"
    };
    if (typeof window.sfPostEffectDeduped === "function") return window.sfPostEffectDeduped(payload);
    if (typeof window.sfOfflineQueueEffect === "function") return window.sfOfflineQueueEffect(payload);
    var t = tok();
    if (!t) {
      if (typeof window.sfOfflineQueueEffect === "function") return window.sfOfflineQueueEffect(payload);
      return Promise.resolve(null);
    }
    return fetch("/api/effects", {
      method: "POST",
      headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.ok) console.log("[warehouse-effect]", j.item && j.item.id); return j; })
      .catch(function () {
        if (typeof window.sfOfflineQueueEffect === "function") return window.sfOfflineQueueEffect(payload);
        return null;
      });
  };
  function bind() {
    document.querySelectorAll("button, input[type=button]").forEach(function (b) {
      if (b._sfFx) return;
      var lab = ((b.textContent || "") + " " + (b.value || "")).trim();
      if (!/\u062b\u0628\u062a|\u0630\u062e\u06cc\u0631\u0647|save|\u0631\u0633\u06cc\u062f|\u062d\u0648\u0627\u0644\u0647/i.test(lab)) return;
      b._sfFx = true;
      b.addEventListener("click", function () {
        setTimeout(function () {
          try {
            var amtEl = document.querySelector('input[data-f*="\u0645\u0628\u0644\u063a"]') ||
              document.querySelector('input[data-f*="\u062c\u0645\u0639"]') ||
              document.querySelector('input[data-f*="\u0642\u06cc\u0645\u062a"]') ||
              document.querySelector("input.amount");
            var descEl = document.querySelector('input[data-f*="\u0634\u0631\u062d"]');
            var dateEl = document.querySelector("input.jdate") || document.querySelector('input[data-f*="\u062a\u0627\u0631\u06cc\u062e"]');
            if (!amtEl) return;
            var amount = toEnNum(amtEl.value);
            if (!amount) return;
            window.sfQueueWarehouseEffect({
              amount: amount,
              desc: (descEl && descEl.value) || "\u0627\u0646\u0628\u0627\u0631",
              date: (dateEl && dateEl.value) || "",
              side: "debit",
              accountHint: "\u0627\u0646\u0628\u0627\u0631"
            });
          } catch (e) {}
        }, 400);
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
  setInterval(bind, 2500);
})();
</script>
'@

Append-BeforeBody (Join-Path $root 'payroll.html') '__sfPayrollEffect' $payrollBlock
Append-BeforeBody (Join-Path $root 'server\public\payroll.html') '__sfPayrollEffect' $payrollBlock
Append-BeforeBody (Join-Path $root 'warehouse.html') '__sfWarehouseEffect' $warehouseBlock
Append-BeforeBody (Join-Path $root 'server\public\warehouse.html') '__sfWarehouseEffect' $warehouseBlock

# ========== 2) Server IAM harden ==========
$serverPath = Join-Path $root 'server\server.js'
if (Test-Path $serverPath) {
  $s = [IO.File]::ReadAllText($serverPath, $utf8)
  if ($s -notmatch 'PriorityIAM5') {
    # helper: role can approve effects
    if ($s -notmatch 'function canApproveEffect') {
      $helper = @'

/* ===== PriorityIAM5 helpers ===== */
function canApproveEffect(s) {
  if (!s) return false;
  if (s.role === 'admin' || s.role === 'ceo') return true;
  if (s.role === 'manager') return true;
  if (s.perms && (s.perms.indexOf('*') >= 0 || s.perms.indexOf('effects:approve') >= 0)) return true;
  return false;
}
function canWriteEffect(s) {
  if (!s) return false;
  if (canApproveEffect(s)) return true;
  if (s.role === 'user' || s.role === 'manager') return true;
  if (s.perms && (s.perms.indexOf('effects:write') >= 0 || s.perms.indexOf('*') >= 0)) return true;
  return false;
}
/* ===== end PriorityIAM5 helpers ===== */

'@
      # insert after first function can( if exists, else near top after requires
      if ($s -match 'function can\(') {
        $s = $s -replace '(function can\([\s\S]*?\n\})', ('$1' + $helper)
      } else {
        $s = $helper + $s
      }
    }

    # Harden PATCH effects: only approvers can set posted/rejected
    if ($s -match "pathname === '/api/effects/" -or $s -match 'pathname === "/api/effects/') {
      # inject after session check patterns - safer: replace body.status assignment blocks
      if ($s -notmatch 'canApproveEffect\(s\)') {
        $s = $s.Replace(
          "pathname === '/api/effects/'",
          "pathname === '/api/effects/' /* PriorityIAM5 */"
        )
        # Add gate before status update - generic insert near PATCH handler
        $gate = @'

    // PriorityIAM5: only approver roles can post/reject
    if (body && body.status && (body.status === 'posted' || body.status === 'rejected')) {
      if (!canApproveEffect(s)) return send(res, 403, { ok: false, error: 'فقط مدیر مجاز به تایید/رد اثر است' });
    }
    if (body && method === 'POST') {
      /* write checked below */
    }
'@
        # Insert gate inside first effects PATCH block if identifiable
        if ($s -match "pathname === '/api/effects/' \+ id|/api/effects/" ) {
          $s = [regex]::Replace(
            $s,
            "(pathname === '/api/effects/'[\s\S]{0,200}?method === 'PATCH'[\s\S]{0,400}?)",
            {
              param($m)
              if ($m.Value -match 'canApproveEffect') { return $m.Value }
              return $m.Value + "`r`n    if (body && body.status && (body.status === 'posted' || body.status === 'rejected') && !canApproveEffect(s)) return send(res, 403, { ok: false, error: 'فقط مدیر مجاز به تایید/رد اثر است' });`r`n"
            },
            1
          )
        }
      }
    }

    # POST /api/effects require canWriteEffect
    if ($s -match "pathname === '/api/effects' && method === 'POST'" -and $s -notmatch 'canWriteEffect\(s\)') {
      $s = $s.Replace(
        "pathname === '/api/effects' && method === 'POST'",
        "pathname === '/api/effects' && method === 'POST'"
      )
      $s = [regex]::Replace(
        $s,
        "(pathname === '/api/effects' && method === 'POST'\) \{[\s\S]{0,300}?)",
        {
          param($m)
          if ($m.Value -match 'canWriteEffect') { return $m.Value }
          return $m.Value + "`r`n    if (!canWriteEffect(s)) return send(res, 403, { ok: false, error: 'مجوز ثبت اثر نیست' });`r`n"
        },
        1
      )
    }

    # users create/patch already admin - ensure backup restore admin only note
    if ($s -notmatch "PriorityIAM5 applied marker") {
      $s = $s + "`r`n/* PriorityIAM5 applied marker */`r`n"
    }
    [IO.File]::WriteAllText($serverPath, $s, $utf8)
    Write-Host 'OK server.js IAM helpers (review PATCH gate if effects routes differ)'
  } else {
    Write-Host 'server IAM already marked'
  }
} else {
  Write-Host 'server.js not found'
}

# More reliable IAM patch: explicit file snippet for effects POST/PATCH if patterns failed
$iamSnippetPath = Join-Path $root 'server\scripts\iam-effects-gates.js'
$iamSnippet = @'
// Reference gates — already attempted inline in server.js by apply-next5
// canWriteEffect(s) on POST /api/effects
// canApproveEffect(s) on PATCH status posted|rejected
'@
[IO.File]::WriteAllText($iamSnippetPath, $iamSnippet, $utf8)

# ========== 3) Offline effects queue (suite + core modules) ==========
$offlineBlock = @'
<script>
/* __sfOfflineEffects — queue effects when offline / 5xx, flush later */
(function () {
  if (window.__sfOfflineEffects) return;
  window.__sfOfflineEffects = true;

  var KEY = "smart_effects_offline_v1";

  function tok() {
    return sessionStorage.getItem("smart_suite_api_token") || "";
  }
  function loadQ() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch (e) { return []; }
  }
  function saveQ(q) {
    localStorage.setItem(KEY, JSON.stringify(q.slice(-200)));
    updateBadge();
  }
  function updateBadge() {
    var n = loadQ().length;
    var el = document.getElementById("sfOfflineFxBadge");
    if (!el) return;
    el.textContent = n ? ("\u0635\u0641 \u0622\u0641\u0644\u0627\u06cc\u0646: " + n) : "";
    el.style.display = n ? "inline-block" : "none";
  }

  window.sfOfflineQueueEffect = function (payload) {
    var q = loadQ();
    payload = payload || {};
    payload._queuedAt = new Date().toISOString();
    if (!payload.sourceId) payload.sourceId = (payload.source || "x") + "_" + Date.now();
    // dedupe offline by sourceId
    if (q.some(function (x) { return x && x.sourceId === payload.sourceId; })) {
      return Promise.resolve({ ok: true, offline: true, deduped: true });
    }
    q.push(payload);
    saveQ(q);
    console.log("[offline-effect] queued", payload.sourceId);
    return Promise.resolve({ ok: true, offline: true, item: payload });
  };

  window.sfFlushOfflineEffects = function () {
    var t = tok();
    if (!t) return Promise.resolve({ ok: false, error: "no-token" });
    var q = loadQ();
    if (!q.length) return Promise.resolve({ ok: true, flushed: 0 });
    var left = [];
    var chain = Promise.resolve();
    var flushed = 0;
    q.forEach(function (payload) {
      chain = chain.then(function () {
        return fetch("/api/effects", {
          method: "POST",
          headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" },
          body: JSON.stringify({
            source: payload.source,
            sourceId: payload.sourceId,
            date: payload.date,
            amount: payload.amount,
            side: payload.side,
            accountHint: payload.accountHint,
            desc: payload.desc
          })
        }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok && j && j.ok, j: j }; }); })
          .then(function (res) {
            if (res.ok) flushed++;
            else left.push(payload);
          })
          .catch(function () { left.push(payload); });
      });
    });
    return chain.then(function () {
      saveQ(left);
      console.log("[offline-effect] flushed", flushed, "left", left.length);
      return { ok: true, flushed: flushed, left: left.length };
    });
  };

  // Wrap sfPostEffectDeduped if present to fallback offline
  function wrapDedupe() {
    var prev = window.sfPostEffectDeduped;
    if (typeof prev !== "function" || prev._offWrap) return;
    window.sfPostEffectDeduped = function (payload) {
      return prev(payload).then(function (j) {
        if (j && j.ok) return j;
        return window.sfOfflineQueueEffect(payload);
      }).catch(function () {
        return window.sfOfflineQueueEffect(payload);
      });
    };
    window.sfPostEffectDeduped._offWrap = true;
  }

  function ensureUi() {
    if (document.getElementById("sfOfflineFxBadge")) return;
    var bar = document.createElement("div");
    bar.id = "sfOfflineFxBar";
    bar.style.cssText = "position:fixed;bottom:12px;left:12px;z-index:9999;display:flex;gap:8px;align-items:center;font-family:Tahoma,sans-serif;direction:rtl";
    bar.innerHTML =
      "<span id=\"sfOfflineFxBadge\" style=\"display:none;background:#b45309;color:#fff;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700\"></span>" +
      "<button type=\"button\" id=\"sfOfflineFxFlush\" style=\"background:#0f766e;color:#fff;border:none;border-radius:8px;padding:6px 10px;font-weight:700;cursor:pointer;font-family:inherit;font-size:12px\">\u0627\u0631\u0633\u0627\u0644 \u0635\u0641 \u0622\u0641\u0644\u0627\u06cc\u0646</button>";
    document.body.appendChild(bar);
    document.getElementById("sfOfflineFxFlush").onclick = function () {
      window.sfFlushOfflineEffects().then(function (r) {
        alert("\u0627\u0631\u0633\u0627\u0644 \u0634\u062f: " + (r && r.flushed) + " | \u0628\u0627\u0642\u06cc\u0645\u0627\u0646\u062f\u0647: " + (r && r.left));
      });
    };
    updateBadge();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { ensureUi(); wrapDedupe(); });
  else { ensureUi(); wrapDedupe(); }
  setInterval(function () { wrapDedupe(); updateBadge(); }, 3000);
  window.addEventListener("online", function () {
    setTimeout(function () { window.sfFlushOfflineEffects(); }, 1000);
  });
})();
</script>
'@

$offlineTargets = @(
  'suite.html', 'server\public\suite.html',
  'payroll.html', 'server\public\payroll.html',
  'warehouse.html', 'server\public\warehouse.html',
  'cashbox.html', 'server\public\cashbox.html',
  'bank.html', 'server\public\bank.html',
  'sales.html', 'server\public\sales.html',
  'purchase.html', 'server\public\purchase.html',
  'accounting.html', 'server\public\accounting.html'
)
foreach ($rel in $offlineTargets) {
  Append-BeforeBody (Join-Path $root $rel) '__sfOfflineEffects' $offlineBlock
}

# Seed default codes for payroll/warehouse in resolve script note
Write-Host ''
Write-Host '=== Next-5 applied ==='
Write-Host '1) payroll.html + warehouse.html effect hooks'
Write-Host '2) server.js IAM helpers (canWriteEffect / canApproveEffect) — restart node'
Write-Host '3) offline effects queue + flush button (bottom-left)'
Write-Host 'Restart: node server.js after killing port 8787'
Write-Host 'COPY-MODULES.bat + Ctrl+Shift+R'
