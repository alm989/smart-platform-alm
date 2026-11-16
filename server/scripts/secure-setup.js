/**
 * Secure setup for Smart Suite local server
 * Usage (from server folder):
 *   node scripts/secure-setup.js --admin-pass "NewStrongPass" --pin "5678"
 *   node scripts/secure-setup.js --add-user "user:UserPass123:کاربر عادی:user"
 *   node scripts/secure-setup.js --add-user "manager1:MgrPass123:مدیر میانی:manager"
 *   node scripts/secure-setup.js --list
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const USERS = path.join(ROOT, 'data', 'users.json');

function hashPass(pass) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pass), salt, 32).toString('hex');
  return 'scrypt$' + salt + '$' + hash;
}

function load() {
  if (!fs.existsSync(USERS)) {
    return { pin2: '1234', users: [] };
  }
  return JSON.parse(fs.readFileSync(USERS, 'utf8'));
}

function save(db) {
  const dir = path.dirname(USERS);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(USERS, JSON.stringify(db, null, 2), 'utf8');
}

function parseArgs(argv) {
  const out = { addUsers: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--admin-pass' && argv[i + 1]) out.adminPass = argv[++i];
    else if (a === '--pin' && argv[i + 1]) out.pin = argv[++i];
    else if (a === '--add-user' && argv[i + 1]) out.addUsers.push(argv[++i]);
    else if (a === '--list') out.list = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.adminPass && !args.pin && !args.addUsers.length && !args.list)) {
    console.log('Smart Suite secure-setup');
    console.log('  --admin-pass <pass>   set password for user "admin"');
    console.log('  --pin <4digits>       set global pin2');
    console.log('  --add-user user:pass:name:role');
    console.log('  --list');
    process.exit(0);
  }

  const db = load();
  db.users = Array.isArray(db.users) ? db.users : [];
  let changed = false;

  if (args.pin) {
    if (!/^\d{4,8}$/.test(String(args.pin))) {
      console.error('pin must be 4-8 digits');
      process.exit(1);
    }
    db.pin2 = String(args.pin);
    changed = true;
    console.log('[ok] pin2 updated');
  }

  if (args.adminPass) {
    if (String(args.adminPass).length < 6) {
      console.error('admin password min 6 chars');
      process.exit(1);
    }
    let admin = db.users.find((u) => u.user === 'admin');
    if (!admin) {
      admin = { user: 'admin', name: 'مدیر', role: 'admin' };
      db.users.unshift(admin);
    }
    admin.pass = hashPass(args.adminPass);
    admin.role = admin.role || 'admin';
    changed = true;
    console.log('[ok] admin password updated (scrypt)');
  }

  args.addUsers.forEach((spec) => {
    const parts = String(spec).split(':');
    const user = (parts[0] || '').trim();
    const pass = parts[1] || '';
    const name = parts[2] || user;
    const role = (parts[3] || 'user').trim();
    if (!user || pass.length < 6) {
      console.error('skip invalid --add-user', spec);
      return;
    }
    if (!['admin', 'ceo', 'manager', 'user', 'guest'].includes(role)) {
      console.error('skip bad role', role);
      return;
    }
    let row = db.users.find((u) => u.user === user);
    if (!row) {
      row = { user: user };
      db.users.push(row);
    }
    row.pass = hashPass(pass);
    row.name = name;
    row.role = role;
    changed = true;
    console.log('[ok] user upsert', user, role);
  });

  if (changed) save(db);

  if (args.list || changed) {
    const now = load();
    console.log('--- users ---');
    console.log('pin2:', now.pin2 ? '(set)' : '(empty)');
    (now.users || []).forEach((u) => {
      console.log('-', u.user, '|', u.name || '', '|', u.role || 'user', '|', String(u.pass || '').startsWith('scrypt$') ? 'scrypt' : 'plain');
    });
  }
}

main();
