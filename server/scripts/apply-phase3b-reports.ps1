# Phase 3-B: GET /api/reports/summary
$ErrorActionPreference = 'Stop'
$p = Join-Path $PSScriptRoot '..\server.js'
if (!(Test-Path $p)) { $p = Join-Path (Get-Location) 'server.js' }
$p = (Resolve-Path $p).Path
$t = [IO.File]::ReadAllText($p)
if ($t -match "/api/reports/summary") { Write-Host 'Already has reports API'; exit 0 }
Copy-Item $p ($p + '.bak-p3b') -Force

$block = @'

  /* Phase3-B management summary report */
  if (pathname === '/api/reports/summary' && method === 'GET') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    if (!(s.role === 'admin' || s.role === 'ceo' || s.role === 'manager' || can(s, '*'))) {
      return send(res, 403, { ok: false, error: 'دسترسی گزارش نیست' });
    }
    const modsDir = path.join(DATA, 'modules');
    const modules = [];
    let totalBytes = 0;
    if (fs.existsSync(modsDir)) {
      fs.readdirSync(modsDir).filter((f) => /\.json$/i.test(f)).forEach((f) => {
        const fp = path.join(modsDir, f);
        try {
          const st = fs.statSync(fp);
          const j = loadJson(fp, {});
          const payload = j.payload || j;
          let recordHint = 0;
          if (payload && typeof payload === 'object') {
            if (payload.stores && typeof payload.stores === 'object') {
              Object.keys(payload.stores).forEach((k) => {
                if (Array.isArray(payload.stores[k])) recordHint += payload.stores[k].length;
              });
            } else {
              Object.keys(payload).forEach((k) => {
                if (Array.isArray(payload[k])) recordHint += payload[k].length;
              });
            }
          }
          totalBytes += st.size;
          modules.push({
            id: f.replace(/\.json$/i, ''),
            version: j.version != null ? j.version : null,
            updatedAt: j.updatedAt || null,
            updatedBy: j.updatedBy || null,
            bytes: st.size,
            recordsApprox: recordHint
          });
        } catch (e) {}
      });
    }
    modules.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    const cart = loadJson(cartPath(), { items: [] });
    const users = usersDb();
    let backups = 0;
    try {
      backups = fs.readdirSync(BACKUP, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
    } catch (e2) {}
    return send(res, 200, {
      ok: true,
      at: new Date().toISOString(),
      by: s.user,
      role: s.role,
      totals: {
        modules: modules.length,
        moduleBytes: totalBytes,
        cartableItems: (cart.items || []).length,
        users: (users.users || []).length,
        backups: backups
      },
      modules: modules
    });
  }

'@

# insert before 404
if ($t -match "api not found") {
  $t = $t.Replace("return send(res, 404, { ok: false, error: 'api not found' });", $block + "`r`n  return send(res, 404, { ok: false, error: 'api not found' });")
} elseif ($t -match "pathname === '/api/backup'") {
  # after backup block end - soft: append before last send 404 pattern
  $idx = $t.LastIndexOf('return send(res, 404')
  if ($idx -gt 0) {
    $t = $t.Insert($idx, $block + "`r`n  ")
  } else {
    throw 'Could not find insertion point'
  }
} else {
  throw 'Could not find insertion point for reports API'
}

[IO.File]::WriteAllText($p, $t, [Text.UTF8Encoding]::new($false))
Write-Host "OK Phase3-B: $p"
Write-Host 'Restart: node server.js'
