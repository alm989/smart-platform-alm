/**
 * Clean suite.html meta CSP + inject scripts
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
  '<script src="server-bridge.js"></script>\n' +
  '<script src="suite-jwt-gate.js"></script>\n';

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

  if (s.indexOf('suite-jwt-gate.js') === -1) {
    // remove partial inject if only bridge present, re-add full set
    if (s.indexOf('server-bridge.js') === -1) {
      s = s.replace('</body>', inject + '</body>');
    } else if (s.indexOf('suite-jwt-gate.js') === -1) {
      s = s.replace(
        /<script src="server-bridge\.js"><\/script>/,
        '<script src="server-bridge.js"></script>\n<script src="suite-jwt-gate.js"></script>'
      );
    }
  }

  if (s !== orig) {
    fs.writeFileSync(fp, s, 'utf8');
    console.log('[ok]', fp);
  } else {
    console.log('[skip]', fp);
  }
});
