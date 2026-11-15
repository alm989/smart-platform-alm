/**
 * Smart Suite Local Server v1.0
 * - Serves HTML modules from ./public
 * - JSON API for auth + module data + cartable
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
  defaultAdmin: { user: 'admin', pass: 'admin', name: 'مدیر', role: 'admin' }
});

const PUBLIC = path.resolve(ROOT, cfg.publicDir);
const DATA = path.resolve(ROOT, cfg.dataDir);
const BACKUP = path.resolve(ROOT, cfg.backupDir);
const MAX_BODY = (cfg.maxBodyMb || 8) * 1024 * 1024;

ensureDirs();
seedUsers();

const sessions = new Map(); // token -> { user, name, role, exp }

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

function saveUsers(db) {
  saveJson(path.join(DATA, 'users.json'), db);
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

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
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
  const clean = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(root, clean);
  if (!full.startsWith(root)) return null;
  return full;
}

function serveStatic(req, res, urlPath) {
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
    'Cache-Control': 'no-cache'
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

  // Health
  if (pathname === '/api/health' && method === 'GET') {
    return send(res, 200, {
      ok: true,
      version: '1.0.0',
      time: new Date().toISOString(),
      publicExists: fs.existsSync(PUBLIC),
      modules: fs.existsSync(path.join(DATA, 'modules'))
        ? fs.readdirSync(path.join(DATA, 'modules')).length
        : 0
    });
  }

  // Login
  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = await readBody(req);
    const db = usersDb();
    const u = String(body.user || '').trim();
    const p = String(body.pass || '');
    const pin = String(body.pin || '').trim();
    const found = (db.users || []).find((x) => x.user === u && x.pass === p);
    if (!found) return send(res, 401, { ok: false, error: 'کاربری یا رمز اشتباه' });
    if (String(db.pin2 || '') !== pin) return send(res, 401, { ok: false, error: 'پین دوم اشتباه' });
    const session = {
      user: found.user,
      name: found.name || found.user,
      role: found.role || 'user'
    };
    const token = tokenNew(session);
    return send(res, 200, { ok: true, token, user: session });
  }

  // Logout
  if (pathname === '/api/auth/logout' && method === 'POST') {
    const h = req.headers['authorization'] || '';
    const m = h.match(/^Bearer\s+(.+)$/i);
    if (m) sessions.delete(m[1].trim());
    return send(res, 200, { ok: true });
  }

  // Me
  if (pathname === '/api/me' && method === 'GET') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    return send(res, 200, { ok: true, user: { user: s.user, name: s.name, role: s.role } });
  }

  // Users list (auth)
  if (pathname === '/api/users' && method === 'GET') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    const db = usersDb();
    return send(res, 200, {
      ok: true,
      users: (db.users || []).map((u) => ({ user: u.user, name: u.name || u.user, role: u.role || 'user' }))
    });
  }

  // Module data
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
      return send(res, 200, { ok: true, moduleId: id, version: next.version, updatedAt: next.updatedAt });
    }
  }

  // Cartable
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

  // Backup snapshot of all module json
  if (pathname === '/api/backup' && method === 'POST') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    if (s.role !== 'admin' && s.role !== 'ceo') {
      return send(res, 403, { ok: false, error: 'فقط مدیر' });
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.join(BACKUP, stamp);
    fs.mkdirSync(dir, { recursive: true });
    const mods = path.join(DATA, 'modules');
    if (fs.existsSync(mods)) {
      fs.readdirSync(mods).forEach((f) => {
        fs.copyFileSync(path.join(mods, f), path.join(dir, f));
      });
    }
    fs.copyFileSync(path.join(DATA, 'users.json'), path.join(dir, 'users.json'));
    if (fs.existsSync(cartPath())) fs.copyFileSync(cartPath(), path.join(dir, 'cartable.json'));
    return send(res, 200, { ok: true, backup: stamp });
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
  console.log(' Smart Suite Local Server');
  console.log(' http://127.0.0.1:' + cfg.port + '/suite.html');
  console.log(' API health: http://127.0.0.1:' + cfg.port + '/api/health');
  console.log(' Public folder: ' + PUBLIC);
  console.log(' Data folder:   ' + DATA);
  console.log(' Login: admin / admin  pin: 1234');
  console.log('========================================');
  if (!fs.existsSync(path.join(PUBLIC, 'suite.html')) && !fs.existsSync(path.join(PUBLIC, 'cashbox.html'))) {
    console.log('WARNING: public/ is empty.');
    console.log('Copy your module HTML/JS files into: ' + PUBLIC);
  }
});
