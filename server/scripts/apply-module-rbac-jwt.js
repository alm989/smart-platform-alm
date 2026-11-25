/**
 * Extend JWT RBAC with modules[] claim and enforce on /api/data/:id
 * Requires apply-jwt-auth.js already applied.
 *
 *   cd server
 *   node scripts/apply-module-rbac-jwt.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.js');
let s = fs.readFileSync(serverPath, 'utf8');

if (s.indexOf('modulesForRole') !== -1 && s.indexOf('canAccessModule') !== -1) {
  console.log('module RBAC already applied');
  process.exit(0);
}

if (s.indexOf("require('./lib/jwt')") === -1 && s.indexOf('jwtLib') === -1) {
  console.error('Apply JWT first: node scripts/apply-jwt-auth.js');
  process.exit(1);
}

// require rbac-modules
if (s.indexOf("require('./lib/rbac-modules')") === -1) {
  if (s.indexOf("require('./lib/jwt')") !== -1) {
    s = s.replace(
      "require('./lib/jwt')",
      "require('./lib/jwt');\nconst { modulesForRole, canAccessModule } = require('./lib/rbac-modules')"
    );
  } else if (s.indexOf('const jwtLib') !== -1) {
    s = s.replace(
      /const jwtLib = require\(['\"]\.\/lib\/jwt['\"]\);/,
      "const jwtLib = require('./lib/jwt');\nconst { modulesForRole, canAccessModule } = require('./lib/rbac-modules');"
    );
  } else {
    s = s.replace(
      "const crypto = require('crypto');",
      "const crypto = require('crypto');\nconst { modulesForRole, canAccessModule } = require('./lib/rbac-modules');"
    );
  }
}

// enrich tokenNew payload with modules
if (s.indexOf('modules: modulesForRole') === -1) {
  // common pattern after apply-jwt
  if (s.indexOf('function tokenNew') !== -1) {
    s = s.replace(
      /return jwtLib\.sign\(\s*\{([\s\S]*?)\}\s*,\s*JWT_SECRET/,
      function (full, body) {
        if (body.indexOf('modules') !== -1) return full;
        const injected =
          '{\n      sub: session.user,\n      name: session.name || session.user,\n      role: role,\n      perms: perms,\n      modules: modulesForRole(role)\n    }';
        return 'return jwtLib.sign(\n    ' + injected + ',\n    JWT_SECRET';
      }
    );
  }
}

// tokenGet: pass modules from payload
if (s.indexOf('modules: payload.modules') === -1 && s.indexOf('function tokenGet') !== -1) {
  s = s.replace(
    /return \{\s*user: payload\.sub,\s*name: payload\.name \|\| payload\.sub,\s*role: payload\.role \|\| 'user',\s*perms: payload\.perms \|\| ROLE_PERMS\[payload\.role\] \|\| ROLE_PERMS\.user,/
    ,
    `return {
    user: payload.sub,
    name: payload.name || payload.sub,
    role: payload.role || 'user',
    perms: payload.perms || ROLE_PERMS[payload.role] || ROLE_PERMS.user,
    modules: payload.modules || modulesForRole(payload.role || 'user'),`
  );
}

// enforce on /api/data/:id after auth check
const guard = `
    if (!canAccessModule(s.role, id)) {
      return send(res, 403, { ok: false, error: 'دسترسی به این ماژول مجاز نیست', moduleId: id, role: s.role });
    }
`;

if (s.indexOf('دسترسی به این ماژول مجاز نیست') === -1) {
  // after: if (!s) return send(res, 401...
  const re = /(const modMatch = pathname\.match[\s\S]*?if \(!s\) return send\(res, 401, \{ ok: false, error: '[^']+' \}\);)/;
  if (re.test(s)) {
    s = s.replace(re, function (m) {
      return m + '\n' + guard;
    });
  } else {
    // alternate: after const id = modMatch[1];
    s = s.replace(
      /(const id = modMatch\[1\];\s*const s = tokenGet\(req\);\s*if \(!s\) return send\(res, 401,[^;]+;)/,
      function (m) {
        return m + '\n' + guard;
      }
    );
  }
}

// /api/me include modules
if (s.indexOf('modules: s.modules') === -1) {
  s = s.replace(
    /(if \(pathname === '\/api\/me' && method === 'GET'\) \{[\s\S]*?return send\(res, 200, \{\s*ok: true,\s*user: \{)([\s\S]*?)(\n\s*\}\s*\}\);)/,
    function (full, a, body, c) {
      if (body.indexOf('modules') !== -1) return full;
      return (
        a +
        '\n        user: s.user,\n        name: s.name,\n        role: s.role,\n        perms: ROLE_PERMS[s.role] || ROLE_PERMS.user,\n        modules: s.modules || modulesForRole(s.role)\n      ' +
        c
      );
    }
  );
}

// version bump hint
s = s.replace(/version: '1\.4\.0'/g, "version: '1.5.0'");
s = s.replace(/1\.4\.0 \(JWT\)/g, '1.5.0 (JWT+modules)');
s = s.replace(/serverRuntime: '1\.4\.0'/g, "serverRuntime: '1.5.0'");

fs.writeFileSync(serverPath, s, 'utf8');
console.log('[ok] module RBAC on JWT + /api/data guard');
console.log('[ok] version → 1.5.0');
console.log('Restart: node server.js');
