const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');

(async () => {
  const SQL = await initSqlJs();
  let db;
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    console.error('DB file not found');
    process.exit(1);
  }

  // Insert review menu (id=9, parent=photography module id=1)
  try {
    db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (9, 1, 'review', '审核管理', 'SafetyOutlined', '/photography/admin/review', 4)`);
    console.log('Review menu inserted');
  } catch (e) {
    console.log('Review menu error:', e.message);
  }

  // Fix system menu key
  try {
    db.run(`UPDATE menus SET key = 'system' WHERE id = 5 AND key != 'system'`);
    console.log('System menu key fixed');
  } catch (e) {}

  // Ensure admin role (id=1) has permission for review menu (id=9)
  try {
    db.run(`INSERT OR IGNORE INTO role_permissions (role_id, menu_id) VALUES (1, 9)`);
    console.log('Admin permission for review menu added');
  } catch (e) {
    console.log('Admin permission error:', e.message);
  }

  // Save
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);

  console.log('Migration complete');

  // Verify
  const result = db.exec(`SELECT id, parent_id, key, label, path FROM menus ORDER BY sort_order`);
  console.log('All menus:', JSON.stringify(result));

  const perms = db.exec(`SELECT * FROM role_permissions WHERE menu_id = 9`);
  console.log('Review permissions:', JSON.stringify(perms));
})();
