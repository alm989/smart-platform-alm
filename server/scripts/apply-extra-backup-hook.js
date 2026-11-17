/**
 * Patch server.js runBackup to also mirror into config.backupExtraDir
 * Run once:
 *   node scripts/apply-extra-backup-hook.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const fp = path.join(__dirname, '..', 'server.js');
let s = fs.readFileSync(fp, 'utf8');

if (s.indexOf('mirrorBackupToExtra') !== -1) {
  console.log('already patched');
  process.exit(0);
}

const helper = `
function mirrorBackupToExtra(stampDir) {
  try {
    const extra = cfg.backupExtraDir;
    if (!extra) return;
    const destRoot = path.resolve(extra);
    if (!fs.existsSync(destRoot)) fs.mkdirSync(destRoot, { recursive: true });
    const name = path.basename(stampDir);
    const dest = path.join(destRoot, name);
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(stampDir).forEach((f) => {
      const from = path.join(stampDir, f);
      const st = fs.statSync(from);
      if (st.isFile()) fs.copyFileSync(from, path.join(dest, f));
    });
    console.log('[backup] mirrored →', dest);
  } catch (e) {
    console.warn('[backup] mirror failed', e.message);
  }
}
`;

if (s.indexOf('function runBackup') === -1) {
  console.error('runBackup not found');
  process.exit(1);
}

// inject helper before runBackup
s = s.replace('function runBackup(label) {', helper + '\nfunction runBackup(label) {');

// after console.log('[backup]', dir); call mirror
if (s.indexOf("console.log('[backup]', dir);") !== -1) {
  s = s.replace(
    "console.log('[backup]', dir);",
    "console.log('[backup]', dir);\n  mirrorBackupToExtra(dir);"
  );
} else if (s.indexOf('console.log("[backup]", dir);') !== -1) {
  s = s.replace(
    'console.log("[backup]", dir);',
    'console.log("[backup]", dir);\n  mirrorBackupToExtra(dir);'
  );
} else {
  // fallback: before return stamp
  s = s.replace(
    /return stamp;\s*\n\}/,
    'mirrorBackupToExtra(dir);\n  return stamp;\n}'
  );
}

fs.writeFileSync(fp, s, 'utf8');
console.log('patched: runBackup → mirrorBackupToExtra');
console.log('set config.backupExtraDir e.g. D:/smart-platform-backups');
