const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');

let db = null;

async function initDb() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create photos table with EXIF fields
  db.run(`
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      filename TEXT NOT NULL,
      thumbnail TEXT NOT NULL,
      date TEXT,
      category TEXT,
      rotation REAL DEFAULT 0,
      camera_make TEXT,
      camera_model TEXT,
      exposure_time TEXT,
      f_number TEXT,
      iso TEXT,
      focal_length TEXT,
      software TEXT,
      lens_model TEXT,
      white_balance TEXT,
      metering_mode TEXT,
      flash TEXT,
      color_space TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add EXIF columns if they don't exist (for existing databases)
  const addColumnIfNotExists = (columnName, columnType) => {
    try {
      db.run(`ALTER TABLE photos ADD COLUMN ${columnName} ${columnType}`);
    } catch (e) {
      // Column already exists, ignore
    }
  };

  addColumnIfNotExists('camera_make', 'TEXT');
  addColumnIfNotExists('camera_model', 'TEXT');
  addColumnIfNotExists('exposure_time', 'TEXT');
  addColumnIfNotExists('f_number', 'TEXT');
  addColumnIfNotExists('iso', 'TEXT');
  addColumnIfNotExists('focal_length', 'TEXT');
  addColumnIfNotExists('uploaded_by', 'TEXT');
  addColumnIfNotExists('software', 'TEXT');
  addColumnIfNotExists('lens_model', 'TEXT');
  addColumnIfNotExists('white_balance', 'TEXT');
  addColumnIfNotExists('metering_mode', 'TEXT');
  addColumnIfNotExists('flash', 'TEXT');
  addColumnIfNotExists('color_space', 'TEXT');

  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT,
      email TEXT,
      avatar TEXT,
      role TEXT DEFAULT 'viewer',
      status INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create default admin user if not exists
  const adminCheck = db.prepare('SELECT COUNT(*) as count FROM users WHERE username = ?');
  adminCheck.bind(['admin']);
  adminCheck.step();
  const adminExists = adminCheck.getAsObject().count > 0;
  adminCheck.free();

  if (!adminExists) {
    const bcrypt = require('bcryptjs');
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);
    db.run(
      'INSERT INTO users (username, password, display_name, role) VALUES (?, ?, ?, ?)',
      ['admin', hashedPassword, '管理员', 'admin']
    );
    console.log(`Default admin created: admin / ${adminPassword === 'admin123' ? '(default - CHANGE IN PRODUCTION!)' : '(custom)'}`);
  }

  // Create refresh_tokens table
  db.run(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create index for faster lookups
  db.run('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)');

  // Create roles table
  db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      level INTEGER DEFAULT 0,
      status INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create menus table
  db.run(`
    CREATE TABLE IF NOT EXISTS menus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER DEFAULT NULL,
      key TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      icon TEXT,
      path TEXT,
      sort_order INTEGER DEFAULT 0,
      status INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES menus(id) ON DELETE SET NULL
    )
  `);

  // Create role_permissions table
  db.run(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL,
      menu_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE,
      UNIQUE(role_id, menu_id)
    )
  `);

  // Insert default roles
  db.run(`INSERT OR IGNORE INTO roles (name, label, level) VALUES ('admin', '管理员', 3)`);
  db.run(`INSERT OR IGNORE INTO roles (name, label, level) VALUES ('editor', '编辑者', 2)`);
  db.run(`INSERT OR IGNORE INTO roles (name, label, level) VALUES ('viewer', '查看者', 1)`);

  // Insert default menus
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (1, NULL, 'photography', '摄影', 'CameraOutlined', '/photography', 1)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (2, 1, 'home', '首页', 'HomeOutlined', '/photography/home', 1)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (3, 1, 'portfolio', '作品集', 'PictureOutlined', '/photography/portfolio', 2)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (4, 1, 'admin', '照片管理', 'SettingOutlined', '/photography/admin', 3)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (5, NULL, 'system', '系统管理', 'AppstoreOutlined', '/system', 10)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (6, 5, 'users', '用户管理', 'TeamOutlined', '/photography/admin/users', 1)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (7, 5, 'roles', '角色管理', 'SafetyOutlined', '/photography/admin/roles', 2)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (8, 5, 'menus', '菜单管理', 'MenuOutlined', '/photography/admin/menus', 3)`);

  // Assign default permissions
  db.run(`INSERT OR IGNORE INTO role_permissions (role_id, menu_id) SELECT r.id, m.id FROM roles r, menus m WHERE r.name = 'admin'`);
  db.run(`INSERT OR IGNORE INTO role_permissions (role_id, menu_id) SELECT r.id, m.id FROM roles r, menus m WHERE r.name = 'editor' AND m.id IN (1, 2, 3, 4)`);
  db.run(`INSERT OR IGNORE INTO role_permissions (role_id, menu_id) SELECT r.id, m.id FROM roles r, menus m WHERE r.name = 'viewer' AND m.id IN (1, 2, 3)`);

  // Add role_id column to users table
  try {
    db.run(`ALTER TABLE users ADD COLUMN role_id INTEGER`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Migrate existing role string to role_id
  db.run(`UPDATE users SET role_id = (SELECT id FROM roles WHERE roles.name = users.role) WHERE role_id IS NULL`);

  // Ensure admin user has correct role_id
  db.run(`UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'admin') WHERE username = 'admin' AND role_id IS NULL`);

  saveDb();
  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function getDb() {
  return db;
}

module.exports = { initDb, getDb, saveDb };
