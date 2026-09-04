const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
let saveTimer = null;

function resolveDbPath() {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  return path.join(__dirname, '..', 'database.sqlite');
}

async function initDb() {
  const SQL = await initSqlJs();
  const dbPath = resolveDbPath();
  if (dbPath !== ':memory:' && fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
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
      exposure_bias TEXT,
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
  addColumnIfNotExists('exposure_bias', 'TEXT');
  addColumnIfNotExists('flash', 'TEXT');
  addColumnIfNotExists('color_space', 'TEXT');
  addColumnIfNotExists('histogram', 'TEXT');
  addColumnIfNotExists('latitude', 'REAL');
  addColumnIfNotExists('longitude', 'REAL');
  addColumnIfNotExists('altitude', 'REAL');
  addColumnIfNotExists('width', 'INTEGER');
  addColumnIfNotExists('height', 'INTEGER');
  addColumnIfNotExists('medium', 'TEXT');
  addColumnIfNotExists('palette', 'TEXT');
  addColumnIfNotExists('has_avif', 'INTEGER');

  // Add user profile columns if they don't exist
  const addUserColumnIfNotExists = (columnName, columnType) => {
    try {
      db.run(`ALTER TABLE users ADD COLUMN ${columnName} ${columnType}`);
    } catch (e) {
      // Column already exists, ignore
    }
  };

  addUserColumnIfNotExists('gender', 'TEXT');
  addUserColumnIfNotExists('bio', 'TEXT');
  addUserColumnIfNotExists('login_session', 'TEXT');
  addUserColumnIfNotExists('must_change_password', 'INTEGER DEFAULT 0');

  // Add review_status to photos (0=pending, 1=approved, 2=rejected)
  try {
    db.run(`ALTER TABLE photos ADD COLUMN review_status INTEGER DEFAULT 1`);
    // Set existing photos to approved
    db.run(`UPDATE photos SET review_status = 1 WHERE review_status IS NULL`);
  } catch (e) {}

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

  addUserColumnIfNotExists('gender', 'TEXT');
  addUserColumnIfNotExists('bio', 'TEXT');
  addUserColumnIfNotExists('login_session', 'TEXT');
  addUserColumnIfNotExists('must_change_password', 'INTEGER DEFAULT 0');

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
    const mustChange = adminPassword === 'admin123' ? 1 : 0;
    db.run(
      'INSERT INTO users (username, password, display_name, role, must_change_password) VALUES (?, ?, ?, ?, ?)',
      ['admin', hashedPassword, '管理员', 'admin', mustChange]
    );
    console.log(`Default admin created: admin / ${mustChange ? '(default - CHANGE ON FIRST LOGIN)' : '(custom)'}`);
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
  db.run('CREATE INDEX IF NOT EXISTS idx_photos_filename ON photos(filename)');
  db.run('CREATE INDEX IF NOT EXISTS idx_photos_thumbnail ON photos(thumbnail)');
  db.run('CREATE INDEX IF NOT EXISTS idx_photos_medium ON photos(medium)');

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
      type TEXT DEFAULT 'menu',
      visible INTEGER DEFAULT 1,
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
  db.run(`INSERT OR IGNORE INTO roles (name, label, level) VALUES ('admin', '超级管理员', 4)`);
  db.run(`INSERT OR IGNORE INTO roles (name, label, level) VALUES ('module_admin', '模块管理员', 3)`);
  db.run(`INSERT OR IGNORE INTO roles (name, label, level) VALUES ('creator', '创作者', 2)`);
  db.run(`INSERT OR IGNORE INTO roles (name, label, level) VALUES ('viewer', '访客', 1)`);

  // Insert default menus
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (1, NULL, 'photography', '摄影', 'CameraOutlined', '/photography', 1)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (2, 1, 'home', '首页', 'HomeOutlined', '/photography/home', 1)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (3, 1, 'portfolio', '作品集', 'PictureOutlined', '/photography/portfolio', 2)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (4, 1, 'admin', '照片管理', 'SettingOutlined', '/photography/admin', 3)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (9, 1, 'review', '审核管理', 'SafetyOutlined', '/photography/admin/review', 4)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (5, NULL, 'system', '系统管理', 'AppstoreOutlined', '/system', 10)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (6, 5, 'users', '用户管理', 'TeamOutlined', '/photography/admin/users', 1)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (7, 5, 'roles', '角色管理', 'SafetyOutlined', '/photography/admin/roles', 2)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (8, 5, 'menus', '菜单管理', 'MenuOutlined', '/photography/admin/menus', 3)`);

  // Assign default permissions
  db.run(`INSERT OR IGNORE INTO role_permissions (role_id, menu_id) SELECT r.id, m.id FROM roles r, menus m WHERE r.name = 'admin'`);
  db.run(`INSERT OR IGNORE INTO role_permissions (role_id, menu_id) SELECT r.id, m.id FROM roles r, menus m WHERE r.name = 'module_admin' AND m.id IN (1, 2, 3, 4, 9)`);
  db.run(`INSERT OR IGNORE INTO role_permissions (role_id, menu_id) SELECT r.id, m.id FROM roles r, menus m WHERE r.name = 'creator' AND m.id IN (1, 2, 3)`);
  db.run(`INSERT OR IGNORE INTO role_permissions (role_id, menu_id) SELECT r.id, m.id FROM roles r, menus m WHERE r.name = 'viewer' AND m.id IN (1, 2, 3)`);

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

  // Seed dictionary data
  const dicts = [
    ['role', 'admin', '超级管理员', 'red', 4, 1],
    ['role', 'module_admin', '模块管理员', 'orange', 3, 2],
    ['role', 'creator', '创作者', 'blue', 2, 3],
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

  // Add role_id column to users table
  try {
    db.run(`ALTER TABLE users ADD COLUMN role_id INTEGER`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Add type/visible columns to menus table
  try {
    db.run(`ALTER TABLE menus ADD COLUMN type TEXT DEFAULT 'menu'`);
  } catch (e) {}
  try {
    db.run(`ALTER TABLE menus ADD COLUMN visible INTEGER DEFAULT 1`);
  } catch (e) {}

  // Set type for existing menus
  db.run(`UPDATE menus SET type = 'module' WHERE parent_id IS NULL AND type = 'menu'`);
  db.run(`UPDATE menus SET type = 'button' WHERE key IN ('admin', 'review') AND type = 'menu'`);
  db.run(`UPDATE menus SET type = 'menu' WHERE parent_id IS NOT NULL AND key NOT IN ('admin', 'review') AND type = 'menu'`);

  // Seed menu_type and visible dictionaries
  const menuDicts = [
    ['menu_type', 'module', '模块', 'blue', null, 1],
    ['menu_type', 'menu', '菜单', 'green', null, 2],
    ['menu_type', 'button', '按钮', 'orange', null, 3],
    ['visible', '1', '显示', 'green', null, 1],
    ['visible', '0', '隐藏', 'default', null, 2],
  ];
  for (const [type, value, label, color, level, sort_order] of menuDicts) {
    db.run(`INSERT OR IGNORE INTO dictionaries (type, value, label, color, level, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      [type, value, label, color, level, sort_order]);
  }

  // Migrate existing role string to role_id
  db.run(`UPDATE users SET role_id = (SELECT id FROM roles WHERE roles.name = users.role) WHERE role_id IS NULL`);

  // Ensure admin user has correct role_id
  db.run(`UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'admin') WHERE username = 'admin'`);

  // Backfill existing users: default avatar by gender, gender='secret' if null
  db.run(`UPDATE users SET gender = 'secret' WHERE gender IS NULL`);
  db.run(`UPDATE users SET avatar = '/images/avatars/male.svg' WHERE avatar IS NULL AND (gender = 'male' OR gender = 'secret' OR gender IS NULL)`);
  db.run(`UPDATE users SET avatar = '/images/avatars/female.svg' WHERE avatar IS NULL AND gender = 'female'`);

  flushDb();
  return db;
}

function saveDb() {
  scheduleSave();
}

function scheduleSave() {
  if (!db) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    writeDbFile();
  }, 400);
}

function flushDb() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  writeDbFile();
}

function writeDbFile() {
  if (!db) return;
  const dbPath = resolveDbPath();
  if (dbPath === ':memory:') return;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function closeDb() {
  flushDb();
}

function getDb() {
  return db;
}

module.exports = { initDb, getDb, saveDb, flushDb, closeDb };
