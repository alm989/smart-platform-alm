# Phase 2-C: enhance backup + add restore API
# Run from: D:\smart-platform-alm\server
#   powershell -ExecutionPolicy Bypass -File .\scripts\apply-phase2c-backup.ps1
$ErrorActionPreference = 'Stop'
$p = Join-Path $PSScriptRoot '..\server.js'
if (!(Test-Path $p)) { $p = Join-Path (Get-Location) 'server.js' }
$p = (Resolve-Path $p).Path
$t = [IO.File]::ReadAllText($p)
if ($t -match 'Phase2-C backup-restore') { Write-Host 'Already patched'; exit 0 }
Copy-Item $p ($p + '.bak-p2c') -Force

# Enhance runBackup metadata if simple form exists
if ($t -match "label: label \|\| 'manual',\s*\n\s*modules:") {
  $t = $t.Replace(
@"
  saveJson(path.join(dir, '_meta.json'), {
    at: new Date().toISOString(),
    label: label || 'manual',
    modules: fs.existsSync(mods) ? fs.readdirSync(mods).length : 0
  });
"@,
@"
  const modFiles = fs.existsSync(mods) ? fs.readdirSync(mods).filter((f) => /\.json$/i.test(f)) : [];
  const hasUsers = fs.existsSync(users);
  const hasCart = fs.existsSync(cartPath());
  const hasAudit = fs.existsSync(path.join(DATA, 'audit.json'));
  if (hasAudit) {
    try { fs.copyFileSync(path.join(DATA, 'audit.json'), path.join(dir, 'audit.json')); } catch (e) {}
  }
  saveJson(path.join(dir, '_meta.json'), {
    at: new Date().toISOString(),
    label: label || 'manual',
    modules: modFiles.length,
    files: modFiles,
    users: hasUsers,
    cartable: hasCart,
    audit: hasAudit,
    phase: '2C'
  });
"@
  )
}

# Inject restore function before pruneBackups if missing
if ($t -notmatch 'function restoreBackup') {
  $restoreFn = @'

/* Phase2-C backup-restore */
function restoreBackup(stamp) {
  const safe = String(stamp || '').replace(/[^a-zA-Z0-9_\-T]/g, '');
  if (!safe) throw new Error('شناسه پشتیبان نامعتبر');
  const dir = path.join(BACKUP, safe);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error('پشتیبان یافت نشد');
  }
  const mods = path.join(DATA, 'modules');
  if (!fs.existsSync(mods)) fs.mkdirSync(mods, { recursive: true });
  let restored = 0;
  fs.readdirSync(dir).forEach((f) => {
    if (f === '_meta.json') return;
    const src = path.join(dir, f);
    if (!fs.statSync(src).isFile()) return;
    if (f === 'users.json') {
      fs.copyFileSync(src, path.join(DATA, 'users.json'));
      restored++;
      return;
    }
    if (f === 'cartable.json') {
      fs.copyFileSync(src, cartPath());
      restored++;
      return;
    }
    if (f === 'audit.json') {
      fs.copyFileSync(src, path.join(DATA, 'audit.json'));
      restored++;
      return;
    }
    if (/\.json$/i.test(f)) {
      fs.copyFileSync(src, path.join(mods, f));
      restored++;
    }
  });
  return { id: safe, restored: restored, meta: loadJson(path.join(dir, '_meta.json'), null) };
}

'@
  if ($t -match 'function pruneBackups') {
    $t = $t.Replace('function pruneBackups', $restoreFn + 'function pruneBackups')
  } else {
    $t = $t.Replace('function tickDailyBackup', $restoreFn + 'function tickDailyBackup')
  }
}

# Inject restore API before 404
$apiRestore = @'

  /* Phase2-C backup-restore APIs */
  if (pathname === '/api/backup/restore' && method === 'POST') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    if (!(s.role === 'admin' || s.role === 'ceo' || can(s, '*'))) {
      return send(res, 403, { ok: false, error: 'فقط admin/ceo' });
    }
    const body = await readBody(req);
    const id = String(body.id || body.backup || '').trim();
    try {
      // safety: take a pre-restore snapshot
      runBackup('pre-restore');
      const result = restoreBackup(id);
      return send(res, 200, { ok: true, restore: result });
    } catch (e) {
      return send(res, 400, { ok: false, error: String(e.message || e) });
    }
  }

'@

if ($t -notmatch "pathname === '/api/backup/restore'") {
  $t = $t.Replace("return send(res, 404, { ok: false, error: 'api not found' });", $apiRestore + "`r`n  return send(res, 404, { ok: false, error: 'api not found' });")
}

# Enrich GET /api/backup response slightly if simple
$t = $t.Replace(
  '.map((e) => {
          const meta = loadJson(path.join(BACKUP, e.name, ''_meta.json''), null);
          return { id: e.name, meta };
        })',
  '.map((e) => {
          const meta = loadJson(path.join(BACKUP, e.name, ''_meta.json''), null);
          let bytes = 0;
          try {
            fs.readdirSync(path.join(BACKUP, e.name)).forEach((f) => {
              try { bytes += fs.statSync(path.join(BACKUP, e.name, f)).size; } catch (x) {}
            });
          } catch (x2) {}
          return { id: e.name, meta: meta, bytes: bytes };
        })'
)

[IO.File]::WriteAllText($p, $t, [Text.UTF8Encoding]::new($false))
Write-Host "OK Phase2-C server.js patched: $p"
Write-Host "Backup file: $p.bak-p2c"
Write-Host "Restart server: node server.js"
