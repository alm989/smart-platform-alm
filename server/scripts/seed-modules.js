/**
 * Seed empty-but-valid module data files so /api/health modules > 0
 * and first pull does not wipe local structure.
 *
 *   node scripts/seed-modules.js
 *   node scripts/seed-modules.js cashbox bank sales
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MOD_DIR = path.join(ROOT, 'data', 'modules');

const TEMPLATES = {
  cashbox: {
    version: 1,
    updatedAt: null,
    createdAt: null,
    stores: { main: { name: 'صندوق اصلی', balance: 0 } },
    txs: [],
    funds: [],
    meta: { seeded: true }
  },
  bank: {
    version: 1,
    updatedAt: null,
    createdAt: null,
    accounts: [],
    txs: [],
    meta: { seeded: true }
  },
  accounting: {
    version: 1,
    updatedAt: null,
    accounts: [],
    journals: [],
    meta: { seeded: true }
  },
  sales: {
    version: 1,
    updatedAt: null,
    invoices: [],
    customers: [],
    meta: { seeded: true }
  },
  warehouse: {
    version: 1,
    updatedAt: null,
    items: [],
    movements: [],
    meta: { seeded: true }
  }
};

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function main() {
  ensureDir(MOD_DIR);
  const args = process.argv.slice(2);
  const ids = args.length ? args : ['cashbox', 'bank'];
  const now = new Date().toISOString();
  ids.forEach((id) => {
    const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
    const fp = path.join(MOD_DIR, safe + '.json');
    if (fs.existsSync(fp)) {
      console.log('[skip] exists', safe);
      return;
    }
    const payload = TEMPLATES[safe] || {
      version: 1,
      updatedAt: null,
      items: [],
      meta: { seeded: true }
    };
    payload.updatedAt = now;
    payload.createdAt = now;
    const wrap = {
      version: 1,
      updatedAt: now,
      updatedBy: 'seed',
      payload: payload
    };
    fs.writeFileSync(fp, JSON.stringify(wrap, null, 2), 'utf8');
    console.log('[ok] seeded', safe);
  });
  const n = fs.readdirSync(MOD_DIR).filter((f) => f.endsWith('.json')).length;
  console.log('modules on disk:', n);
}

main();
