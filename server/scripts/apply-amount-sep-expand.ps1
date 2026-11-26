# Expand thousand-separator to vl-debit/credit and common amount classes — unicode-safe injection into core.js
$ErrorActionPreference = 'Stop'
$root = 'D:\smart-platform-alm'
$files = @(
  (Join-Path $root 'core.js'),
  (Join-Path $root 'server\public\core.js')
)

$block = @'

/* ===== AMOUNT-SEP-EXPAND ===== */
(function (w) {
  if (w.__sfAmtSepX) return;
  w.__sfAmtSepX = true;
  var FA = "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9";
  function toEn(s) {
    return String(s == null ? "" : s)
      .replace(/[\u06f0-\u06f9]/g, function (d) { return String(FA.indexOf(d)); })
      .replace(/[\u0660-\u0669]/g, function (d) {
        return String("\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669".indexOf(d));
      });
  }
  function toFa(s) {
    return String(s == null ? "" : s).replace(/[0-9]/g, function (d) { return FA[+d]; });
  }
  function group3(intPart) {
    var sign = "";
    if (intPart.charAt(0) === "-") { sign = "-"; intPart = intPart.slice(1); }
    var out = "";
    for (var i = 0; i < intPart.length; i++) {
      if (i && (intPart.length - i) % 3 === 0) out += ",";
      out += intPart.charAt(i);
    }
    return sign + out;
  }
  function formatGrouped(raw) {
    var en = toEn(raw).replace(/[^\d.\-]/g, "");
    if (!en || en === "-" || en === ".") return raw;
    var neg = en.charAt(0) === "-";
    if (neg) en = en.slice(1);
    var p = en.split(".");
    var g = group3(p[0] || "0");
    if (p.length > 1) g += "." + p[1];
    if (neg) g = "-" + g;
    return toFa(g);
  }
  function isAmount(el) {
    if (!el || el.tagName !== "INPUT") return false;
    if (el.type === "password" || el.type === "file" || el.type === "checkbox") return false;
    if (el.classList && (el.classList.contains("jdate") || el.classList.contains("no-sep"))) return false;
    if (el.classList && (el.classList.contains("vl-debit") || el.classList.contains("vl-credit"))) return true;
    var id = (el.id || "").toLowerCase();
    if (/amount|price|total|debit|credit|mablagh|price|sum|bal/.test(id)) return true;
    var f = ((el.getAttribute("data-f") || "") + " " + (el.placeholder || "") + " " + (el.name || "")).toLowerCase();
    if (/\u0645\u0628\u0644\u063a|\u0642\u06cc\u0645\u062a|\u0645\u0627\u0646\u062f\u0647|\u0645\u0648\u062c\u0648\u062f\u06cc|\u062c\u0645\u0639|\u0647\u0632\u06cc\u0646\u0647|\u062f\u0631\u06cc\u0627\u0641\u062a|\u067e\u0631\u062f\u0627\u062e\u062a|\u062d\u0642\u0648\u0642|\u0628\u0648\u062f\u062c\u0647|amount|price|total|debit|credit/i.test(f))
      return true;
    if (el.getAttribute("inputmode") === "decimal" && !/pin|code|user|pass/i.test(id + f)) return true;
    return false;
  }
  function bind(el) {
    if (!el || el._sfAmtX) return;
    el._sfAmtX = true;
    el.addEventListener("focus", function () {
      if (!isAmount(el)) return;
      el.value = toFa(toEn(el.value || "").replace(/[^\d.\-]/g, ""));
    });
    el.addEventListener("blur", function () {
      if (!isAmount(el)) return;
      var v = (el.value || "").trim();
      if (v) el.value = formatGrouped(v);
    });
  }
  function scan() {
    document.querySelectorAll("input").forEach(bind);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
  setInterval(scan, 2000);
})(typeof window !== "undefined" ? window : this);
'@

$utf8 = New-Object System.Text.UTF8Encoding $false
foreach ($f in $files) {
  if (-not (Test-Path $f)) { Write-Host "skip $f"; continue }
  $t = [IO.File]::ReadAllText($f, $utf8)
  $t = [regex]::Replace($t, '(?s)/\* ===== AMOUNT-SEP-EXPAND ===== \*/[\s\S]*?\}\)\(typeof window[\s\S]*?\);\s*', "`n")
  if ($t -notmatch '__sfAmtSepX') {
    $t = $t + "`n" + $block
  }
  [IO.File]::WriteAllText($f, $t, $utf8)
  Write-Host "OK $f"
}
Write-Host 'Step3 OK: amount separators expanded. Ctrl+Shift+R'
