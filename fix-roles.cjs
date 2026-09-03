const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'database.sqlite');

(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(dbPath));
  db.run("UPDATE users SET role = 'module_admin', role_id = 2 WHERE username IN ('niko', 'shenshuai')");
  const r = db.exec('SELECT username, role, role_id FROM users');
  console.log(JSON.stringify(r));
  const d = db.export();
  fs.writeFileSync(dbPath, Buffer.from(d));
  console.log('saved');
})();
