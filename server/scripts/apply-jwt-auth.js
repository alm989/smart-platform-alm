/**
 * Apply JWT auth to server.js (in-place patch)
 *   cd server
 *   node scripts/apply-jwt-auth.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const serverPath = path.join(ROOT, 'server.js');
const cfgPath = path.join(ROOT, 'config.json');

let s = fs.readFileSync(serverPath, 'utf8');

if (s.indexOf('jwtVerify') !== -1 && s.indexOf('require(\./lib/jwt\)') !== -1) {
  console.log('JWT already applied');
  process.exit(0);
}

// ensure jwt secret in config
let cfg = {};
try {
  cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
} catch (e) {}
if (!cfg.jwtSecret || String(cfg.jwtSecret).length < 16) {
  cfg.jwtSecret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
  console.log('[ok] jwtSecret generated in config.json');
}

// inject require after crypto require
if (s.indexOf("require('./lib/jwt')") === -1) {
  s = s.replace(
    "const crypto = require('crypto');",
    "const crypto = require('crypto');\nconst jwtLib = require('./lib/jwt');"
  );
}

// JWT_SECRET constant after cfg load block — after BACKUP_HOUR line
if (s.indexOf('const JWT_SECRET') === -1) {
  s = s.replace(
    /const BACKUP_HOUR = [^;]+;/,
    (m) =>
      m +
      "\nconst JWT_SECRET = cfg.jwtSecret || 'change-me-in-config';\nconst revokedJti = new Set();"
  );
}

// Replace tokenNew
const tokenNewNew = `function tokenNew(session) {
  const role = session.role || 'user';
  const perms = ROLE_PERMS[role] || ROLE_PERMS.user;
  return jwtLib.sign(
    {
      sub: session.user,
      name: session.name || session.user,
      role: role,
      perms: perms
    },
    JWT_SECRET,
    { hours: cfg.sessionHours || 12 }
  );
}`;

if (/function tokenNew\([\s\S]*?\n\}/.test(s)) {
  s = s.replace(/function tokenNew\([\s\S]*?\n\}/, tokenNewNew);
} else {
  console.error('tokenNew not found');
  process.exit(1);
}

const tokenGetNew = `function tokenGet(req) {
  const h = req.headers['authorization'] || '';
  const m = h.match(/^Bearer\\s+(.+)$/i);
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
    jti: payload.jti,
    exp: payload.exp ? payload.exp * 1000 : Date.now() + 3600000
  };
}`;

if (/function tokenGet\([\s\S]*?\n\}/.test(s)) {
  s = s.replace(/function tokenGet\([\s\S]*?\n\}/, tokenGetNew);
} else {
  console.error('tokenGet not found');
  process.exit(1);
}

// logout: revoke jti if JWT
s = s.replace(
  /if \(pathname === '\/api\/auth\/logout' && method === 'POST'\) \{[\s\S]*?return send\(res, 200, \{ ok: true \}\);\s*\}/,
  `if (pathname === '/api/auth/logout' && method === 'POST') {
    const h = req.headers['authorization'] || '';
    const m = h.match(/^Bearer\\s+(.+)$/i);
    const t = m ? m[1].trim() : '';
    if (t) {
      if (sessions.has(t)) sessions.delete(t);
      const payload = jwtLib.verify(t, JWT_SECRET);
      if (payload && payload.jti) revokedJti.add(payload.jti);
    }
    return send(res, 200, { ok: true });
  }`
);

// health: report jwt
s = s.replace(/auth: 'scrypt'/g, "auth: 'scrypt+jwt'");
s = s.replace(/version: '1\.2\.1'/g, "version: '1.4.0'");
s = s.replace(/Smart Suite Local Server v1\.2\.1/g, 'Smart Suite Local Server v1.4.0 (JWT)');
s = s.replace(/serverRuntime: '1\.2\.1'/g, "serverRuntime: '1.4.0'");

// login response: include tokenType
s = s.replace(
  'return send(res, 200, { ok: true, token, user: session });',
  "return send(res, 200, { ok: true, token, tokenType: 'Bearer', auth: 'jwt', user: session });"
);

fs.writeFileSync(serverPath, s, 'utf8');
console.log('[ok] server.js patched for JWT HS256');
console.log('[ok] health version → 1.4.0 auth scrypt+jwt');
console.log('Restart: node server.js');
