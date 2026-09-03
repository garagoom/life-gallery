const initSqlJs = require('sql.js');
const fs = require('fs');
(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync('./database.sqlite'));
  
  const r = db.exec("SELECT id, name, label, level FROM roles ORDER BY level DESC");
  console.log('ROLES:', JSON.stringify(r[0].values));
  
  const d = db.exec("SELECT type, value, label FROM dictionaries WHERE type='role'");
  console.log('DICT:', JSON.stringify(d[0].values));
  
  const u = db.exec("SELECT id, username, role, role_id FROM users");
  console.log('USERS:', JSON.stringify(u[0].values));
  
  db.close();
})();
