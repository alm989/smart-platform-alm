/**
 * Patch suite.html (public or root):
 *  - CSP: script-src 'self' 'unsafe-inline' (allow external JS)
 *  - remove frame-ancestors from meta (browser ignores it anyway)
 *  - inject core.js + server-bridge.js before </body>
 *
 *   cd server
 *   node scripts/patch-suite-bridge.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const candidates = [
  path.join(__dirname, '..', 'public', 'suite.html'),
  path.join(__dirname, '..', '..', 'suite.html'),
  path.join(__dirname, '..', 'suite.html')
];

const inject =
  '<script src="core.js"></script>\n' +
  '<script src="server-bridge.js"></script>\n';

let n = 0;
candidates.forEach((fp) => {
  if (!fs.existsSync(fp)) return;
  let s = fs.readFileSync(fp, 'utf8');
  let orig = s;

  // CSP fix
  s = s.replace(
    /script-src 'unsafe-inline'/g,
    "script-src 'self' 'unsafe-inline'"
  );
  s = s.replace(/\s*frame-ancestors 'none';?/g, '');

  // inject scripts once
  if (s.indexOf('server-bridge.js') === -1) {
    if (s.indexOf('</body>') !== -1) {
      s = s.replace('</body>', inject + '</body>');
    } else {
      s += '\n' + inject;
    }
  }

  if (s !== orig) {
    fs.writeFileSync(fp, s, 'utf8');
    console.log('[ok] patched', fp);
    n++;
  } else {
    console.log('[skip] already ok', fp);
  }
});

console.log('done, files changed:', n);
