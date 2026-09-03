const initSqlJs = require('sql.js');
const fs = require('fs');
const dbPath = './database.sqlite';
(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(dbPath));
  
  db.run("UPDATE roles SET label='创作者' WHERE name='creator'");
  db.run("UPDATE dictionaries SET label='创作者' WHERE type='role' AND value='creator'");
  
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  
  const r = db.exec("SELECT id, name, label, level FROM roles ORDER BY level DESC");
  console.log('ROLES:', JSON.stringify(r[0].values));
  const d = db.exec("SELECT type, value, label FROM dictionaries WHERE type='role'");
  console.log('DICT:', JSON.stringify(d[0].values));
  
  db.close();
})();
