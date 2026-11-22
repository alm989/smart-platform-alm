# Step 1-2: Date (Intl) + thousand separators — SAFE (no layout-breaking CSS)
$ErrorActionPreference = 'Stop'
$roots = @('D:\smart-platform-alm', 'D:\smart-platform-alm\server\public')

$block = @'

/* ===== STEP1-2 date+numbers SAFE ===== */
(function (w) {
  if (w.__sfStep12) return;
  w.__sfStep12 = true;

  var FA = "۰۱۲۳۴۵۶۷۸۹";
  function toEn(s) {
    return String(s == null ? "" : s)
      .replace(/[۰-۹]/g, function (d) { return String(FA.indexOf(d)); })
      .replace(/[٠-٩]/g, function (d) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(d)); });
  }
  function toFa(s) {
    return String(s == null ? "" : s).replace(/[0-9]/g, function (d) { return FA[+d]; });
  }

  function g2j(gy, gm, gd) {
    var dt = new Date(gy, gm - 1, gd, 12, 0, 0);
    var parts = new Intl.DateTimeFormat("en-u-ca-persian", {
      year: "numeric", month: "numeric", day: "numeric"
    }).formatToParts(dt);
    var m = {};
    parts.forEach(function (p) { m[p.type] = p.value; });
    return {
      jy: parseInt(m.year, 10),
      jm: parseInt(m.month, 10),
      jd: parseInt(m.day, 10)
    };
  }

  // approximate j2g via binary search on g2j (safe, no bad month)
  function j2g(jy, jm, jd) {
    var lo = Date.UTC(jy + 621, 0, 1);
    var hi = Date.UTC(jy + 622, 11, 31);
    for (var i = 0; i < 40; i++) {
      var mid = Math.floor((lo + hi) / 2);
      var d = new Date(mid);
      var j = g2j(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      var key = j.jy * 10000 + j.jm * 100 + j.jd;
      var target = jy * 10000 + jm * 100 + jd;
      if (key === target) {
        return { gy: d.getUTCFullYear(), gm: d.getUTCMonth() + 1, gd: d.getUTCDate() };
      }
      if (key < target) lo = mid + 86400000;
      else hi = mid - 86400000;
    }
    var d2 = new Date(lo);
    return { gy: d2.getUTCFullYear(), gm: d2.getUTCMonth() + 1, gd: d2.getUTCDate() };
  }

  function isLeap(jy) {
    var a = g2j(jy + 621, 3, 21);
    // length of year: compare day count Farvardin1 to next
    var g0 = j2g(jy, 1, 1);
    var g1 = j2g(jy + 1, 1, 1);
    var days = Math.round((Date.UTC(g1.gy, g1.gm - 1, g1.gd) - Date.UTC(g0.gy, g0.gm - 1, g0.gd)) / 86400000);
    return days === 366;
  }

  function jML(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return isLeap(jy) ? 30 : 29;
  }

  function jWeekday(jy, jm, jd) {
    var g = j2g(jy, jm, jd);
    return (new Date(g.gy, g.gm - 1, g.gd).getDay() + 1) % 7;
  }

  w.SmartCore = w.SmartCore || {};
  w.SmartCore.date = {
    g2j: g2j,
    j2g: j2g,
    jML: jML,
    isLeap: isLeap,
    jWeekday: jWeekday,
    toFa: toFa,
    toEn: toEn,
    todayJ: function () {
      var n = new Date();
      var j = g2j(n.getFullYear(), n.getMonth() + 1, n.getDate());
      return toFa(j.jy) + "/" + toFa(String(j.jm).padStart(2, "0")) + "/" + toFa(String(j.jd).padStart(2, "0"));
    }
  };

  // soft override globals used by modules (after their defs)
  function softOverride() {
    try {
      if (typeof w.g2j === "function") w.g2j = g2j;
      if (typeof w.j2g === "function") w.j2g = j2g;
      if (typeof w.jML === "function") w.jML = jML;
    } catch (e) {}
  }
  setTimeout(softOverride, 0);
  setInterval(softOverride, 3000);

  // today highlight only — no size changes
  var st = document.createElement("style");
  st.textContent = ".jcal-d button.sf-today{background:rgba(59,130,246,.3);outline:1px solid #3b82f6;border-radius:8px}";
  (document.head || document.documentElement).appendChild(st);

  function markToday() {
    try {
      var n = new Date();
      var j = g2j(n.getFullYear(), n.getMonth() + 1, n.getDate());
      document.querySelectorAll(".jcal-d button").forEach(function (b) {
        b.classList.remove("sf-today");
        if (b.disabled) return;
        var t = (b.querySelector(".jd") && b.querySelector(".jd").textContent) || "";
        var day = parseInt(toEn(t).replace(/\D/g, ""), 10);
        if (day === j.jd) b.classList.add("sf-today");
      });
    } catch (e) {}
  }
  setInterval(markToday, 1000);
  document.addEventListener("click", function () { setTimeout(markToday, 30); }, true);

  // thousand sep for amount fields only
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
    if (el.type === "password" || el.type === "file") return false;
    if (el.classList && (el.classList.contains("jdate") || el.classList.contains("no-sep"))) return false;
    var f = ((el.getAttribute("data-f") || "") + " " + (el.placeholder || "")).toLowerCase();
    return /مبلغ|قیمت|مانده|موجودی|جمع|کل|هزینه|دریافت|پرداخت|حقوق|بودجه|تومان|ریال|amount|price|total/i.test(f);
  }
  function bind(el) {
    if (!el || el._sf12) return;
    el._sf12 = true;
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
  function scan() { document.querySelectorAll("input").forEach(bind); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
  setInterval(scan, 2500);
})(typeof window !== "undefined" ? window : this);
'@

foreach ($dir in $roots) {
  $cf = Join-Path $dir 'core.js'
  if (!(Test-Path $cf)) { Write-Host "skip $cf"; continue }
  $c = [IO.File]::ReadAllText($cf)
  # strip prior experimental date/num blocks (keep layout safe)
  $c = [regex]::Replace($c, '(?s)/\* ===== SmartSuite Date[\s\S]*?\}\)\(typeof window[\s\S]*?\);\s*', "`n")
  $c = [regex]::Replace($c, '(?s)/\* ===== STEP1-2 date\+numbers SAFE ===== \*/[\s\S]*?\}\)\(typeof window[\s\S]*?\);\s*', "`n")
  $c = [regex]::Replace($c, '(?s)/\* thousand separators[\s\S]*?\}\)\(\);\s*', "`n")
  $c = [regex]::Replace($c, '(?s)/\* ===== calendar size restore[\s\S]*?\}\)\(\);\s*', "`n")
  if ($c -notmatch '__sfStep12') {
    $c = $c + "`n" + $block
  }
  [IO.File]::WriteAllText($cf, $c, [Text.UTF8Encoding]::new($false))
  Write-Host "OK $cf"
}
Write-Host 'Step 1-2 applied. Ctrl+Shift+R'
