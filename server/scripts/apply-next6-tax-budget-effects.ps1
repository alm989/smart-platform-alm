# Next-6: tax + budget -> /api/effects (online-first compatible)
# powershell -ExecutionPolicy Bypass -File .\server\scripts\apply-next6-tax-budget-effects.ps1
$ErrorActionPreference = 'Stop'
$root = 'D:\smart-platform-alm'
if (-not (Test-Path (Join-Path $root 'tax.html'))) {
  $root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
}
$utf8 = New-Object System.Text.UTF8Encoding $false

function Append-BeforeBody([string]$path, [string]$marker, [string]$block) {
  if (-not (Test-Path $path)) { Write-Host "skip $path"; return }
  $t = [IO.File]::ReadAllText($path, $utf8)
  if ($t -match [regex]::Escape($marker)) { Write-Host "already $marker $path"; return }
  if ($t -match '</body>') { $t = $t.Replace('</body>', $block + "`r`n</body>") }
  else { $t = $t + $block }
  [IO.File]::WriteAllText($path, $t, $utf8)
  Write-Host "OK $path"
}

$taxBlock = @'
<script>
/* __sfTaxEffect */
(function () {
  if (window.__sfTaxEffect) return;
  window.__sfTaxEffect = true;
  function toEnNum(s) {
    var FA = "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9";
    return Number(String(s || "").replace(/[\u06f0-\u06f9]/g, function (d) {
      return String(FA.indexOf(d));
    }).replace(/[^\d.-]/g, "")) || 0;
  }
  window.sfQueueTaxEffect = function (opts) {
    opts = opts || {};
    var amount = toEnNum(opts.amount);
    if (!amount) return Promise.resolve({ ok: false, error: "no-amount" });
    var payload = {
      source: "tax",
      sourceId: opts.sourceId || ("tax_" + Date.now()),
      date: opts.date || "",
      amount: Math.abs(amount),
      side: opts.side || "debit",
      accountHint: opts.accountHint || "\u0645\u0627\u0644\u06cc\u0627\u062a",
      desc: opts.desc || "\u0639\u0645\u0644\u06cc\u0627\u062a \u0645\u0627\u0644\u06cc\u0627\u062a\u06cc"
    };
    if (typeof window.sfPostEffectDeduped === "function") return window.sfPostEffectDeduped(payload);
    if (typeof window.sfPostEffectOnline === "function") return window.sfPostEffectOnline(payload);
    var t = sessionStorage.getItem("smart_suite_api_token") || "";
    if (!t) return Promise.resolve({ ok: false, error: "no-token" });
    return fetch("/api/effects", {
      method: "POST",
      headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  };
  function bind() {
    document.querySelectorAll("button, input[type=button]").forEach(function (b) {
      if (b._sfFx) return;
      var lab = ((b.textContent || "") + " " + (b.value || "")).trim();
      if (!/\u062b\u0628\u062t|\u062b\u0628\u062a|\u0630\u062e\u06cc\u0631\u0647|save/i.test(lab)) return;
      b._sfFx = true;
      b.addEventListener("click", function () {
        setTimeout(function () {
          try {
            var amtEl = document.querySelector('input[data-f*="\u0645\u0628\u0644\u063a"]') ||
              document.querySelector('input[data-f*="\u0645\u0627\u0644\u06cc\u0627\u062a"]') ||
              document.querySelector("input.amount");
            var descEl = document.querySelector('input[data-f*="\u0634\u0631\u062d"]');
            var dateEl = document.querySelector("input.jdate") ||
              document.querySelector('input[data-f*="\u062a\u0627\u0631\u06cc\u062e"]');
            if (!amtEl) return;
            var amount = toEnNum(amtEl.value);
            if (!amount) return;
            window.sfQueueTaxEffect({
              amount: amount,
              desc: (descEl && descEl.value) || "\u0645\u0627\u0644\u06cc\u0627\u062a",
              date: (dateEl && dateEl.value) || ""
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

$budgetBlock = @'
<script>
/* __sfBudgetEffect */
(function () {
  if (window.__sfBudgetEffect) return;
  window.__sfBudgetEffect = true;
  function toEnNum(s) {
    var FA = "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9";
    return Number(String(s || "").replace(/[\u06f0-\u06f9]/g, function (d) {
      return String(FA.indexOf(d));
    }).replace(/[^\d.-]/g, "")) || 0;
  }
  window.sfQueueBudgetEffect = function (opts) {
    opts = opts || {};
    var amount = toEnNum(opts.amount);
    if (!amount) return Promise.resolve({ ok: false, error: "no-amount" });
    var payload = {
      source: "budget",
      sourceId: opts.sourceId || ("budget_" + Date.now()),
      date: opts.date || "",
      amount: Math.abs(amount),
      side: opts.side || "debit",
      accountHint: opts.accountHint || "\u0628\u0648\u062f\u062c\u0647",
      desc: opts.desc || "\u062b\u0628\u062a \u0628\u0648\u062f\u062c\u0647"
    };
    if (typeof window.sfPostEffectDeduped === "function") return window.sfPostEffectDeduped(payload);
    if (typeof window.sfPostEffectOnline === "function") return window.sfPostEffectOnline(payload);
    var t = sessionStorage.getItem("smart_suite_api_token") || "";
    if (!t) return Promise.resolve({ ok: false, error: "no-token" });
    return fetch("/api/effects", {
      method: "POST",
      headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  };
  function bind() {
    document.querySelectorAll("button, input[type=button]").forEach(function (b) {
      if (b._sfFx) return;
      var lab = ((b.textContent || "") + " " + (b.value || "")).trim();
      if (!/\u062b\u0628\u062a|\u0630\u062e\u06cc\u0631\u0647|save/i.test(lab)) return;
      b._sfFx = true;
      b.addEventListener("click", function () {
        setTimeout(function () {
          try {
            var amtEl = document.querySelector('input[data-f*="\u0645\u0628\u0644\u063a"]') ||
              document.querySelector('input[data-f*="\u0628\u0648\u062f\u062c\u0647"]') ||
              document.querySelector('input[data-f*="\u062c\u0645\u0639"]') ||
              document.querySelector("input.amount");
            var descEl = document.querySelector('input[data-f*="\u0634\u0631\u062d"]');
            var dateEl = document.querySelector("input.jdate") ||
              document.querySelector('input[data-f*="\u062a\u0627\u0631\u06cc\u062e"]');
            if (!amtEl) return;
            var amount = toEnNum(amtEl.value);
            if (!amount) return;
            window.sfQueueBudgetEffect({
              amount: amount,
              desc: (descEl && descEl.value) || "\u0628\u0648\u062f\u062c\u0647",
              date: (dateEl && dateEl.value) || ""
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

# ensure online-first also rewires tax/budget if present
$wireExtra = @'
<script>
/* __sfWireTaxBudgetOnline */
(function () {
  if (window.__sfWireTaxBudgetOnline) return;
  window.__sfWireTaxBudgetOnline = true;
  function rewire(name, source, side, hint) {
    if (typeof window.sfPostEffectDeduped !== "function" && typeof window.sfPostEffectOnline !== "function") return;
    window[name] = function (opts) {
      opts = opts || {};
      var FA = "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9";
      var amount = Number(String(opts.amount || "").replace(/[\u06f0-\u06f9]/g, function (d) {
        return String(FA.indexOf(d));
      }).replace(/[^\d.-]/g, "")) || Number(opts.amount) || 0;
      if (!amount) return Promise.resolve({ ok: false, error: "no-amount" });
      var payload = {
        source: source,
        sourceId: opts.sourceId || (source + "_" + Date.now()),
        date: opts.date || "",
        amount: Math.abs(amount),
        side: opts.side || side,
        accountHint: opts.accountHint || hint,
        desc: opts.desc || hint
      };
      if (typeof window.sfPostEffectDeduped === "function") return window.sfPostEffectDeduped(payload);
      return window.sfPostEffectOnline(payload);
    };
  }
  function tick() {
    rewire("sfQueueTaxEffect", "tax", "debit", "\u0645\u0627\u0644\u06cc\u0627\u062a");
    rewire("sfQueueBudgetEffect", "budget", "debit", "\u0628\u0648\u062f\u062c\u0647");
    rewire("sfQueueWarehouseEffect", "warehouse", "debit", "\u0627\u0646\u0628\u0627\u0631");
  }
  tick();
  setInterval(tick, 2000);
})();
</script>
'@

Append-BeforeBody (Join-Path $root 'tax.html') '__sfTaxEffect' $taxBlock
Append-BeforeBody (Join-Path $root 'server\public\tax.html') '__sfTaxEffect' $taxBlock
Append-BeforeBody (Join-Path $root 'budget.html') '__sfBudgetEffect' $budgetBlock
Append-BeforeBody (Join-Path $root 'server\public\budget.html') '__sfBudgetEffect' $budgetBlock

@('tax.html','server\public\tax.html','budget.html','server\public\budget.html','warehouse.html','server\public\warehouse.html','suite.html','server\public\suite.html') | ForEach-Object {
  Append-BeforeBody (Join-Path $root $_) '__sfWireTaxBudgetOnline' $wireExtra
}

Write-Host 'Next-6: tax + budget effects ready. COPY-MODULES + Ctrl+Shift+R'
