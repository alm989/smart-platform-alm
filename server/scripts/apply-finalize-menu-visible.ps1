# Make finalize-temp-voucher UI always visible in accounting
# powershell -ExecutionPolicy Bypass -File .\server\scripts\apply-finalize-menu-visible.ps1
$ErrorActionPreference = 'Stop'
$root = 'D:\smart-platform-alm'
if (-not (Test-Path (Join-Path $root 'accounting.html'))) {
  $root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
}
$utf8 = New-Object System.Text.UTF8Encoding $false

$block = @'
<script>
/* __sfFinalizeMenuVisible — always-visible finalize controls */
(function () {
  if (window.__sfFinalizeMenuVisible) return;
  window.__sfFinalizeMenuVisible = true;

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
    (lines || []).forEach(function (l) {
      d += Number(l.debit) || 0;
      c += Number(l.credit) || 0;
    });
    return Math.round((d - c) * 100) === 0 && d > 0;
  }
  function patchEffect(effectId, voucherId) {
    if (!effectId || !tok()) return;
    fetch("/api/effects/" + encodeURIComponent(effectId), {
      method: "PATCH",
      headers: {
        Authorization: "Bearer " + tok(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status: "posted", voucherRef: "perm:" + voucherId })
    }).catch(function () {});
  }

  window.sfFinalizeTempVoucher = window.sfFinalizeTempVoucher || function (voucherId) {
    var db = loadDb();
    var v = (db.stores.voucher || []).find(function (x) {
      return x && !x.deleted && String(x.id) === String(voucherId);
    });
    if (!v) {
      alert("\u0633\u0646\u062f \u06cc\u0627\u0641\u062a \u0646\u0634\u062f");
      return false;
    }
    // prefer form lines if open
    try {
      var body = document.getElementById("vBody");
      if (body && body.querySelectorAll("tr").length) {
        var lines = [];
        Array.prototype.forEach.call(body.querySelectorAll("tr"), function (tr) {
          var code = ((tr.querySelector(".vl-code") || {}).value || "").trim();
          var desc = ((tr.querySelector(".vl-desc") || {}).value || "").trim();
          var debit = Number(((tr.querySelector(".vl-debit") || {}).value || "0").toString().replace(/[^\d.-]/g, "")) || 0;
          var credit = Number(((tr.querySelector(".vl-credit") || {}).value || "0").toString().replace(/[^\d.-]/g, "")) || 0;
          if (code || desc || debit || credit) lines.push({ code: code, desc: desc, debit: debit, credit: credit });
        });
        if (lines.length) v["\u0631\u062f\u06cc\u0641\u200c\u0647\u0627"] = lines;
      }
    } catch (e) {}

    var lines = v["\u0631\u062f\u06cc\u0641\u200c\u0647\u0627"] || [];
    if (!linesOk(lines)) {
      if (typeof window.sfResolveTempCodes === "function") window.sfResolveTempCodes();
      // reload after resolve
      db = loadDb();
      v = (db.stores.voucher || []).find(function (x) {
        return x && String(x.id) === String(voucherId);
      }) || v;
      lines = v["\u0631\u062f\u06cc\u0641\u200c\u0647\u0627"] || [];
    }
    if (!linesOk(lines)) {
      alert("\u0627\u0628\u062a\u062f\u0627 \u06a9\u062f TEMP \u0631\u0627 \u0628\u0647 \u06a9\u062f \u062d\u0633\u0627\u0628 \u0648\u0627\u0642\u0639\u06cc \u062a\u063a\u06cc\u06cc\u0631 \u062f\u0647\u06cc\u062f");
      return false;
    }
    if (!balOk(lines)) {
      alert("\u0633\u0646\u062f \u0646\u0627\u062a\u0631\u0627\u0632 \u0627\u0633\u062a");
      return false;
    }
    v["\u0648\u0636\u0639\u06cc\u062a"] = "\u062f\u0627\u0626\u0645";
    v.finalizedAt = new Date().toISOString();
    saveDb(db);
    if (v.effectId) patchEffect(v.effectId, v.id);
    if (window.SmartCore && SmartCore.toast) {
      SmartCore.toast("\u0633\u0646\u062f #" + (v["\u0634\u0645\u0627\u0631\u0647"] || "") + " \u062f\u0627\u0626\u0645 \u0634\u062f");
    }
    try { if (typeof renderDash === "function") renderDash(); } catch (e2) {}
    fillSelects();
    return true;
  };

  function tempList() {
    return (loadDb().stores.voucher || []).filter(function (v) {
      return v && !v.deleted && (v["\u0648\u0636\u0639\u06cc\u062a"] || "\u0645\u0648\u0642\u062a") === "\u0645\u0648\u0642\u062a";
    });
  }
  function fillSelects() {
    var temps = tempList();
    document.querySelectorAll(".sf-fin-sel").forEach(function (sel) {
      var cur = sel.value;
      sel.innerHTML = temps.map(function (v) {
        return "<option value=\"" + v.id + "\">#" +
          (v["\u0634\u0645\u0627\u0631\u0647"] || "?") + " — " +
          String(v["\u0634\u0631\u062d"] || "").slice(0, 36) + "</option>";
      }).join("") || "<option value=\"\">\u0633\u0646\u062f \u0645\u0648\u0642\u062a\u06cc \u0646\u06cc\u0633\u062a</option>";
      if (cur) sel.value = cur;
    });
  }

  function makeBar(id) {
    if (document.getElementById(id)) return document.getElementById(id);
    var bar = document.createElement("div");
    bar.id = id;
    bar.className = "sf-finalize-bar";
    bar.style.cssText =
      "margin:10px 0;padding:12px;border:1px solid #7c3aed;border-radius:12px;" +
      "background:linear-gradient(135deg,#1e1b4b,#0f172a);color:#e2e8f0;" +
      "font-family:Tahoma,sans-serif;direction:rtl;text-align:right";
    bar.innerHTML =
      "<div style=\"font-weight:800;color:#c4b5fd;margin-bottom:8px\">\u26a1 \u0642\u0637\u0639\u06cc\u200c\u0633\u0627\u0632\u06cc \u0633\u0646\u062f \u0645\u0648\u0642\u062a \u2192 \u062f\u0627\u0626\u0645</div>" +
      "<div style=\"display:flex;gap:8px;flex-wrap:wrap;align-items:center\">" +
      "<select class=\"sf-fin-sel\" style=\"flex:1;min-width:200px;padding:8px;border-radius:8px;border:1px solid #4c1d95;background:#020617;color:#e2e8f0;font-family:inherit\"></select>" +
      "<button type=\"button\" class=\"sf-fin-resolve\" style=\"background:#334155;color:#fff;border:none;border-radius:8px;padding:8px 10px;font-weight:700;cursor:pointer;font-family:inherit\">\u062d\u0644 TEMP</button>" +
      "<button type=\"button\" class=\"sf-fin-go\" style=\"background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-weight:800;cursor:pointer;font-family:inherit\">\u062f\u0627\u0626\u0645 \u06a9\u0631\u062f\u0646</button>" +
      "</div>" +
      "<div style=\"margin-top:6px;font-size:11px;color:#94a3b8\">\u0627\u0628\u062a\u062f\u0627 \u06a9\u062f \u062d\u0633\u0627\u0628 \u0648\u0627\u0642\u0639\u06cc \u2014 \u0633\u067e\u0633 \u062f\u0627\u0626\u0645</div>";
    bar.querySelector(".sf-fin-resolve").onclick = function () {
      if (typeof window.sfResolveTempCodes === "function") window.sfResolveTempCodes();
      if (typeof window.sfPatchVoucherFormCodes === "function") window.sfPatchVoucherFormCodes();
      fillSelects();
    };
    bar.querySelector(".sf-fin-go").onclick = function () {
      var sel = bar.querySelector(".sf-fin-sel");
      var id = sel && sel.value;
      if (!id) {
        alert("\u0633\u0646\u062f \u0645\u0648\u0642\u062a\u06cc \u0627\u0646\u062a\u062e\u0627\u0628 \u0646\u0634\u062f\u0647");
        return;
      }
      window.sfFinalizeTempVoucher(id);
    };
    return bar;
  }

  function place() {
    // 1) sticky under header
    if (!document.getElementById("sfFinalizeTop")) {
      var top = makeBar("sfFinalizeTop");
      var header = document.querySelector("header.header") || document.querySelector(".header");
      if (header && header.parentNode) {
        header.parentNode.insertBefore(top, header.nextSibling);
      } else {
        document.body.insertBefore(top, document.body.firstChild);
      }
    }
    // 2) inside voucher panel card
    var vp = document.querySelector("#p-voucher .card");
    if (vp && !document.getElementById("sfFinalizeVoucher")) {
      var vb = makeBar("sfFinalizeVoucher");
      vp.insertBefore(vb, vp.firstChild.nextSibling);
    }
    // 3) nav item under ثبت dropdown
    var regDd = null;
    document.querySelectorAll(".nav-item").forEach(function (ni) {
      var nb = ni.querySelector(".nb");
      if (nb && /\u062b\u0628\u062a/.test(nb.textContent || "")) regDd = ni.querySelector(".dd");
    });
    if (regDd && !document.getElementById("sfFinNavBtn")) {
      var btn = document.createElement("button");
      btn.id = "sfFinNavBtn";
      btn.type = "button";
      btn.textContent = "\u0642\u0637\u0639\u06cc \u0633\u0646\u062f \u0645\u0648\u0642\u062a";
      btn.onclick = function () {
        var el = document.getElementById("sfFinalizeTop");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          el.style.outline = "2px solid #c4b5fd";
          setTimeout(function () { el.style.outline = ""; }, 1500);
        }
        fillSelects();
      };
      regDd.appendChild(btn);
    }
    fillSelects();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(place, 400); });
  } else setTimeout(place, 400);
  setInterval(place, 3000);
})();
</script>
'@

function Patch([string]$path) {
  if (-not (Test-Path $path)) { Write-Host "skip $path"; return }
  $t = [IO.File]::ReadAllText($path, $utf8)
  # remove weak previous finalize box only (keep function if any)
  if ($t -match '__sfFinalizeMenuVisible') {
    Write-Host "already visible menu $path"
    return
  }
  if ($t -match '</body>') {
    $t = $t.Replace('</body>', $block + "`r`n</body>")
  } else {
    $t = $t + $block
  }
  [IO.File]::WriteAllText($path, $t, $utf8)
  Write-Host "OK $path"
}

Patch (Join-Path $root 'accounting.html')
Patch (Join-Path $root 'server\public\accounting.html')
Write-Host 'Done. Ctrl+Shift+R on accounting — look under header + menu ثبت'
