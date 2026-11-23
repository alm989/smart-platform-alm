# Priority A — IAM harden, audit, backup control, accounting separators
# Run from: D:\smart-platform-alm\server
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (!(Test-Path (Join-Path $root 'server\server.js'))) {
  $root = 'D:\smart-platform-alm'
}
$serverJs = Join-Path $root 'server\server.js'
if (!(Test-Path $serverJs)) { throw "server.js not found: $serverJs" }

Copy-Item $serverJs ($serverJs + '.bak-priorityA') -Force
$t = [IO.File]::ReadAllText($serverJs)

if ($t -match 'PriorityA-IAM') {
  Write-Host 'Priority A server block already present'
} else {

# --- audit helper ---
$auditFn = @'

/* PriorityA-IAM: central audit + stricter users API */
function auditPath() { return path.join(DATA, 'audit.json'); }
function appendAudit(ev) {
  try {
    const p = auditPath();
    const db = loadJson(p, { items: [] });
    db.items = db.items || [];
    db.items.unshift(Object.assign({
      id: 'au_' + uid(),
      at: new Date().toISOString()
    }, ev || {}));
    if (db.items.length > 5000) db.items = db.items.slice(0, 5000);
    saveJson(p, db);
  } catch (e) {
    console.warn('[audit]', e.message);
  }
}
'@

if ($t -notmatch 'function appendAudit') {
  $t = $t.Replace('function can(session, perm) {', $auditFn + "`r`nfunction can(session, perm) {")
}

# login audit
$t = $t.Replace(
  'const token = tokenNew(session);`r`n    return send(res, 200, { ok: true, token, user: session });',
  "const token = tokenNew(session);`r`n    appendAudit({ action: 'login', user: session.user, role: session.role, ip: ip });`r`n    return send(res, 200, { ok: true, token, user: session });"
)
if ($t -notmatch "appendAudit\(\{ action: 'login'") {
  $t = $t.Replace(
    'const token = tokenNew(session);`n    return send(res, 200, { ok: true, token, user: session });',
    "const token = tokenNew(session);`n    appendAudit({ action: 'login', user: session.user, role: session.role, ip: ip });`n    return send(res, 200, { ok: true, token, user: session });"
  )
}

# logout audit
$t = $t.Replace(
  "if (pathname === '/api/auth/logout' && method === 'POST') {`r`n    const h = req.headers['authorization'] || '';`r`n    const m = h.match(/^Bearer\s+(.+)$/i);`r`n    if (m) sessions.delete(m[1].trim());`r`n    return send(res, 200, { ok: true });`r`n  }",
  "if (pathname === '/api/auth/logout' && method === 'POST') {`r`n    const h = req.headers['authorization'] || '';`r`n    const m = h.match(/^Bearer\s+(.+)$/i);`r`n    const sOut = tokenGet(req);`r`n    if (m) sessions.delete(m[1].trim());`r`n    appendAudit({ action: 'logout', user: sOut && sOut.user, role: sOut && sOut.role });`r`n    return send(res, 200, { ok: true });`r`n  }"
)

# users GET requires users or *
$t = $t.Replace(
  "if (pathname === '/api/users' && method === 'GET') {`r`n    const s = tokenGet(req);`r`n    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });`r`n    const db = usersDb();",
  "if (pathname === '/api/users' && method === 'GET') {`r`n    const s = tokenGet(req);`r`n    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });`r`n    if (!can(s, 'users') && !can(s, '*')) return send(res, 403, { ok: false, error: 'دسترسی کاربران نیست' });`r`n    const db = usersDb();"
)

# module write audit
$t = $t.Replace(
  'saveJson(fp, next);`r`n      return send(res, 200, {`r`n        ok: true,`r`n        moduleId: id,`r`n        version: next.version,`r`n        updatedAt: next.updatedAt`r`n      });',
  "saveJson(fp, next);`r`n      appendAudit({ action: 'module_save', user: s.user, role: s.role, moduleId: id, version: next.version });`r`n      return send(res, 200, {`r`n        ok: true,`r`n        moduleId: id,`r`n        version: next.version,`r`n        updatedAt: next.updatedAt`r`n      });"
)

# backup POST audit if simple pattern
if ($t -match "runBackup\('manual'\)" -or $t -match 'runBackup\("manual"\)') {
  $t = [regex]::Replace($t, "(const id = runBackup\(['\"]manual['\"]\);)", "`$1`r`n    appendAudit({ action: 'backup', user: s.user, role: s.role, backup: id });")
}

# GET /api/audit
if ($t -notmatch "pathname === '/api/audit'") {
  $auditApi = @'

  if (pathname === '/api/audit' && method === 'GET') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    if (!(s.role === 'admin' || s.role === 'ceo' || can(s, '*'))) {
      return send(res, 403, { ok: false, error: 'دسترسی audit نیست' });
    }
    const db = loadJson(auditPath(), { items: [] });
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 500);
    return send(res, 200, { ok: true, items: (db.items || []).slice(0, limit) });
  }

