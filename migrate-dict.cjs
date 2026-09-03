const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'database.sqlite');

(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(dbPath));

  // Create dictionaries table
  db.run(`
    CREATE TABLE IF NOT EXISTS dictionaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      value TEXT NOT NULL,
      label TEXT NOT NULL,
      color TEXT,
      level INTEGER,
      sort_order INTEGER DEFAULT 0,
      status INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(type, value)
    )
  `);

  const dicts = [
    ['role', 'admin', '超级管理员', 'red', 4, 1],
    ['role', 'module_admin', '模块管理员', 'orange', 3, 2],
    ['role', 'creator', '摄影创作者', 'blue', 2, 3],
    ['role', 'viewer', '访客', 'default', 1, 4],
    ['review_status', '0', '待审核', 'orange', null, 1],
    ['review_status', '1', '已通过', 'green', null, 2],
    ['review_status', '2', '已拒绝', 'red', null, 3],
    ['gender', 'male', '男', null, null, 1],
    ['gender', 'female', '女', null, null, 2],
    ['gender', 'secret', '保密', null, null, 3],
  ];
  for (const [type, value, label, color, level, sort_order] of dicts) {
    db.run(`INSERT OR IGNORE INTO dictionaries (type, value, label, color, level, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      [type, value, label, color, level, sort_order]);
  }
  console.log('Dictionaries seeded');

  // Verify
  const r = db.exec('SELECT type, COUNT(*) as cnt FROM dictionaries GROUP BY type');
  console.log(JSON.stringify(r));

  const d = db.export();
  fs.writeFileSync(dbPath, Buffer.from(d));
  console.log('DB saved');
})();
