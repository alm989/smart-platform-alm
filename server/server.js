/**
 * Smart Suite Local Server v1.1
 * - Static modules from ./public
 * - Auth + module JSON + cartable API
 * - Daily auto-backup + retention
 * - Login rate limit
 * - Zero npm deps (Node 18+)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const ROOT = __dirname;
const cfg = loadJson(path.join(ROOT, 'config.json'), {
  port: 8787,
  host: '0.0.0.0',
  publicDir: 'public',
  dataDir: 'data',
  backupDir: 'backups',
  sessionHours: 12,
  maxBodyMb: 8,
  backupRetainDays: 30,
  dailyBackupHour: 2,
  defaultAdmin: { user: 'admin', pass: 'admin', name: 'مدیر', role: 'admin' }
});

const PUBLIC = path.resolve(ROOT, cfg.publicDir);
const DATA = path.resolve(ROOT, cfg.dataDir);
const BACKUP = path.resolve(ROOT, cfg.backupDir);
const MAX_BODY = (cfg.maxBodyMb || 8) * 1024 * 1024;
const RETAIN_DAYS = cfg.backupRetainDays || 30;
const BACKUP_HOUR = Number.isInteger(cfg.dailyBackupHour) ? cfg.dailyBackupHour : 2;

ensureDirs();
seedUsers();

const sessions = new Map();
const loginAttempts = new Map(); // key -> { count, until }
let lastDailyBackupDay = '';

function ensureDirs() {
  [PUBLIC, DATA, BACKUP, path.join(DATA, 'modules'), path.join(DATA, 'files')].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

function loadJson(p, def) {
  try {
    if (!fs.existsSync(p)) return def;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return def;
  }
}

function saveJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
}

function seedUsers() {
  const p = path.join(DATA, 'users.json');
  if (!fs.existsSync(p)) {
    const a = cfg.defaultAdmin || {};
    saveJson(p, {
      pin2: '1234',
      users: [
        {
          user: a.user || 'admin',
          pass: a.pass || 'admin',
          name: a.name || 'مدیر',
          role: a.role || 'admin'
        }
      ]
    });
  }
}

function usersDb() {
  return loadJson(path.join(DATA, 'users.json'), { pin2: '1234', users: [] });
}

function modPath(id) {
  const safe = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(DATA, 'modules', safe + '.json');
}

function cartPath() {
  return path.join(DATA, 'cartable.json');
}

function uid() {
  return Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}

function tokenNew(session) {
  const t = crypto.randomBytes(24).toString('hex');
  const exp = Date.now() + (cfg.sessionHours || 12) * 3600 * 1000;
  sessions.set(t, Object.assign({}, session, { exp }));
  return t;
}

function tokenGet(req) {
  const h = req.headers['authorization'] || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  const t = m ? m[1].trim() : (req.headers['x-session-token'] || '').trim();
  if (!t) return null;
  const s = sessions.get(t);
  if (!s) return null;
  if (s.exp < Date.now()) {
    sessions.delete(t);
    return null;
  }
  return s;
}

function rateLimitLogin(key) {
  const now = Date.now();
  let item = loginAttempts.get(key);
  if (!item || now > item.until) {
    item = { count: 0, until: now + 60000 };
  }
  item.count += 1;
  loginAttempts.set(key, item);
  return item.count <= 10;
}

function runBackup(label) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(BACKUP, stamp + (label ? '_' + label : ''));
  fs.mkdirSync(dir, { recursive: true });
  const mods = path.join(DATA, 'modules');
  if (fs.existsSync(mods)) {
    fs.readdirSync(mods).forEach((f) => {
      fs.copyFileSync(path.join(mods, f), path.join(dir, f));
    });
  }
  const users = path.join(DATA, 'users.json');
  if (fs.existsSync(users)) fs.copyFileSync(users, path.join(dir, 'users.json'));
  if (fs.existsSync(cartPath())) fs.copyFileSync(cartPath(), path.join(dir, 'cartable.json'));
  saveJson(path.join(dir, '_meta.json'), {
    at: new Date().toISOString(),
    label: label || 'manual',
    modules: fs.existsSync(mods) ? fs.readdirSync(mods).length : 0
  });
  pruneBackups();
  console.log('[backup]', dir);
  return stamp;
}

function pruneBackups() {
  try {
    const cutoff = Date.now() - RETAIN_DAYS * 86400000;
    fs.readdirSync(BACKUP, { withFileTypes: true }).forEach((ent) => {
      if (!ent.isDirectory()) return;
      const full = path.join(BACKUP, ent.name);
      const st = fs.statSync(full);
      if (st.mtimeMs < cutoff) {
        fs.rmSync(full, { recursive: true, force: true });
        console.log('[backup] pruned', ent.name);
      }
    });
  } catch (e) {
    console.warn('[backup] prune error', e.message);
  }
}

function tickDailyBackup() {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  if (now.getHours() === BACKUP_HOUR && lastDailyBackupDay !== day) {
    lastDailyBackupDay = day;
    try {
      runBackup('daily');
    } catch (e) {
      console.warn('[backup] daily failed', e.message);
    }
  }
}

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

function mime(file) {
  const ext = path.extname(file).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8'
  };
  return map[ext] || 'application/octet-stream';
}

function safeJoin(root, reqPath) {
  const decoded = decodeURIComponent(reqPath.split('?')[0]);
  const clean = path.normalize(decoded).replace(/^(\.[\/\\])+/, '');
  const full = path.join(root, clean);
  if (!full.startsWith(root)) return null;
  return full;
}

function serveStatic(req, res, urlPath) {
  if (urlPath === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }
  let p = urlPath === '/' ? '/suite.html' : urlPath;
  let file = safeJoin(PUBLIC, p);
  if (!file) return send(res, 400, { ok: false, error: 'bad path' });
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    file = path.join(file, 'index.html');
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found: ' + p);
    return;
  }
  const data = fs.readFileSync(file);
  res.writeHead(200, {
    'Content-Type': mime(file),
    'Content-Length': data.length,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(data);
}

async function handleApi(req, res, url) {
  const pathname = url.pathname;
  const method = req.method || 'GET';

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    });
    res.end();
    return;
  }

  if (pathname === '/api/health' && method === 'GET') {
    let backups = 0;
    try {
      backups = fs.readdirSync(BACKUP, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
    } catch (e) {}
    return send(res, 200, {
      ok: true,
      version: '1.1.0',
      time: new Date().toISOString(),
      publicExists: fs.existsSync(PUBLIC),
      modules: fs.existsSync(path.join(DATA, 'modules'))
        ? fs.readdirSync(path.join(DATA, 'modules')).length
        : 0,
      backups,
      dailyBackupHour: BACKUP_HOUR
    });
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const ip = (req.socket && req.socket.remoteAddress) || 'unknown';
    const body = await readBody(req);
    const u = String(body.user || '').trim();
    const rlKey = ip + ':' + u.toLowerCase();
    if (!rateLimitLogin(rlKey)) {
      return send(res, 429, { ok: false, error: 'تعداد تلاش زیاد — یک دقیقه صبر کنید' });
    }
    const db = usersDb();
    const p = String(body.pass || '');
    const pin = String(body.pin || '').trim();
    const found = (db.users || []).find((x) => x.user === u && x.pass === p);
    if (!found) return send(res, 401, { ok: false, error: 'کاربری یا رمز اشتباه' });
    if (String(db.pin2 || '') !== pin) return send(res, 401, { ok: false, error: 'پین دوم اشتباه' });
    loginAttempts.delete(rlKey);
    const session = {
      user: found.user,
      name: found.name || found.user,
      role: found.role || 'user'
    };
    const token = tokenNew(session);
    return send(res, 200, { ok: true, token, user: session });
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    const h = req.headers['authorization'] || '';
    const m = h.match(/^Bearer\s+(.+)$/i);
    if (m) sessions.delete(m[1].trim());
    return send(res, 200, { ok: true });
  }

  if (pathname === '/api/me' && method === 'GET') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    return send(res, 200, { ok: true, user: { user: s.user, name: s.name, role: s.role } });
  }

  if (pathname === '/api/users' && method === 'GET') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    const db = usersDb();
    return send(res, 200, {
      ok: true,
      users: (db.users || []).map((u) => ({
        user: u.user,
        name: u.name || u.user,
        role: u.role || 'user'
      }))
    });
  }

  const modMatch = pathname.match(/^\/api\/data\/([a-zA-Z0-9_-]+)$/);
  if (modMatch) {
    const id = modMatch[1];
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    const fp = modPath(id);
    if (method === 'GET') {
      const data = loadJson(fp, { version: 1, updatedAt: null, payload: {} });
      return send(res, 200, { ok: true, moduleId: id, data });
    }
    if (method === 'PUT' || method === 'POST') {
      const body = await readBody(req);
      const prev = loadJson(fp, { version: 0, payload: {} });
      const next = {
        version: (prev.version || 0) + 1,
        updatedAt: new Date().toISOString(),
        updatedBy: s.user,
        payload: body.payload != null ? body.payload : body
      };
      saveJson(fp, next);
      return send(res, 200, {
        ok: true,
        moduleId: id,
        version: next.version,
        updatedAt: next.updatedAt
      });
    }
  }

  if (pathname === '/api/cartable' && method === 'GET') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    const all = loadJson(cartPath(), { items: [] });
    return send(res, 200, { ok: true, items: all.items || [] });
  }
  if (pathname === '/api/cartable' && method === 'POST') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    const body = await readBody(req);
    const all = loadJson(cartPath(), { items: [] });
    const item = {
      id: 'sf_' + uid(),
      from: body.from || '',
      fromTitle: body.fromTitle || '',
      fromUser: s.user,
      fromUserName: s.name,
      to: body.to || '',
      toTitle: body.toTitle || '',
      toUser: body.toUser || '*',
      subject: body.subject || '',
      body: body.body || '',
      date: body.date || '',
      status: 'active',
      hasFile: !!body.dataUrl,
      fileName: body.fileName || '',
      dataUrl: body.dataUrl || '',
      createdAt: new Date().toISOString(),
      deleted: false
    };
    all.items = all.items || [];
    all.items.unshift(item);
    if (all.items.length > 2000) all.items = all.items.slice(0, 2000);
    saveJson(cartPath(), all);
    return send(res, 200, { ok: true, item });
  }

  if (pathname === '/api/backup' && method === 'POST') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    if (s.role !== 'admin' && s.role !== 'ceo') {
      return send(res, 403, { ok: false, error: 'فقط مدیر' });
    }
    const stamp = runBackup('manual');
    return send(res, 200, { ok: true, backup: stamp });
  }

  if (pathname === '/api/backup' && method === 'GET') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    let list = [];
    try {
      list = fs
        .readdirSync(BACKUP, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => {
          const meta = loadJson(path.join(BACKUP, e.name, '_meta.json'), null);
          return { id: e.name, meta };
        })
        .sort((a, b) => (a.id < b.id ? 1 : -1))
        .slice(0, 50);
    } catch (e) {}
    return send(res, 200, { ok: true, backups: list });
  }

  return send(res, 404, { ok: false, error: 'api not found' });
}

const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host || 'localhost';
    const url = new URL(req.url || '/', 'http://' + host);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }
    serveStatic(req, res, url.pathname);
  } catch (e) {
    send(res, 500, { ok: false, error: String(e.message || e) });
  }
});

server.listen(cfg.port, cfg.host, () => {
  console.log('========================================');
  console.log(' Smart Suite Local Server v1.1');
  console.log(' http://127.0.0.1:' + cfg.port + '/suite.html');
  console.log(' API health: http://127.0.0.1:' + cfg.port + '/api/health');
  console.log(' Daily backup hour: ' + BACKUP_HOUR + ':00 (local)');
  console.log(' Retain backups: ' + RETAIN_DAYS + ' days');
  console.log(' Public: ' + PUBLIC);
  console.log(' Data:   ' + DATA);
  console.log(' Login: admin / admin  pin: 1234');
  console.log('========================================');
  if (!fs.existsSync(path.join(PUBLIC, 'suite.html'))) {
    console.log('WARNING: public/ may be incomplete — run COPY-MODULES.bat');
  }
  try {
    runBackup('startup');
  } catch (e) {
    console.warn('[backup] startup skipped', e.message);
  }
  setInterval(tickDailyBackup, 5 * 60 * 1000);
});
