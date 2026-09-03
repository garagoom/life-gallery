const { getDb } = require('./server/db.cjs');
const db = getDb();

const r = db.exec('SELECT * FROM menus ORDER BY sort_order');
console.log('MENUS:', JSON.stringify(r));

const r2 = db.exec('SELECT * FROM role_permissions');
console.log('ROLE_PERM:', JSON.stringify(r2));

const r3 = db.exec('SELECT id, name FROM roles');
console.log('ROLES:', JSON.stringify(r3));
