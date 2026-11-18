/**
 * Add real HTTP security headers on static + API responses.
 * Fixes browser warning: frame-ancestors ignored in <meta>
 *
 *   cd server
 *   node scripts/apply-security-headers.js
 *   node server.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const fp = path.join(__dirname, '..', 'server.js');
let s = fs.readFileSync(fp, 'utf8');

if (s.indexOf('function securityHeaders') !== -1) {
  console.log('already applied');
  process.exit(0);
}

const helper = `
function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
    'Permissions-Policy': 'microphone=(self), geolocation=()'
  };
}
`;

// inject helper near other small helpers (after send function is hard; after uid is fine)
if (s.indexOf('function uid()') !== -1) {
  s = s.replace('function uid()', helper + '\nfunction uid()');
} else {
  s = s.replace("'use strict';", "'use strict';\n" + helper);
}

// merge into send()
s = s.replace(
  /function send\(res, code, obj\) \{\s*const body = JSON\.stringify\(obj\);\s*res\.writeHead\(code, \{([\s\S]*?)\}\);/,
  function (full, headersBlock) {
    if (headersBlock.indexOf('securityHeaders') !== -1) return full;
    return (
      'function send(res, code, obj) {\n' +
      '  const body = JSON.stringify(obj);\n' +
      '  res.writeHead(code, Object.assign({}, securityHeaders(), {\n' +
      headersBlock +
      '  }));\n'
    );
  }
);

// merge into serveStatic success writeHead
if (s.indexOf("res.writeHead(200, {") !== -1 && s.indexOf('securityHeaders()') === -1) {
  s = s.replace(
    /res\.writeHead\(200, \{\s*'Content-Type': mime\(file\),/,
    "res.writeHead(200, Object.assign({}, securityHeaders(), {\n    'Content-Type': mime(file),"
  );
}

// version note
s = s.replace(/version: '1\.5\.0'/g, "version: '1.5.1'");
s = s.replace(/1\.5\.0 \(JWT\+modules\)/g, '1.5.1 (headers+JWT)');

fs.writeFileSync(fp, s, 'utf8');
console.log('[ok] security headers applied → restart node server.js');
