/**
 * Smart Suite Local Server v1.5.1 (headers+JWT)
 * - scrypt + RBAC
 * - VERSIONS.json registry + /api/versions
 * - Cartable + backup
 * - Zero npm deps (Node 18+)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwtLib = require('./lib/jwt');
const { modulesForRole, canAccessModule } = require('./lib/rbac-modules');
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
const JWT_SECRET = cfg.jwtSecret || 'change-me-in-config';
const revokedJti = new Set();

const ROLE_PERMS = {
  admin: ['*'],
  ceo: ['*'],
  manager: ['read', 'write', 'cartable', 'backup', 'users'],
  user: ['read', 'write', 'cartable'],
  guest: ['read']
};

const MODULE_FILE = {
  filehub: 'file-hub.html',
  pr: 'pr-media.html'
};

ensureDirs();
seedUsers();
migrateAllPasswords();

const sessions = new Map();
const loginAttempts = new Map();
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

function loadVersions() {
  const candidates = [
    path.join(ROOT, 'VERSIONS.json'),
    path.join(ROOT, '..', 'VERSIONS.json'),
    path.join(PUBLIC, 'VERSIONS.json')
  ];
  for (let i = 0; i < candidates.length; i++) {
    const v = loadJson(candidates[i], null);
    if (v && typeof v === 'object') {
      v._source = candidates[i];
      return v;
    }
  }
  return {
    schema: 1,
    components: { server: '1.2.1', 'server-bridge': '1.5', core: '3.1' },
    modules: {},
    _source: null
  };
}

function moduleHtmlName(id) {
  if (MODULE_FILE[id]) return MODULE_FILE[id];
  return id + '.html';
}

function buildVersionReport() {
  const reg = loadVersions();
  const modules = reg.modules || {};
  const present = [];
  const missing = [];
  Object.keys(modules).forEach((id) => {
    const file = moduleHtmlName(id);
    const fp = path.join(PUBLIC, file);
    const row = { id: id, file: file, registry: modules[id] };
    if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
      row.bytes = fs.statSync(fp).size;
      row.mtime = fs.statSync(fp).mtime.toISOString();
      present.push(row);
    } else {
      missing.push(row);
    }
  });
  let htmlCount = 0;
  try {
    htmlCount = fs.readdirSync(PUBLIC).filter((f) => /\.html$/i.test(f)).length;
  } catch (e) {}
  return {
    ok: true,
    registry: {
      updatedAt: reg.updatedAt || null,
      components: reg.components || {},
      moduleCount: Object.keys(modules).length,
      source: reg._source
    },
    publicHtmlCount: htmlCount,
    present: present,
    missing: missing,
    serverRuntime: '1.5.0'
  };
}

function hashPass(pass) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pass), salt, 32).toString('hex');
  return 'scrypt$' + salt + '$' + hash;
}

function verifyPass(pass, stored) {
  if (stored == null || stored === '') return false;
  const s = String(stored);
  if (s.startsWith('scrypt$')) {
    const parts = s.split('$');
    if (parts.length < 3) return false;
    const salt = parts[1];
    const hash = parts[2];
    const h = crypto.scryptSync(String(pass), salt, 32).toString('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(hash, 'hex'));
    } catch (e) {
      return false;
    }
  }
  return s === String(pass);
}

function isHashed(stored) {
  return String(stored || '').startsWith('scrypt$');
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
          pass: hashPass(a.pass || 'admin'),
          name: a.name || 'مدیر',
          role: a.role || 'admin'
        }
      ]
    });
  }
}

function migrateAllPasswords() {
  const p = path.join(DATA, 'users.json');
  const db = loadJson(p, null);
  if (!db || !Array.isArray(db.users)) return;
  let changed = false;
  db.users = db.users.map((u) => {
    if (u && u.pass && !isHashed(u.pass)) {
      changed = true;
      return Object.assign({}, u, { pass: hashPass(u.pass) });
    }
    return u;
  });
  if (changed) {
    saveJson(p, db);
    console.log('[auth] migrated plain passwords to scrypt');
  }
}

function usersDb() {
  return loadJson(path.join(DATA, 'users.json'), { pin2: '1234', users: [] });
}

function saveUsers(db) {
  saveJson(path.join(DATA, 'users.json'), db);
}
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


function can(session, perm) {
  if (!session) return false;
  const role = session.role || 'user';
  const list = ROLE_PERMS[role] || ROLE_PERMS.user;
  return list.indexOf('*') >= 0 || list.indexOf(perm) >= 0;
}

function modPath(id) {
  const safe = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(DATA, 'modules', safe + '.json');
}

function cartPath() {
  return path.join(DATA, 'cartable.json');
}


function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
    'Permissions-Policy': 'microphone=(self), geolocation=()'
  };
}

function uid() {
  return Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}

function tokenNew(session) {
  const role = session.role || 'user';
  const perms = ROLE_PERMS[role] || ROLE_PERMS.user;
  return jwtLib.sign(
    {
      sub: session.user,
      name: session.name || session.user,
      role: role,
      perms: perms,
      modules: modulesForRole(role)
    },
    JWT_SECRET,
    { hours: cfg.sessionHours || 12 }
  );
}

function tokenGet(req) {
  const h = req.headers['authorization'] || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  const t = m ? m[1].trim() : (req.headers['x-session-token'] || '').trim();
  if (!t) return null;
  // legacy RAM session (pre-JWT)
  if (sessions.has(t)) {
    const s0 = sessions.get(t);
    if (s0.exp < Date.now()) {
      sessions.delete(t);
      return null;
    }
    return s0;
  }
  const payload = jwtLib.verify(t, JWT_SECRET);
  if (!payload) return null;
  if (payload.jti && revokedJti.has(payload.jti)) return null;
  return {
    user: payload.sub,
    name: payload.name || payload.sub,
    role: payload.role || 'user',
    perms: payload.perms || ROLE_PERMS[payload.role] || ROLE_PERMS.user,
    modules: payload.modules || modulesForRole(payload.role || 'user'),
    jti: payload.jti,
    exp: payload.exp ? payload.exp * 1000 : Date.now() + 3600000
  };
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
  pruneBackups();
  console.log('[backup]', dir);
  return stamp;
}


/* Phase2-C backup-restore */
function restoreBackup(stamp) {
  const safe = String(stamp || '').replace(/[^a-zA-Z0-9_\-T]/g, '');
  if (!safe) throw new Error('Ø´Ù†Ø§Ø³Ù‡ Ù¾Ø´ØªÛŒØ¨Ø§Ù† Ù†Ø§Ù…Ø¹ØªØ¨Ø±');
  const dir = path.join(BACKUP, safe);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error('Ù¾Ø´ØªÛŒØ¨Ø§Ù† ÛŒØ§ÙØª Ù†Ø´Ø¯');
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
  res.writeHead(code, Object.assign({}, securityHeaders(), {

    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    }));

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
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    });
    res.end();
    return;
  }

  if (pathname === '/api/health' && method === 'GET') {
    let backups = 0;
    try {
      backups = fs.readdirSync(BACKUP, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
    } catch (e) {}
    const reg = loadVersions();
    return send(res, 200, {
      ok: true,
      version: '1.5.1',
      auth: 'scrypt+jwt',
      rbac: Object.keys(ROLE_PERMS),
      components: (reg && reg.components) || {},
      moduleRegistryCount: reg && reg.modules ? Object.keys(reg.modules).length : 0,
      time: new Date().toISOString(),
      publicExists: fs.existsSync(PUBLIC),
      modules: fs.existsSync(path.join(DATA, 'modules'))
        ? fs.readdirSync(path.join(DATA, 'modules')).length
        : 0,
      backups,
      dailyBackupHour: BACKUP_HOUR
    });
  }

  if (pathname === '/api/versions' && method === 'GET') {
    return send(res, 200, buildVersionReport());
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
    const found = (db.users || []).find((x) => x.user === u);
    if (!found || !verifyPass(p, found.pass)) {
      return send(res, 401, { ok: false, error: 'کاربری یا رمز اشتباه' });
    }
    if (String(db.pin2 || '') !== pin) {
      return send(res, 401, { ok: false, error: 'پین دوم اشتباه' });
    }
    if (!isHashed(found.pass)) {
      found.pass = hashPass(p);
      saveUsers(db);
    }
    loginAttempts.delete(rlKey);
    const session = {
      user: found.user,
      name: found.name || found.user,
      role: found.role || 'user',
      perms: ROLE_PERMS[found.role || 'user'] || ROLE_PERMS.user
    };
    const token = tokenNew(session);
    try { appendAudit({ action: 'login', user: session.user, role: session.role }); } catch (eA) {}
    return send(res, 200, { ok: true, token, tokenType: 'Bearer', auth: 'jwt', user: session });
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    const h = req.headers['authorization'] || '';
    const m = h.match(/^Bearer\s+(.+)$/i);
    const t = m ? m[1].trim() : '';
    if (t) {
      if (sessions.has(t)) sessions.delete(t);
      const payload = jwtLib.verify(t, JWT_SECRET);
      if (payload && payload.jti) revokedJti.add(payload.jti);
    }
    return send(res, 200, { ok: true });
  }

  if (pathname === '/api/me' && method === 'GET') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    return send(res, 200, {
      ok: true,
      user: {
        user: s.user,
        name: s.name,
        role: s.role,
        perms: ROLE_PERMS[s.role] || ROLE_PERMS.user,
        modules: s.modules || modulesForRole(s.role)
      
      }
    });
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

    if (!canAccessModule(s.role, id)) {
      return send(res, 403, { ok: false, error: 'دسترسی به این ماژول مجاز نیست', moduleId: id, role: s.role });
    }

    const fp = modPath(id);
    if (method === 'GET') {
      if (!can(s, 'read')) return send(res, 403, { ok: false, error: 'دسترسی خواندن نیست' });
      const data = loadJson(fp, { version: 1, updatedAt: null, payload: {} });
      return send(res, 200, { ok: true, moduleId: id, data });
    }
    if (method === 'PUT' || method === 'POST') {
      if (!can(s, 'write')) return send(res, 403, { ok: false, error: 'دسترسی نوشتن نیست' });
      const body = await readBody(req);
      const prev = loadJson(fp, { version: 0, payload: {} });
      const next = {
        version: (prev.version || 0) + 1,
        updatedAt: new Date().toISOString(),
        updatedBy: s.user,
        payload: body.payload != null ? body.payload : body
      };
      saveJson(fp, next);
      appendAudit({ action: 'module_save', user: s.user, role: s.role, moduleId: id, version: next.version });
      return send(res, 200, {
        ok: true,
        moduleId: id,
        version: next.version,
        updatedAt: next.updatedAt
      });
    }
  }

  if (pathname === '/api/cartable') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    if (!can(s, 'cartable') && !can(s, '*')) {
      return send(res, 403, { ok: false, error: 'دسترسی کارتابل نیست' });
    }
    if (method === 'GET') {
      const all = loadJson(cartPath(), { items: [] });
      return send(res, 200, { ok: true, items: all.items || [] });
    }
    if (method === 'POST') {
      const body = await readBody(req);
      const all = loadJson(cartPath(), { items: [] });
      const item = {
        id: body.id || 'sf_' + uid(),
        from: body.from || '',
        fromTitle: body.fromTitle || '',
        fromUser: body.fromUser || s.user,
        fromUserName: body.fromUserName || s.name,
        to: body.to || '',
        toTitle: body.toTitle || '',
        toUser: body.toUser || '*',
        toUserName: body.toUserName || '',
        subject: body.subject || '',
        body: body.body || '',
        date: body.date || '',
        status: body.status || 'active',
        hasFile: !!body.dataUrl,
        fileName: body.fileName || '',
        fileSize: body.fileSize || 0,
        dataUrl: body.dataUrl || '',
        createdAt: body.createdAt || new Date().toISOString(),
        deleted: !!body.deleted
      };
      all.items = all.items || [];
      all.items.unshift(item);
      if (all.items.length > 2000) all.items = all.items.slice(0, 2000);
      saveJson(cartPath(), all);
      return send(res, 200, { ok: true, item });
    }
    if (method === 'PUT') {
      const body = await readBody(req);
      const items = Array.isArray(body.items) ? body.items : [];
      const trimmed = items.slice(0, 2000);
      saveJson(cartPath(), { items: trimmed, updatedAt: new Date().toISOString(), updatedBy: s.user });
      return send(res, 200, { ok: true, count: trimmed.length });
    }
  }

  const cartItemMatch = pathname.match(/^\/api\/cartable\/([a-zA-Z0-9_\-]+)$/);
  if (cartItemMatch && method === 'PATCH') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    if (!can(s, 'cartable') && !can(s, '*')) {
      return send(res, 403, { ok: false, error: 'دسترسی کارتابل نیست' });
    }
    const id = cartItemMatch[1];
    const body = await readBody(req);
    const all = loadJson(cartPath(), { items: [] });
    let found = false;
    all.items = (all.items || []).map((x) => {
      if (!x || x.id !== id) return x;
      found = true;
      const next = Object.assign({}, x);
      if (body.status != null) next.status = body.status;
      if (body.deleted != null) next.deleted = !!body.deleted;
      next.updatedAt = new Date().toISOString();
      next.updatedBy = s.user;
      return next;
    });
    if (!found) return send(res, 404, { ok: false, error: 'یافت نشد' });
    saveJson(cartPath(), all);
    return send(res, 200, { ok: true });
  }

  if (pathname === '/api/backup' && method === 'POST') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    if (!can(s, 'backup') && !can(s, '*')) {
      return send(res, 403, { ok: false, error: 'فقط مدیر / مدیرعامل / مدیر' });
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
          let bytes = 0;
          try {
            fs.readdirSync(path.join(BACKUP, e.name)).forEach((f) => {
              try { bytes += fs.statSync(path.join(BACKUP, e.name, f)).size; } catch (x) {}
            });
          } catch (x2) {}
          return { id: e.name, meta: meta, bytes: bytes };
        })
        .sort((a, b) => (a.id < b.id ? 1 : -1))
        .slice(0, 50);
    } catch (e) {}
    return send(res, 200, { ok: true, backups: list });
  }

  
  /* ===== Phase1-B auth-admin APIs ===== */
  if (pathname === '/api/audit' && method === 'GET') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'ÙˆØ§Ø±Ø¯ Ù†Ø´Ø¯Ù‡' });
    if (!isAdminSession(s)) return send(res, 403, { ok: false, error: 'ÙÙ‚Ø· Ù…Ø¯ÛŒØ±' });
    const all = loadJson(auditPath(), { items: [] });
    const limit = Math.min(200, parseInt((url.searchParams && url.searchParams.get('limit')) || '50', 10) || 50);
    return send(res, 200, { ok: true, items: (all.items || []).slice(0, limit) });
  }

  if (pathname === '/api/auth/pin' && method === 'POST') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'ÙˆØ§Ø±Ø¯ Ù†Ø´Ø¯Ù‡' });
    if (!isAdminSession(s)) return send(res, 403, { ok: false, error: 'ÙÙ‚Ø· Ù…Ø¯ÛŒØ±' });
    const body = await readBody(req);
    const newPin = String(body.pin || body.newPin || '').trim();
    if (!/^\d{4,8}$/.test(newPin)) {
      return send(res, 400, { ok: false, error: 'Ù¾ÛŒÙ† Ø¨Ø§ÛŒØ¯ Û´ ØªØ§ Û¸ Ø±Ù‚Ù… Ø¨Ø§Ø´Ø¯' });
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
    if (!s) return send(res, 401, { ok: false, error: 'ÙˆØ§Ø±Ø¯ Ù†Ø´Ø¯Ù‡' });
    const target = userPatch[1];
    const body = await readBody(req);
    const self = s.user === target;
    if (!self && !isAdminSession(s)) {
      return send(res, 403, { ok: false, error: 'Ù…Ø¬ÙˆØ² Ù†ÛŒØ³Øª' });
    }
    const db = usersDb();
    const idx = (db.users || []).findIndex((x) => x.user === target);
    if (idx < 0) return send(res, 404, { ok: false, error: 'Ú©Ø§Ø±Ø¨Ø± ÛŒØ§ÙØª Ù†Ø´Ø¯' });
    const u = Object.assign({}, db.users[idx]);
    if (body.name != null) u.name = String(body.name).slice(0, 80);
    if (body.pass != null && String(body.pass).length > 0) {
      if (String(body.pass).length < 6) {
        return send(res, 400, { ok: false, error: 'Ø±Ù…Ø² Ø­Ø¯Ø§Ù‚Ù„ Û¶ Ú©Ø§Ø±Ø§Ú©ØªØ±' });
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
    if (!s) return send(res, 401, { ok: false, error: 'ÙˆØ§Ø±Ø¯ Ù†Ø´Ø¯Ù‡' });
    if (!isAdminSession(s)) return send(res, 403, { ok: false, error: 'ÙÙ‚Ø· Ù…Ø¯ÛŒØ±' });
    const body = await readBody(req);
    const user = String(body.user || '').trim();
    const pass = String(body.pass || '');
    const name = String(body.name || user).slice(0, 80);
    const role = String(body.role || 'user');
    if (!user || pass.length < 6) {
      return send(res, 400, { ok: false, error: 'user Ùˆ Ø±Ù…Ø² (Ø­Ø¯Ø§Ù‚Ù„ Û¶) Ù„Ø§Ø²Ù… Ø§Ø³Øª' });
    }
    const db = usersDb();
    if ((db.users || []).some((x) => x.user === user)) {
      return send(res, 409, { ok: false, error: 'Ú©Ø§Ø±Ø¨Ø± ØªÚ©Ø±Ø§Ø±ÛŒ' });
    }
    db.users = db.users || [];
    db.users.push({ user: user, pass: hashPass(pass), name: name, role: role });
    saveUsers(db);
    appendAudit({ action: 'user_create', user: s.user, target: user, role: role });
    return send(res, 200, { ok: true, user: { user: user, name: name, role: role } });
  }
  /* ===== end Phase1-B auth-admin APIs ===== */

  
  /* Phase2-C backup-restore APIs */
  if (pathname === '/api/backup/restore' && method === 'POST') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'ÙˆØ§Ø±Ø¯ Ù†Ø´Ø¯Ù‡' });
    if (!can(s, 'backup') && !can(s, '*') && s.role !== 'admin') return send(res, 403, { ok: false, error: 'دسترسی بازیابی نیست' });
    if (!(s.role === 'admin' || s.role === 'ceo' || can(s, '*'))) {
      return send(res, 403, { ok: false, error: 'ÙÙ‚Ø· admin/ceo' });
    }
    const body = await readBody(req);
    const id = String(body.id || body.backup || '').trim();
    try {
      // safety: take a pre-restore snapshot
      runBackup('pre-restore');
      const result = restoreBackup(id);
      try { appendAudit({ action: 'restore', user: s.user, role: s.role, id: (typeof body !== 'undefined' && body && (body.id || body.backup)) || null }); } catch (eR) {}
      return send(res, 200, { ok: true, restore: result });
    } catch (e) {
      return send(res, 400, { ok: false, error: String(e.message || e) });
    }
  }

  
  /* Phase3-B management summary report */
  if (pathname === '/api/reports/summary' && method === 'GET') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'ÙˆØ§Ø±Ø¯ Ù†Ø´Ø¯Ù‡' });
    if (!(s.role === 'admin' || s.role === 'ceo' || s.role === 'manager' || can(s, '*'))) {
      return send(res, 403, { ok: false, error: 'Ø¯Ø³ØªØ±Ø³ÛŒ Ú¯Ø²Ø§Ø±Ø´ Ù†ÛŒØ³Øª' });
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

  
  /* Priority-B financial effects queue */
  function effectsPath() { return path.join(DATA, 'effects.json'); }
  function loadEffects() {
    const db = loadJson(effectsPath(), { items: [] });
    db.items = Array.isArray(db.items) ? db.items : [];
    return db;
  }
  function saveEffects(db) {
    saveJson(effectsPath(), db);
  }

  if (pathname === '/api/effects' && method === 'GET') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    if (!can(s, 'read') && !can(s, '*')) return send(res, 403, { ok: false, error: 'دسترسی خواندن نیست' });
    const db = loadEffects();
    let items = db.items || [];
    const st = (url.searchParams.get('status') || '').trim();
    const src = (url.searchParams.get('source') || '').trim();
    if (st) items = items.filter((x) => x && String(x.status || '') === st);
    if (src) items = items.filter((x) => x && String(x.source || '') === src);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10) || 200, 1000);
    return send(res, 200, { ok: true, items: items.slice(0, limit), total: items.length });
  }

  if (pathname === '/api/effects' && method === 'POST') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    if (!can(s, 'write') && !can(s, '*')) return send(res, 403, { ok: false, error: 'دسترسی نوشتن نیست' });
    const body = await readBody(req);
    const amount = Number(String(body.amount == null ? '' : body.amount).replace(/[^\d.-]/g, ''));
    if (!isFinite(amount) || amount === 0) {
      return send(res, 400, { ok: false, error: 'مبلغ نامعتبر' });
    }
    const source = String(body.source || '').trim() || 'unknown';
    const item = {
      id: 'fx_' + uid(),
      source: source,
      sourceId: body.sourceId != null ? String(body.sourceId) : '',
      date: body.date != null ? String(body.date) : '',
      amount: amount,
      side: String(body.side || 'debit').toLowerCase() === 'credit' ? 'credit' : 'debit',
      accountHint: body.accountHint != null ? String(body.accountHint) : '',
      desc: body.desc != null ? String(body.desc) : '',
      status: 'pending',
      createdAt: new Date().toISOString(),
      createdBy: s.user,
      voucherRef: null
    };
    const db = loadEffects();
    db.items.unshift(item);
    if (db.items.length > 5000) db.items = db.items.slice(0, 5000);
    saveEffects(db);
    try { appendAudit({ action: 'effect_create', user: s.user, role: s.role, effectId: item.id, source: source, amount: amount }); } catch (e) {}
    return send(res, 200, { ok: true, item: item });
  }

  const fxMatch = pathname.match(/^\/api\/effects\/([a-zA-Z0-9_\-]+)$/);
  if (fxMatch && method === 'PATCH') {
    const s = tokenGet(req);
    if (!s) return send(res, 401, { ok: false, error: 'وارد نشده' });
    if (!can(s, 'write') && !can(s, '*')) return send(res, 403, { ok: false, error: 'دسترسی نوشتن نیست' });
    const fid = fxMatch[1];
    const body = await readBody(req);
    const db = loadEffects();
    let found = null;
    db.items = (db.items || []).map((x) => {
      if (!x || x.id !== fid) return x;
      found = Object.assign({}, x);
      if (body.status != null) {
        const st = String(body.status);
        if (['pending', 'posted', 'rejected'].indexOf(st) >= 0) found.status = st;
      }
      if (body.voucherRef != null) found.voucherRef = String(body.voucherRef);
      if (body.accountHint != null) found.accountHint = String(body.accountHint);
      if (body.desc != null) found.desc = String(body.desc);
      found.updatedAt = new Date().toISOString();
      found.updatedBy = s.user;
      return found;
    });
    if (!found) return send(res, 404, { ok: false, error: 'اثر یافت نشد' });
    saveEffects(db);
    try { appendAudit({ action: 'effect_patch', user: s.user, role: s.role, effectId: fid, status: found.status }); } catch (e) {}
    return send(res, 200, { ok: true, item: found });
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
  console.log(' Smart Suite Local Server v1.5.1 (headers+JWT)');
  console.log(' Auth: scrypt + RBAC | Versions API');
  console.log(' http://127.0.0.1:' + cfg.port + '/suite.html');
  console.log(' /api/health  /api/versions');
  console.log(' Login: credentials are not displayed (use secure-setup)');
  console.log('========================================');
  try {
    runBackup('startup');
  } catch (e) {
    console.warn('[backup] startup skipped', e.message);
  }
  setInterval(tickDailyBackup, 5 * 60 * 1000);
});
