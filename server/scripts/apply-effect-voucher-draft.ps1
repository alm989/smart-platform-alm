# Apply effect -> accounting voucher draft (Priority B next step)
# Run: powershell -ExecutionPolicy Bypass -File .\server\scripts\apply-effect-voucher-draft.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not (Test-Path (Join-Path $root 'accounting.html'))) {
  $root = 'D:\smart-platform-alm'
}
$newBlock = @'
<script>
/* __sfAccEffects PriorityB+ draft voucher from posted effect */
(function () {
  if (window.__sfAccEffectsV2) return;
  window.__sfAccEffectsV2 = true;
  window.__sfAccEffects = true;

  function tok() {
    return sessionStorage.getItem("smart_suite_api_token") || "";
  }
  function faNum(n) {
    try { return Number(n || 0).toLocaleString("fa-IR"); }
    catch (e) { return String(n || 0); }
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }
  function ensurePanel() {
    if (document.getElementById("sfFxPanel")) return document.getElementById("sfFxPanel");
    var host = document.querySelector(".main") || document.body;
    if (!host) return null;
    var box = document.createElement("div");
    box.id = "sfFxPanel";
    box.style.cssText =
      "margin:12px;padding:14px;border-radius:14px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;font-family:Tahoma,sans-serif";
    box.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">' +
      '<b style="color:#fbbf24;font-size:.9rem">آثار مالی در انتظار</b>' +
      '<button type="button" id="sfFxRefresh" style="background:#0ea5e9;color:#fff;border:none;border-radius:8px;padding:6px 10px;font-weight:700;cursor:pointer;font-family:inherit;font-size:.72rem">بروزرسانی</button>' +
      "</div>" +
      '<div id="sfFxBody" style="font-size:.78rem;color:#94a3b8">در حال بارگذاری…</div>';
    if (host.firstChild) host.insertBefore(box, host.firstChild);
    else host.appendChild(box);
    var btn = document.getElementById("sfFxRefresh");
    if (btn) btn.onclick = load;
    return box;
  }
  function patch(id, body) {
    return fetch("/api/effects/" + encodeURIComponent(id), {
      method: "PATCH",
      headers: {
        Authorization: "Bearer " + tok(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); });
  }
  function openVoucherPanel() {
    var b = document.querySelector('[data-panel="p-voucher"]');
    if (b) b.click();
    var p = document.getElementById("p-voucher");
    if (p) {
      document.querySelectorAll(".panel").forEach(function (x) { x.classList.remove("on"); });
      p.classList.add("on");
    }
  }
  function appendSheetLine(data) {
    var body = document.getElementById("vBody");
    if (!body) return;
    var n = body.querySelectorAll("tr").length + 1;
    var deb = data && data.debit ? String(data.debit) : "";
    var cre = data && data.credit ? String(data.credit) : "";
    var tr = document.createElement("tr");
    tr.innerHTML =
      '<td style="text-align:center;color:#94a3b8;padding:6px">' + n + "</td>" +
      '<td><input class="vl-code" list="codeList" placeholder="کد" value="' + esc(data && data.code || "") + '"></td>' +
      '<td><input class="vl-desc" placeholder="شرح ردیف" value="' + esc(data && data.desc || "") + '"></td>' +
      '<td><input class="vl-debit" inputmode="decimal" value="' + esc(deb) + '"></td>' +
      '<td><input class="vl-credit" inputmode="decimal" value="' + esc(cre) + '"></td>' +
      '<td><button type="button" class="btn btn-b vl-del" style="padding:4px 8px">×</button></td>';
    body.appendChild(tr);
    var del = tr.querySelector(".vl-del");
    if (del) del.onclick = function () {
      tr.remove();
      try { if (typeof calcVoucherBal === "function") calcVoucherBal(); } catch (e) {}
    };
    tr.querySelector(".vl-debit").oninput = function () {
      try { if (typeof calcVoucherBal === "function") calcVoucherBal(); } catch (e) {}
    };
    tr.querySelector(".vl-credit").oninput = function () {
      try { if (typeof calcVoucherBal === "function") calcVoucherBal(); } catch (e) {}
    };
  }
  function draftVoucherFromEffect(fx) {
    openVoucherPanel();
    setTimeout(function () {
      try {
        var amt = Number(fx.amount) || 0;
        if (!amt) return;
        var isDebit = String(fx.side || "debit").toLowerCase() !== "credit";
        var vDesc = document.getElementById("vDesc");
        if (vDesc) {
          vDesc.value = (fx.desc || "اثر مالی") +
            " · منبع: " + (fx.source || "") +
            (fx.sourceId ? " #" + fx.sourceId : "") +
            " [" + fx.id + "]";
        }
        var vDate = document.getElementById("vDate");
        if (vDate && fx.date) vDate.value = fx.date;
        var body = document.getElementById("vBody");
        if (body) {
          // clear empty starter rows
          Array.prototype.slice.call(body.querySelectorAll("tr")).forEach(function (tr) {
            var c = (tr.querySelector(".vl-code") && tr.querySelector(".vl-code").value) || "";
            var d = (tr.querySelector(".vl-desc") && tr.querySelector(".vl-desc").value) || "";
            var deb = (tr.querySelector(".vl-debit") && tr.querySelector(".vl-debit").value) || "";
            var cre = (tr.querySelector(".vl-credit") && tr.querySelector(".vl-credit").value) || "";
            if (!c && !d && !deb && !cre) tr.remove();
          });
        }
        appendSheetLine({
          code: "",
          desc: (fx.accountHint || fx.source || "حساب") + " — " + (fx.desc || ""),
          debit: isDebit ? amt : 0,
          credit: isDebit ? 0 : amt
        });
        appendSheetLine({
          code: "",
          desc: "طرف مقابل (تکمیل کد حساب)",
          debit: isDebit ? 0 : amt,
          credit: isDebit ? amt : 0
        });
        try { if (typeof calcVoucherBal === "function") calcVoucherBal(); } catch (e2) {}
        if (window.SmartCore && SmartCore.toast) {
          SmartCore.toast("پیش‌نویس سند از اثر ساخته شد — کد حساب را تکمیل کنید");
        }
        console.log("[effect→voucher] drafted", fx.id, amt);
      } catch (err) {
        console.warn("[effect→voucher]", err);
      }
    }, 280);
  }
  function render(items) {
    var body = document.getElementById("sfFxBody");
    if (!body) return;
    items = (items || []).filter(function (x) { return x && x.status === "pending"; });
    if (!items.length) {
      body.innerHTML = '<div style="color:#64748b">موردی در انتظار نیست</div>';
      return;
    }
    body.innerHTML = items.map(function (x) {
      return (
        '<div data-fx="' + esc(x.id) + '" data-json="' + esc(JSON.stringify({
          id: x.id, source: x.source, sourceId: x.sourceId, date: x.date,
          amount: x.amount, side: x.side, accountHint: x.accountHint, desc: x.desc
        })) + '" style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:10px;margin-bottom:8px">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">' +
        "<div><b style=\"color:#e2e8f0\">" + esc(x.source || "—") + "</b> · " +
        faNum(x.amount) + ' <span style="color:#94a3b8">(' + esc(x.side || "") + ")</span></div>" +
        '<div style="color:#94a3b8;font-size:.7rem">' + esc(x.date || "") + "</div></div>" +
        '<div style="margin-top:6px;color:#cbd5e1">' + esc(x.desc || "") +
        (x.accountHint ? " · " + esc(x.accountHint) : "") + "</div>" +
        '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">' +
        '<button type="button" data-act="posted" style="background:#16a34a;color:#fff;border:none;border-radius:8px;padding:5px 10px;font-weight:700;cursor:pointer;font-family:inherit;font-size:.72rem">ثبت‌شده + پیش‌نویس سند</button>' +
        '<button type="button" data-act="rejected" style="background:#b91c1c;color:#fff;border:none;border-radius:8px;padding:5px 10px;font-weight:700;cursor:pointer;font-family:inherit;font-size:.72rem">رد</button>' +
        "</div></div>"
      );
    }).join("");

    body.querySelectorAll("button[data-act]").forEach(function (b) {
      b.onclick = function () {
        var card = b.closest("[data-fx]");
        var id = card && card.getAttribute("data-fx");
        var act = b.getAttribute("data-act");
        if (!id) return;
        var fx = null;
        try { fx = JSON.parse(card.getAttribute("data-json") || "null"); } catch (e) {}
        b.disabled = true;
        var payload = { status: act };
        if (act === "posted") payload.voucherRef = "draft:" + id;
        patch(id, payload)
          .then(function (j) {
            if (j && j.ok) {
              if (act === "posted" && fx) draftVoucherFromEffect(fx);
              load();
            } else {
              alert((j && j.error) || "خطا");
              b.disabled = false;
            }
          })
          .catch(function () {
            alert("خطای شبکه");
            b.disabled = false;
          });
      };
    });
  }
  function load() {
    ensurePanel();
    var body = document.getElementById("sfFxBody");
    if (!tok()) {
      if (body) body.textContent = "ابتدا وارد سرور شوید";
      return;
    }
    if (body) body.textContent = "در حال بارگذاری…";
    fetch("/api/effects?status=pending", {
      headers: { Authorization: "Bearer " + tok() }
    })
      .then(function (r) { return r.json(); })
      .then(function (j) { render((j && j.items) || []); })
      .catch(function () {
        if (body) body.textContent = "خطا در دریافت آثار";
      });
  }
  function boot() {
    if (!tok()) return;
    ensurePanel();
    load();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  setTimeout(boot, 900);
})();
</script>
'@

function Patch-File([string]$path) {
  if (-not (Test-Path $path)) { Write-Host "skip missing $path"; return }
  $t = [IO.File]::ReadAllText($path)
  if ($t -match '__sfAccEffectsV2') { Write-Host "already V2 $path"; return }
  if ($t -match '/\* __sfAccEffects') {
    $t = [regex]::Replace($t, '(?s)<script>\s*/\* __sfAccEffects.*?</script>\s*', [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $newBlock + "`r`n" })
  } elseif ($t -match '</body>') {
    $t = $t.Replace('</body>', $newBlock + "`r`n</body>")
  } else {
    $t = $t + $newBlock
  }
  [IO.File]::WriteAllText($path, $t, [Text.UTF8Encoding]::new($false))
  Write-Host "OK $path"
}

Patch-File (Join-Path $root 'accounting.html')
Patch-File (Join-Path $root 'server\public\accounting.html')
Write-Host 'Done. Ctrl+Shift+R on accounting, then POSTED button.'
