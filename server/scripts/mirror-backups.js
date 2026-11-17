/**
 * Mirror server/backups → config.backupExtraDir (second drive/folder)
 *
 *   node scripts/mirror-backups.js
 *   node scripts/mirror-backups.js --latest
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const cfg = loadJson(path.join(ROOT, 'config.json'), {});
const SRC = path.resolve(ROOT, cfg.backupDir || 'backups');
const DEST = path.resolve(cfg.backupExtraDir || 'D:/smart-platform-backups');
const latestOnly = process.argv.indexOf('--latest') >= 0;

function loadJson(p, def) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return def;
  }
}

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function copyDir(src, dest) {
  ensureDir(dest);
  fs.readdirSync(src, { withFileTypes: true }).forEach((ent) => {
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  });
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error('no backups dir:', SRC);
    process.exit(1);
  }
  ensureDir(DEST);
  const dirs = fs
    .readdirSync(SRC, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  if (!dirs.length) {
    console.log('no backup folders yet');
    return;
  }

  const list = latestOnly ? [dirs[dirs.length - 1]] : dirs;
  list.forEach((name) => {
    const from = path.join(SRC, name);
    const to = path.join(DEST, name);
    copyDir(from, to);
    console.log('[ok] mirrored', name, '→', to);
  });
  console.log('extra dir:', DEST);
  console.log('mirrored:', list.length);
}

main();
