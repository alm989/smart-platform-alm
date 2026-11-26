# UTF-8 safe: Persian UI via \u escapes — no literal Persian in this file
# powershell -ExecutionPolicy Bypass -File .\server\scripts\apply-effect-voucher-draft.ps1
$ErrorActionPreference = 'Stop'
$root = 'D:\smart-platform-alm'
if (-not (Test-Path (Join-Path $root 'accounting.html'))) {
  $root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
}

$newBlock = @'
<script>
/* __sfAccEffectsV2 — pending effects + voucher draft (unicode-safe UI) */
(function () {
  if (window.__sfAccEffectsV2) return;
  window.__sfAccEffectsV2 = true;
  window.__sfAccEffects = true;

  // Persian UI without literal non-ASCII in patch source
  var U = {
    title: "\u0622\u062b\u0627\u0631 \u0645\u0627\u0644\u06cc \u062f\u0631 \u0627\u0646\u062a\u0638\u0627\u0631",
    refresh: "\u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06cc",
    empty: "\u0645\u0648\u0631\u062f\u06cc \u062f\u0631 \u0627\u0646\u062a\u0638\u0627\u0631 \u0646\u06cc\u0633\u062a",
    login: "\u0627\u0628\u062a\u062f\u0627 \u0648\u0627\u0631\u062f \u0633\u0631\u0648\u0631 \u0634\u0648\u06cc\u062f",
    loading: "\u062f\u0631 \u062d\u0627\u0644 \u0628\u0627\u0631\u06af\u0630\u0627\u0631\u06cc\u2026",
    errLoad: "\u062e\u0637\u0627 \u062f\u0631 \u062f\u0631\u06cc\u0627\u0641\u062a \u0622\u062b\u0627\u0631",
    post: "\u062b\u0628\u062a\u200c\u0634\u062f\u0647 + \u067e\u06cc\u0634\u200c\u0646\u0648\u06cc\u0633 \u0633\u0646\u062f",
    rej: "\u0631\u062f",
    errNet: "\u062e\u0637\u0627\u06cc \u0634\u0628\u06a9\u0647",
    err: "\u062e\u0637\u0627",
    counter: "\u0637\u0631\u0641 \u0645\u0642\u0627\u0628\u0644 (\u062a\u06a9\u0645\u06cc\u0644 \u06a9\u062f \u062d\u0633\u0627\u0628)",
    draftOk: "\u067e\u06cc\u0634\u200c\u0646\u0648\u06cc\u0633 \u0633\u0646\u062f \u0633\u0627\u062e\u062a\u0647 \u0634\u062f \u2014 \u06a9\u062f \u062d\u0633\u0627\u0628 \u0631\u0627 \u062a\u06a9\u0645\u06cc\u0644 \u06a9\u0646\u06cc\u062f",
    src: "\u0645\u0646\u0628\u0639",
    effect: "\u0627\u062b\u0631 \u0645\u0627\u0644\u06cc",
    acct: "\u062d\u0633\u0627\u0628"
  };

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
      "margin:12px;padding:14px;border-radius:14px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;font-family:Tahoma,sans-serif;direction:rtl;text-align:right";
    box.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">' +
      '<b style="color:#fbbf24;font-size:.9rem">' + U.title + "</b>" +
      '<button type="button" id="sfFxRefresh" style="background:#0ea5e9;color:#fff;border:none;border-radius:8px;padding:6px 10px;font-weight:700;cursor:pointer;font-family:inherit;font-size:.72rem">' +
      U.refresh + "</button></div>" +
      '<div id="sfFxBody" style="font-size:.78rem;color:#94a3b8">' + U.loading + "</div>";
    if (host.firstChild) host.insertBefore(box, host.firstChild);
    else host.appendChild(box);
    var btn = document.getElementById("sfFxRefresh");
    if (btn) btn.onclick = load;
    return box;
  }
  function patch(id, body) {
    return fetch("/api/effects/" + encodeURIComponent(id), {
      method: "PATCH",
      headers: { Authorization: "Bearer " + tok(), "Content-Type": "application/json; charset=utf-8" },
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
      '<td><input class="vl-code" list="codeList" placeholder="code" value="' + esc(data && data.code || "") + '"></td>' +
      '<td><input class="vl-desc" value="' + esc(data && data.desc || "") + '"></td>' +
      '<td><input class="vl-debit" inputmode="decimal" value="' + esc(deb) + '"></td>' +
      '<td><input class="vl-credit" inputmode="decimal" value="' + esc(cre) + '"></td>' +
      '<td><button type="button" class="btn btn-b vl-del" style="padding:4px 8px">\u00d7</button></td>';
    body.appendChild(tr);
    var del = tr.querySelector(".vl-del");
    if (del) del.onclick = function () {
      tr.remove();
      try { if (typeof calcVoucherBal === "function") calcVoucherBal(); } catch (e) {}
    };
    function recalc() { try { if (typeof calcVoucherBal === "function") calcVoucherBal(); } catch (e) {} }
    tr.querySelector(".vl-debit").oninput = recalc;
    tr.querySelector(".vl-credit").oninput = recalc;
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
          vDesc.value = (fx.desc || U.effect) + " · " + U.src + ": " + (fx.source || "") +
            (fx.sourceId ? " #" + fx.sourceId : "") + " [" + fx.id + "]";
        }
        var vDate = document.getElementById("vDate");
        if (vDate && fx.date) vDate.value = fx.date;
        var body = document.getElementById("vBody");
        if (body) {
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
          desc: (fx.accountHint || fx.source || U.acct) + " — " + (fx.desc || ""),
          debit: isDebit ? amt : 0,
          credit: isDebit ? 0 : amt
        });
        appendSheetLine({
          code: "",
          desc: U.counter,
          debit: isDebit ? 0 : amt,
          credit: isDebit ? amt : 0
        });
        try { if (typeof calcVoucherBal === "function") calcVoucherBal(); } catch (e2) {}
        if (window.SmartCore && SmartCore.toast) SmartCore.toast(U.draftOk);
      } catch (err) { console.warn("[effect-voucher]", err); }
    }, 280);
  }
  function render(items) {
    var body = document.getElementById("sfFxBody");
    if (!body) return;
    items = (items || []).filter(function (x) { return x && x.status === "pending"; });
    if (!items.length) {
      body.innerHTML = '<div style="color:#64748b">' + U.empty + "</div>";
      return;
    }
    body.innerHTML = items.map(function (x) {
      var payload = {
        id: x.id, source: x.source, sourceId: x.sourceId, date: x.date,
        amount: x.amount, side: x.side, accountHint: x.accountHint, desc: x.desc
      };
      return (
        '<div data-fx="' + esc(x.id) + '" data-json="' + esc(JSON.stringify(payload)) +
        '" style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:10px;margin-bottom:8px;direction:rtl;text-align:right">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">' +
        "<div><b style=\"color:#e2e8f0\">" + esc(x.source || "—") + "</b> · " +
        faNum(x.amount) + ' <span style="color:#94a3b8">(' + esc(x.side || "") + ")</span></div>" +
        '<div style="color:#94a3b8;font-size:.7rem">' + esc(x.date || "") + "</div></div>" +
        '<div style="margin-top:6px;color:#cbd5e1">' + esc(x.desc || "") +
        (x.accountHint ? " · " + esc(x.accountHint) : "") + "</div>" +
        '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">' +
        '<button type="button" data-act="posted" style="background:#16a34a;color:#fff;border:none;border-radius:8px;padding:5px 10px;font-weight:700;cursor:pointer;font-family:Tahoma,sans-serif;font-size:.72rem">' +
        U.post + "</button>" +
        '<button type="button" data-act="rejected" style="background:#b91c1c;color:#fff;border:none;border-radius:8px;padding:5px 10px;font-weight:700;cursor:pointer;font-family:Tahoma,sans-serif;font-size:.72rem">' +
        U.rej + "</button></div></div>"
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
        patch(id, payload).then(function (j) {
          if (j && j.ok) {
            if (act === "posted" && fx) draftVoucherFromEffect(fx);
            load();
          } else {
            alert((j && j.error) || U.err);
            b.disabled = false;
          }
        }).catch(function () {
          alert(U.errNet);
          b.disabled = false;
        });
      };
    });
  }
  function load() {
    ensurePanel();
    var body = document.getElementById("sfFxBody");
    if (!tok()) {
      if (body) body.textContent = U.login;
      return;
    }
    if (body) body.textContent = U.loading;
    fetch("/api/effects?status=pending", {
      headers: { Authorization: "Bearer " + tok() }
    })
      .then(function (r) { return r.json(); })
      .then(function (j) { render((j && j.items) || []); })
      .catch(function () {
        if (body) body.textContent = U.errLoad;
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
  if (-not (Test-Path $path)) { Write-Host "skip $path"; return }
  $utf8 = New-Object System.Text.UTF8Encoding $false
  $t = [IO.File]::ReadAllText($path, $utf8)
  # restore from git if file already has classic mojibake markers in head title area
  if ($t -match '__sfAccEffectsV2') {
    $t = [regex]::Replace($t, '(?s)<script>\s*/\* __sfAccEffectsV2.*?</script>\s*', '')
  }
  if ($t -match '/\* __sfAccEffects') {
    $t = [regex]::Replace($t, '(?s)<script>\s*/\* __sfAccEffects.*?</script>\s*', '')
  }
  if ($t -match '</body>') {
    $t = $t.Replace('</body>', $newBlock + "`r`n</body>")
  } else {
    $t = $t + $newBlock
  }
  [IO.File]::WriteAllText($path, $t, $utf8)
  Write-Host "OK $path"
}

# If whole accounting Persian is broken, restore clean copy first
$acc = Join-Path $root 'accounting.html'
if (Test-Path $acc) {
  $sample = [IO.File]::ReadAllText($acc, [Text.UTF8Encoding]::new($false)).Substring(0, [Math]::Min(2500, (Get-Item $acc).Length))
  if ($sample -match 'Ã|Â|Ø§Ø|Ù¾') {
    Write-Host 'Detected mojibake — restoring accounting.html from origin/main...'
    Push-Location $root
    git checkout origin/main -- accounting.html server/public/accounting.html 2>$null
    Pop-Location
  }
}

Patch-File (Join-Path $root 'accounting.html')
Patch-File (Join-Path $root 'server\public\accounting.html')
Write-Host 'Done. Hard-refresh accounting (Ctrl+Shift+R).'
