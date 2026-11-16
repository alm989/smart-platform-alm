/**
 * Patch local server.js to enforce optimistic locking on PUT /api/data/:id
 * Run once from server folder:
 *   node scripts/apply-optimistic-lock.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const fp = path.join(__dirname, '..', 'server.js');
let s = fs.readFileSync(fp, 'utf8');

if (s.indexOf('baseVersion') !== -1 && s.indexOf('conflict: true') !== -1) {
  console.log('already patched');
  process.exit(0);
}

const needle = /const prev = loadJson\(fp, \{ version: 0, payload: \{\} \}\);\s*\n\s*const next = \{/;
const insert =
  'const prev = loadJson(fp, { version: 0, payload: {} });\n' +
  '      const bodyBase = body.baseVersion;\n' +
  '      if (bodyBase != null && bodyBase !== "" && Number(bodyBase) !== Number(prev.version || 0)) {\n' +
  '        return send(res, 409, {\n' +
  '          ok: false,\n' +
  '          conflict: true,\n' +
  '          error: "تداخل نسخه — داده سرور جدیدتر است",\n' +
  '          serverVersion: prev.version || 0,\n' +
  '          data: prev\n' +
  '        });\n' +
  '      }\n' +
  '      const next = {';

if (!needle.test(s)) {
  console.error('pattern not found — manual patch needed');
  process.exit(1);
}

s = s.replace(needle, insert);
s = s.replace(/Smart Suite Local Server v1\.2\.1/g, 'Smart Suite Local Server v1.3.0');
s = s.replace(/version: '1\.2\.1'/g, "version: '1.3.0'");
s = s.replace(/serverRuntime: '1\.2\.1'/g, "serverRuntime: '1.3.0'");
fs.writeFileSync(fp, s, 'utf8');
console.log('patched optimistic lock -> server v1.3.0');
