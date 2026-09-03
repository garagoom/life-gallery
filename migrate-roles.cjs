const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');

(async () => {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // 1. Clear old roles and permissions
  db.run('DELETE FROM role_permissions');
  db.run('DELETE FROM roles');

  // 2. Insert new roles
  db.run("INSERT INTO roles (id, name, label, level) VALUES (1, 'admin', '超级管理员', 4)");
  db.run("INSERT INTO roles (id, name, label, level) VALUES (2, 'module_admin', '模块管理员', 3)");
  db.run("INSERT INTO roles (id, name, label, level) VALUES (3, 'creator', '摄影创作者', 2)");
  db.run("INSERT INTO roles (id, name, label, level) VALUES (4, 'viewer', '访客', 1)");
  console.log('Roles inserted');

  // 3. Insert permissions
  // admin (1): ALL menus (1,2,3,4,5,6,7,8,9)
  db.run('INSERT INTO role_permissions (role_id, menu_id) VALUES (1,1)');
  db.run('INSERT INTO role_permissions (role_id, menu_id) VALUES (1,2)');
  db.run('INSERT INTO role_permissions (role_id, menu_id) VALUES (1,3)');
  db.run('INSERT INTO role_permissions (role_id, menu_id) VALUES (1,4)');
  db.run('INSERT INTO role_permissions (role_id, menu_id) VALUES (1,5)');
  db.run('INSERT INTO role_permissions (role_id, menu_id) VALUES (1,6)');
  db.run('INSERT INTO role_permissions (role_id, menu_id) VALUES (1,7)');
  db.run('INSERT INTO role_permissions (role_id, menu_id) VALUES (1,8)');
  db.run('INSERT INTO role_permissions (role_id, menu_id) VALUES (1,9)');

  // module_admin (2): photography(1) + home(2) + portfolio(3) + admin(4) + review(9)
  db.run('INSERT INTO role_permissions (role_id, menu_id) VALUES (2,1)');
  db.run('INSERT INTO role_permissions (role_id, menu_id) VALUES (2,2)');
  db.run('INSERT INTO role_permissions (role_id, menu_id) VALUES (2,3)');
  db.run('INSERT INTO role_permissions (role_id, menu_id) VALUES (2,4)');
  db.run('INSERT INTO role_permissions (role_id, menu_id) VALUES (2,9)');

  // creator (3): photography(1) + home(2) + portfolio(3)
  db.run('INSERT INTO role_permissions (role_id, menu_id) VALUES (3,1)');
  db.run('INSERT INTO role_permissions (role_id, menu_id) VALUES (3,2)');
  db.run('INSERT INTO role_permissions (role_id, menu_id) VALUES (3,3)');

  // viewer (4): photography(1) + home(2) + portfolio(3)
  db.run('INSERT INTO role_permissions (role_id, menu_id) VALUES (4,1)');
  db.run('INSERT INTO role_permissions (role_id, menu_id) VALUES (4,2)');
  db.run('INSERT INTO role_permissions (role_id, menu_id) VALUES (4,3)');

  console.log('Permissions inserted');

  // 4. Update admin user to role_id=1, role='admin'
  db.run("UPDATE users SET role = 'admin', role_id = 1 WHERE username = 'admin'");

  // 5. Map old editor users to module_admin, old viewer to viewer
  db.run("UPDATE users SET role = 'module_admin', role_id = 2 WHERE role = 'editor'");
  db.run("UPDATE users SET role = 'viewer', role_id = 4 WHERE role = 'viewer'");

  // 6. Default any other roles to viewer
  db.run("UPDATE users SET role = 'viewer', role_id = 4 WHERE role NOT IN ('admin', 'module_admin', 'creator', 'viewer')");

  console.log('Users updated');

  // Verify
  const roles = db.exec('SELECT * FROM roles ORDER BY level DESC');
  console.log('Roles:', JSON.stringify(roles));

  const perms = db.exec('SELECT r.name, GROUP_CONCAT(m.key) as menus FROM role_permissions rp JOIN roles r ON rp.role_id = r.id JOIN menus m ON rp.menu_id = m.id GROUP BY r.name');
  console.log('Permissions:', JSON.stringify(perms));

  const users = db.exec('SELECT username, role, role_id FROM users');
  console.log('Users:', JSON.stringify(users));

  // Save
  const data = db.export();
  const buf = Buffer.from(data);
  fs.writeFileSync(dbPath, buf);
  console.log('DB saved');
})();