'@
  if ($t -match "return send\(res, 404, \{ ok: false, error: 'api not found' \}\);") {
    $t = $t.Replace("return send(res, 404, { ok: false, error: 'api not found' });", $auditApi + "`r`n  return send(res, 404, { ok: false, error: 'api not found' });")
  } else {
    $idx = $t.LastIndexOf('return send(res, 404')
    if ($idx -gt 0) { $t = $t.Insert($idx, $auditApi + "`r`n  ") }
  }
}

# ensure backup restore needs backup perm + audit (if restore exists)
if ($t -match 'backup/restore' -and $t -notmatch "appendAudit\(\{ action: 'restore'") {
  $t = [regex]::Replace($t, '(runRestore\([^)]+\);|restoreBackup\([^)]+\);)', "`$1`r`n      appendAudit({ action: 'restore', user: s.user, role: s.role });")
}

[IO.File]::WriteAllText($serverJs, $t, [Text.UTF8Encoding]::new($false))
Write-Host "OK server.js Priority A"
}

# --- accounting amount separators ---
$accSnip = @'

<script>
/* __sfAccSep PriorityA */
(function () {
  if (window.__sfAccSep) return;
  window.__sfAccSep = true;
  var FA = "۰۱۲۳۴۵۶۷۸۹";
  function toEn(s) {
    return String(s || "").replace(/[۰-۹]/g, function (d) { return String(FA.indexOf(d)); })
      .replace(/[٠-٩]/g, function (d) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(d)); })
      .replace(/[^\d.\-]/g, "");
  }
  function toFa(s) { return String(s || "").replace(/[0-9]/g, function (d) { return FA[+d]; }); }
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
    var en = toEn(raw);
    if (!en || en === "-" || en === ".") return "";
    var neg = en.charAt(0) === "-";
    if (neg) en = en.slice(1);
    var p = en.split(".");
    var g = group3(p[0] || "0");
    if (p.length > 1) g += "." + p[1];
    if (neg) g = "-" + g;
    return toFa(g);
  }
  function isAmt(el) {
    return el && el.classList && (el.classList.contains("vl-debit") || el.classList.contains("vl-credit"));
  }
  function bind(el) {
    if (!el || el._accSep) return;
    el._accSep = true;
    el.addEventListener("focus", function () {
      if (!isAmt(el)) return;
      el.value = toFa(toEn(el.value || ""));
    });
    el.addEventListener("blur", function () {
      if (!isAmt(el)) return;
      var v = (el.value || "").trim();
      if (v) el.value = formatGrouped(v);
      try { if (typeof calcVoucherBal === "function") calcVoucherBal(); } catch (e) {}
    });
  }
  function scan() { document.querySelectorAll("input.vl-debit, input.vl-credit").forEach(bind); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
  setInterval(scan, 1000);
})();
</script>
'@

foreach ($f in @(
  (Join-Path $root 'accounting.html'),
  (Join-Path $root 'server\public\accounting.html')
)) {
  if (!(Test-Path $f)) { continue }
  $html = [IO.File]::ReadAllText($f)
  if ($html -match '__sfAccSep') { Write-Host "acc sep already $f"; continue }
  if ($html -match '</body>') {
    $html = $html.Replace('</body>', $accSnip + "`r`n</body>")
  } else { $html = $html + $accSnip }
  [IO.File]::WriteAllText($f, $html, [Text.UTF8Encoding]::new($false))
  Write-Host "OK accounting sep $f"
}

Write-Host ''
Write-Host '=== Priority A applied ==='
Write-Host '1) Restart server: node server.js'
Write-Host '2) Test login then: fetch("/api/audit",{headers:{Authorization:"Bearer "+sessionStorage.getItem("smart_suite_api_token")}}).then(r=>r.json()).then(console.log)'
Write-Host '3) Accounting voucher: debit/credit blur -> 1,000,000'
