# Phase 1-B: audit + user/pin management APIs for server.js
# Run:  cd D:\smart-platform-alm\server
#        powershell -ExecutionPolicy Bypass -File .\scripts\apply-phase1b-auth-api.ps1
$ErrorActionPreference = 'Stop'
$server = Join-Path $PSScriptRoot '..\server.js' | Resolve-Path
$p = $server.Path
$t = [IO.File]::ReadAllText($p)
if ($t -match 'Phase1-B auth-admin') { Write-Host 'Already patched'; exit 0 }
Copy-Item $p ($p + '.bak-p1b') -Force

# --- inject helpers after saveUsers function if possible ---
$helpers = @'

/* ===== Phase1-B auth-admin helpers ===== */
function auditPath() { return path.join(DATA, 'audit.json'); }
function appendAudit(entry) {
  try {
    const all = loadJson(auditPath(), { items: [] });
    all.items = all.items || [];
    all.items.unshift(Object.assign({ id: uid(), at: new Date().toISOString() }, entry || {}));
    if (all.items.length > 2000) all.items = all.items.slice(0, 2000);
    saveJson(auditPath(), all);
  } catch (e) {
    console.warn('[audit]', e.message);
  }
}
function isAdminSession(s) {
  return s && (s.role === 'admin' || s.role === 'ceo' || (s.perms && s.perms.indexOf('*') >= 0));
}
/* ===== end Phase1-B helpers ===== */

'@

if ($t -notmatch 'function appendAudit') {
  if ($t -match 'function saveUsers\(db\)\s*\{[^}]+\}') {
    $t = [regex]::Replace($t, '(function saveUsers\(db\)\s*\{[^}]+\})', '${1}' + $helpers, 1)
  } else {
    $t = $t.Replace('function can(session, perm)', $helpers + 'function can(session, perm)')
  }
}

# audit on successful login (before return send login success)
$t = $t.Replace(
  "const token = tokenNew(session);
    return send(res, 200, { ok: true, token, user: session });",
  "const token = tokenNew(session);
    appendAudit({ action: 'login', user: session.user, role: session.role, ip: ip });
    return send(res, 200, { ok: true, token, user: session });"
)

# audit logout
$t = $t.Replace(
  "if (pathname === '/api/auth/logout' && method === 'POST') {
    const h = req.headers['authorization'] || '';
    const m = h.match(/^Bearer\s+(.+)$/i);
    if (m) sessions.delete(m[1].trim());
    return send(res, 200, { ok: true });
  }",
  "if (pathname === '/api/auth/logout' && method === 'POST') {
    const h = req.headers['authorization'] || '';
    const m = h.match(/^Bearer\s+(.+)$/i);
    let who = null;
    if (m) {
      const tok = m[1].trim();
      const sess = sessions.get(tok);
      if (sess) who = sess.user;
      sessions.delete(tok);
    }
    appendAudit({ action: 'logout', user: who || 'unknown' });
    return send(res, 200, { ok: true });
  }"
)

# insert new endpoints before final 404
$apiBlock = @'

  /* ===== Phase1-B auth-admin APIs ===== */
  if (pathname === '/api/audit' && method === 'GET') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    if (!isAdminSession(s)) return send(res, 403, { ok: false, error: 'فقط مدیر' });
    const all = loadJson(auditPath(), { items: [] });
    const limit = Math.min(200, parseInt((url.searchParams && url.searchParams.get('limit')) || '50', 10) || 50);
    return send(res, 200, { ok: true, items: (all.items || []).slice(0, limit) });
  }

  if (pathname === '/api/auth/pin' && method === 'POST') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    if (!isAdminSession(s)) return send(res, 403, { ok: false, error: 'فقط مدیر' });
    const body = await readBody(req);
    const newPin = String(body.pin || body.newPin || '').trim();
    if (!/^\d{4,8}$/.test(newPin)) {
      return send(res, 400, { ok: false, error: 'پین باید ۴ تا ۸ رقم باشد' });
    }
    const db = usersDb();
    db.pin2 = newPin;
    saveUsers(db);
    appendAudit({ action: 'pin_change', user: s.user });
    return send(res, 200, { ok: true });
  }

  const userPatch = pathname.match(/^\/api\/users\/([a-zA-Z0-9_\-\.]+)$/);
  if (userPatch && method === 'PATCH') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    const target = userPatch[1];
    const body = await readBody(req);
    const self = s.user === target;
    if (!self && !isAdminSession(s)) {
      return send(res, 403, { ok: false, error: 'مجوز نیست' });
    }
    const db = usersDb();
    const idx = (db.users || []).findIndex((x) => x.user === target);
    if (idx < 0) return send(res, 404, { ok: false, error: 'کاربر یافت نشد' });
    const u = Object.assign({}, db.users[idx]);
    if (body.name != null) u.name = String(body.name).slice(0, 80);
    if (body.pass != null && String(body.pass).length > 0) {
      if (String(body.pass).length < 6) {
        return send(res, 400, { ok: false, error: 'رمز حداقل ۶ کاراکتر' });
      }
      u.pass = hashPass(String(body.pass));
      appendAudit({ action: 'password_change', user: s.user, target: target });
    }
    if (body.role != null && isAdminSession(s) && !self) {
      const allowed = ['admin', 'ceo', 'manager', 'user', 'guest'];
      if (allowed.indexOf(String(body.role)) >= 0) u.role = String(body.role);
    }
    db.users[idx] = u;
    saveUsers(db);
    appendAudit({ action: 'user_patch', user: s.user, target: target });
    return send(res, 200, {
      ok: true,
      user: { user: u.user, name: u.name || u.user, role: u.role || 'user' }
    });
  }

  if (pathname === '/api/users' && method === 'POST') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    if (!isAdminSession(s)) return send(res, 403, { ok: false, error: 'فقط مدیر' });
    const body = await readBody(req);
    const user = String(body.user || '').trim();
    const pass = String(body.pass || '');
    const name = String(body.name || user).slice(0, 80);
    const role = String(body.role || 'user');
    if (!user || pass.length < 6) {
      return send(res, 400, { ok: false, error: 'user و رمز (حداقل ۶) لازم است' });
    }
    const db = usersDb();
    if ((db.users || []).some((x) => x.user === user)) {
      return send(res, 409, { ok: false, error: 'کاربر تکراری' });
    }
    db.users = db.users || [];
    db.users.push({ user: user, pass: hashPass(pass), name: name, role: role });
    saveUsers(db);
    appendAudit({ action: 'user_create', user: s.user, target: user, role: role });
    return send(res, 200, { ok: true, user: { user: user, name: name, role: role } });
  }
  /* ===== end Phase1-B auth-admin APIs ===== */

'@

if ($t -notmatch "pathname === '/api/audit'") {
  $t = $t.Replace("return send(res, 404, { ok: false, error: 'api not found' });", $apiBlock + "`r`n  return send(res, 404, { ok: false, error: 'api not found' });")
}

# hide credentials on boot
$t = $t.Replace("console.log(' Login: admin / admin  pin: 1234');", "console.log(' Auth: use configured users (credentials not printed)');")
$t = $t.Replace('console.log(" Login: admin / admin  pin: 1234");', 'console.log(" Auth: use configured users (credentials not printed)");')

[IO.File]::WriteAllText($p, $t, [Text.UTF8Encoding]::new($false))
Write-Host "OK Phase1-B applied to $p"
Write-Host "Backup: $p.bak-p1b"
Write-Host "Restart: node server.js"
