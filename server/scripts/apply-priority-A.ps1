# Priority A - fixed quoting for PowerShell 5+
$ErrorActionPreference = 'Stop'

$candidates = @(
  (Join-Path $PSScriptRoot '..\server.js'),
  'D:\smart-platform-alm\server\server.js'
)
$serverJs = $null
foreach ($c in $candidates) {
  if (Test-Path $c) { $serverJs = (Resolve-Path $c).Path; break }
}
if (-not $serverJs) { throw 'server.js not found' }

$root = Split-Path (Split-Path $serverJs -Parent) -Parent
if (-not (Test-Path (Join-Path $root 'accounting.html'))) {
  $root = 'D:\smart-platform-alm'
}

Write-Host "server: $serverJs"
Write-Host "root:   $root"

Copy-Item $serverJs ($serverJs + '.bak-priorityA') -Force
$t = [System.IO.File]::ReadAllText($serverJs)

if ($t -match 'PriorityA-IAM') {
  Write-Host 'Server already has PriorityA-IAM'
} else {

  # 1) inject audit helpers before function can(
  $auditFn = @'

/* PriorityA-IAM */
function auditPath() { return path.join(DATA, 'audit.json'); }
function appendAudit(ev) {
  try {
    const p = auditPath();
    const db = loadJson(p, { items: [] });
    db.items = db.items || [];
    db.items.unshift(Object.assign({ id: 'au_' + uid(), at: new Date().toISOString() }, ev || {}));
    if (db.items.length > 5000) db.items = db.items.slice(0, 5000);
    saveJson(p, db);
  } catch (e) { console.warn('[audit]', e.message); }
}

'@
  if ($t -notmatch 'function appendAudit') {
    if ($t -match 'function can\(session, perm\)') {
      $t = $t.Replace('function can(session, perm)', ($auditFn + 'function can(session, perm)'))
    } else {
      throw 'function can not found'
    }
  }

  # 2) login audit - several line-ending variants
  $loginOld1 = "const token = tokenNew(session);`r`n    return send(res, 200, { ok: true, token, user: session });"
  $loginNew1 = "const token = tokenNew(session);`r`n    appendAudit({ action: 'login', user: session.user, role: session.role });`r`n    return send(res, 200, { ok: true, token, user: session });"
  $loginOld2 = "const token = tokenNew(session);`n    return send(res, 200, { ok: true, token, user: session });"
  $loginNew2 = "const token = tokenNew(session);`n    appendAudit({ action: 'login', user: session.user, role: session.role });`n    return send(res, 200, { ok: true, token, user: session });"
  if ($t.Contains($loginOld1)) { $t = $t.Replace($loginOld1, $loginNew1) }
  elseif ($t.Contains($loginOld2)) { $t = $t.Replace($loginOld2, $loginNew2) }
  else { Write-Host 'WARN: login hook pattern not found' }

  # 3) users GET permission
  $usersOld1 = @"
if (pathname === '/api/users' && method === 'GET') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    const db = usersDb();
"@
  $usersNew1 = @"
if (pathname === '/api/users' && method === 'GET') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    if (!can(s, 'users') && !can(s, '*')) return send(res, 403, { ok: false, error: 'دسترسی کاربران نیست' });
    const db = usersDb();
"@
  if ($t.Contains($usersOld1)) { $t = $t.Replace($usersOld1, $usersNew1) }
  else { Write-Host 'WARN: users GET pattern not found (maybe already patched)' }

  # 4) module save audit
  $modOld = @"
saveJson(fp, next);
      return send(res, 200, {
        ok: true,
        moduleId: id,
        version: next.version,
        updatedAt: next.updatedAt
      });
"@
  $modNew = @"
saveJson(fp, next);
      appendAudit({ action: 'module_save', user: s.user, role: s.role, moduleId: id, version: next.version });
      return send(res, 200, {
        ok: true,
        moduleId: id,
        version: next.version,
        updatedAt: next.updatedAt
      });
"@
  if ($t.Contains($modOld)) { $t = $t.Replace($modOld, $modNew) }
  else { Write-Host 'WARN: module save pattern not found' }

  # 5) /api/audit endpoint - insert before last 404
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
    $needle = "return send(res, 404, { ok: false, error: 'api not found' });"
    if ($t.Contains($needle)) {
      $t = $t.Replace($needle, ($auditApi + "`r`n  " + $needle))
    } else {
      $idx = $t.LastIndexOf('return send(res, 404')
      if ($idx -gt 0) { $t = $t.Insert($idx, $auditApi + "`r`n  ") }
      else { Write-Host 'WARN: could not insert /api/audit' }
    }
  }

  [System.IO.File]::WriteAllText($serverJs, $t, [System.Text.UTF8Encoding]::new($false))
  Write-Host 'OK server.js patched'
}

# --- accounting separators (here-string is single-quoted: safe) ---
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
  if (-not (Test-Path $f)) { Write-Host "skip missing $f"; continue }
  $html = [System.IO.File]::ReadAllText($f)
  if ($html -match '__sfAccSep') { Write-Host "acc already $f"; continue }
  if ($html -match '</body>') {
    $html = $html.Replace('</body>', ($accSnip + "`r`n</body>"))
  } else {
    $html = $html + $accSnip
  }
  [System.IO.File]::WriteAllText($f, $html, [System.Text.UTF8Encoding]::new($false))
  Write-Host "OK accounting $f"
}

Write-Host ''
Write-Host '=== DONE Priority A ==='
Write-Host 'Restart: node server.js'
Write-Host 'Test audit after login in browser console.'
