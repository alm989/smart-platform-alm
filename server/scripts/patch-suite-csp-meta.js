/**
 * Clean suite.html meta CSP:
 *  - script-src 'self' 'unsafe-inline'
 *  - remove frame-ancestors (use HTTP header instead)
 *  - ensure core.js + server-bridge.js before </body>
 *
 *   node scripts/patch-suite-csp-meta.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'public', 'suite.html'),
  path.join(__dirname, '..', '..', 'suite.html')
];

const inject =
  '<script src="core.js"></script>\n' +
  '<script src="server-bridge.js"></script>\n';

files.forEach((fp) => {
  if (!fs.existsSync(fp)) {
    console.log('skip missing', fp);
    return;
  }
  let s = fs.readFileSync(fp, 'utf8');
  const orig = s;

  s = s.replace(/script-src 'unsafe-inline'/g, "script-src 'self' 'unsafe-inline'");
  s = s.replace(/\s*frame-ancestors 'none';?/g, '');
  s = s.replace(/\s*upgrade-insecure-requests/g, '');

  if (s.indexOf('src="server-bridge.js"') === -1 && s.indexOf("src='server-bridge.js'") === -1) {
    s = s.replace('</body>', inject + '</body>');
  }

  if (s !== orig) {
    fs.writeFileSync(fp, s, 'utf8');
    console.log('[ok]', fp);
  } else {
    console.log('[skip]', fp);
  }
});
