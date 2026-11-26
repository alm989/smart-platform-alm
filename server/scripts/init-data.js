'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const PUBLIC = path.join(ROOT, 'public');
const BACKUP = path.join(ROOT, 'backups');
[DATA, path.join(DATA, 'modules'), path.join(DATA, 'files'), PUBLIC, BACKUP].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});
if (!fs.existsSync(path.join(DATA, 'users.json'))) {
  fs.writeFileSync(
    path.join(DATA, 'users.json'),
    JSON.stringify(
      {
        pin2: '1234',
        users: [{ user: 'admin', pass: 'admin', name: 'مدیر سیستم', role: 'admin' }]
      },
      null,
      2
    ),
    'utf8'
  );
}
if (!fs.existsSync(path.join(DATA, 'cartable.json'))) {
  fs.writeFileSync(path.join(DATA, 'cartable.json'), JSON.stringify({ items: [] }, null, 2), 'utf8');
}
console.log('Data folders ready at', DATA);
