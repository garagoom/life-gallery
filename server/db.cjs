const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
let saveTimer = null;

function getRoleIdByName(database, name) {
  const stmt = database.prepare('SELECT id FROM roles WHERE name = ?');
  stmt.bind([name]);
  const id = stmt.step() ? stmt.getAsObject().id : null;
  stmt.free();
  return id;
}

function migrateModuleAdminRole(database) {
  const moduleAdminId = getRoleIdByName(database, 'module_admin');
  if (!moduleAdminId) return;

  const photoAdminId = getRoleIdByName(database, 'photography_admin');
  if (!photoAdminId) {
    database.run(
      `UPDATE roles SET name = 'photography_admin', label = '摄影模块管理员' WHERE id = ?`,
      [moduleAdminId]
    );
    database.run(`UPDATE users SET role = 'photography_admin' WHERE role = 'module_admin'`);
    return;
  }

  if (photoAdminId === moduleAdminId) return;

  database.run(
    `UPDATE users SET role = 'photography_admin', role_id = ? WHERE role = 'module_admin' OR role_id = ?`,
    [photoAdminId, moduleAdminId]
  );
  database.run(
    `INSERT OR IGNORE INTO role_permissions (role_id, menu_id)
     SELECT ?, menu_id FROM role_permissions WHERE role_id = ?`,
    [photoAdminId, moduleAdminId]
  );
  database.run(`DELETE FROM role_permissions WHERE role_id = ?`, [moduleAdminId]);
  database.run(`DELETE FROM roles WHERE id = ?`, [moduleAdminId]);
}

function seedRoleDataPerms(database, roleName, codes) {
  const roleId = getRoleIdByName(database, roleName);
  if (!roleId) return;
  for (const code of codes) {
    database.run(
      'INSERT OR IGNORE INTO role_data_permissions (role_id, code) VALUES (?, ?)',
      [roleId, code]
    );
  }
}

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
  addColumnIfNotExists('is_public', 'INTEGER DEFAULT 1');
  addColumnIfNotExists('reviewed_by', 'TEXT');
  addColumnIfNotExists('reviewed_at', 'DATETIME');
  try {
    db.run('UPDATE photos SET is_public = 1 WHERE is_public IS NULL');
  } catch (e) {}

  // Add review_status to photos (0=pending, 1=approved, 2=rejected)
  try {
    db.run(`ALTER TABLE photos ADD COLUMN review_status INTEGER DEFAULT 1`);
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

  migrateModuleAdminRole(db);

  db.run(`INSERT OR IGNORE INTO roles (name, label, level) VALUES ('admin', '超级管理员', 4)`);
  db.run(`INSERT OR IGNORE INTO roles (name, label, level) VALUES ('photography_admin', '摄影模块管理员', 3)`);
  db.run(`INSERT OR IGNORE INTO roles (name, label, level) VALUES ('system_admin', '系统模块管理员', 3)`);
  db.run(`INSERT OR IGNORE INTO roles (name, label, level) VALUES ('travel_admin', '旅游模块管理员', 3)`);
  db.run(`INSERT OR IGNORE INTO roles (name, label, level) VALUES ('reviewer', '图片审核员', 2)`);
  db.run(`INSERT OR IGNORE INTO roles (name, label, level) VALUES ('creator', '创作者', 2)`);
  db.run(`INSERT OR IGNORE INTO roles (name, label, level) VALUES ('viewer', '访客', 1)`);

  // Insert default menus
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (1, NULL, 'photography', '摄影', 'CameraOutlined', '/photography', 1)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (2, 1, 'home', '首页', 'HomeOutlined', '/photography/home', 1)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (3, 1, 'portfolio', '作品集', 'PictureOutlined', '/photography/portfolio', 2)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (14, 1, 'calendar', '照片日历', 'CalendarOutlined', '/photography/calendar', 3)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (4, 1, 'admin', '照片管理', 'SettingOutlined', '/photography/admin', 3)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (9, 1, 'review', '审核管理', 'SafetyOutlined', '/photography/admin/review', 4)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (5, NULL, 'system', '系统管理', 'AppstoreOutlined', '/system', 10)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (6, 5, 'users', '用户管理', 'TeamOutlined', '/photography/admin/users', 1)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (7, 5, 'roles', '角色管理', 'SafetyOutlined', '/photography/admin/roles', 2)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (8, 5, 'menus', '菜单管理', 'MenuOutlined', '/photography/admin/menus', 3)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (10, NULL, 'travel', '旅游', 'EnvironmentOutlined', '/travel', 2)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (11, 10, 'travel_trips', '出游计划', 'CalendarOutlined', '/travel/trips', 1)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (12, 10, 'travel_budget', '预算总览', 'AccountBookOutlined', '/travel/budget', 2)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (13, 10, 'travel_home', '旅程', 'CompassOutlined', '/travel/home', 3)`);
  db.run(`INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES (15, 10, 'travel_shopping', '购物清单', 'CalculatorOutlined', '/travel/shopping', 4)`);
  db.run(`UPDATE menus SET label = '购物清单', icon = 'CalculatorOutlined', path = '/travel/shopping', sort_order = 4 WHERE key = 'travel_shopping'`);

  // Assign default permissions
  db.run(`INSERT OR IGNORE INTO role_permissions (role_id, menu_id) SELECT r.id, m.id FROM roles r, menus m WHERE r.name = 'admin'`);
  db.run(`INSERT OR IGNORE INTO role_permissions (role_id, menu_id) SELECT r.id, m.id FROM roles r, menus m WHERE r.name = 'photography_admin' AND m.id IN (1, 2, 3, 4, 9, 14)`);
  db.run(`INSERT OR IGNORE INTO role_permissions (role_id, menu_id) SELECT r.id, m.id FROM roles r, menus m WHERE r.name = 'system_admin' AND m.id IN (5, 6, 7, 8)`);
  db.run(`INSERT OR IGNORE INTO role_permissions (role_id, menu_id) SELECT r.id, m.id FROM roles r, menus m WHERE r.name = 'travel_admin' AND m.key IN ('travel', 'travel_trips', 'travel_budget', 'travel_home', 'travel_shopping')`);
  db.run(`INSERT OR IGNORE INTO role_permissions (role_id, menu_id) SELECT r.id, m.id FROM roles r, menus m WHERE r.name = 'reviewer' AND m.id IN (1, 9)`);
  db.run(`INSERT OR IGNORE INTO role_permissions (role_id, menu_id) SELECT r.id, m.id FROM roles r, menus m WHERE r.name = 'creator' AND m.key IN ('photography', 'home', 'portfolio', 'calendar', 'travel', 'travel_trips', 'travel_budget', 'travel_shopping')`);
  db.run(`INSERT OR IGNORE INTO role_permissions (role_id, menu_id) SELECT r.id, m.id FROM roles r, menus m WHERE r.name = 'viewer' AND m.id IN (1, 2, 3, 14)`);

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
    ['role', 'photography_admin', '摄影模块管理员', 'orange', 3, 2],
    ['role', 'system_admin', '系统模块管理员', 'gold', 3, 3],
    ['role', 'travel_admin', '旅游模块管理员', 'cyan', 3, 7],
    ['role', 'reviewer', '图片审核员', 'purple', 2, 4],
    ['role', 'creator', '创作者', 'blue', 2, 5],
    ['role', 'viewer', '访客', 'default', 1, 6],
    ['review_status', '0', '待审核', 'orange', null, 1],
    ['review_status', '1', '审核通过', 'green', null, 2],
    ['review_status', '2', '审核失败', 'red', null, 3],
    ['gender', 'male', '男', null, null, 1],
    ['gender', 'female', '女', null, null, 2],
    ['gender', 'secret', '保密', null, null, 3],
  ];
  for (const [type, value, label, color, level, sort_order] of dicts) {
    db.run(`INSERT OR IGNORE INTO dictionaries (type, value, label, color, level, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      [type, value, label, color, level, sort_order]);
  }

  db.run(`UPDATE dictionaries SET label = '审核通过' WHERE type = 'review_status' AND value = '1'`);
  db.run(`UPDATE dictionaries SET label = '审核失败' WHERE type = 'review_status' AND value = '2'`);
  db.run(`UPDATE dictionaries SET label = '待审核' WHERE type = 'review_status' AND value = '0'`);

  // Add role_id column to users table
  try {
    db.run(`ALTER TABLE users ADD COLUMN role_id INTEGER`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Add type/visible columns to menus table
  try {
    db.run('ALTER TABLE menus ADD COLUMN type TEXT DEFAULT \'menu\'');
  } catch (e) {}
  try {
    db.run('ALTER TABLE menus ADD COLUMN visible INTEGER DEFAULT 1');
  } catch (e) {}
  try {
    db.run('ALTER TABLE menus ADD COLUMN has_data_scope INTEGER DEFAULT 0');
  } catch (e) {}

  db.run(`UPDATE menus SET type = 'module' WHERE parent_id IS NULL AND type = 'menu'`);
  db.run(`UPDATE menus SET type = 'button' WHERE key IN ('admin', 'review') AND type = 'menu'`);
  db.run(`UPDATE menus SET type = 'menu' WHERE parent_id IS NOT NULL AND key NOT IN ('admin', 'review') AND type = 'menu'`);
  db.run(`UPDATE menus SET has_data_scope = 1 WHERE key IN ('admin', 'review', 'users', 'roles', 'menus', 'travel_trips', 'travel_budget', 'travel_shopping', 'calendar')`);
  db.run(`UPDATE menus SET has_data_scope = 0 WHERE key IN ('photography', 'home', 'portfolio', 'system', 'travel', 'travel_home')`);
  db.run(`UPDATE menus SET visible = 0 WHERE key = 'travel_home'`);

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

  db.run(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, role_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS role_data_permissions (
      role_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (role_id, code),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    )
  `);

  seedRoleDataPerms(db, 'photography_admin', [
    'photos.read.all', 'photos.write.all', 'photos.review', 'admin.all', 'review.all', 'calendar.all',
  ]);
  seedRoleDataPerms(db, 'system_admin', [
    'users.manage', 'roles.manage', 'menus.manage', 'users.all', 'roles.all', 'menus.all',
  ]);
  seedRoleDataPerms(db, 'travel_admin', [
    'trips.read.all', 'trips.write.all', 'budgets.read.all', 'budgets.write.all',
    'travel_trips.all', 'travel_budget.all', 'travel_shopping.all',
  ]);
  seedRoleDataPerms(db, 'reviewer', ['photos.read.all', 'photos.review', 'review.all']);
  seedRoleDataPerms(db, 'creator', [
    'photos.read.own', 'photos.write.own',
    'calendar.own',
    'trips.read.own', 'trips.write.own', 'budgets.read.own', 'budgets.write.own',
    'travel_trips.own', 'travel_budget.own', 'travel_shopping.own',
  ]);

  db.run(`UPDATE dictionaries SET status = 0 WHERE type = 'role' AND value = 'module_admin'`);
  db.run(`UPDATE users SET role = 'photography_admin' WHERE role = 'module_admin'`);

  db.run(`UPDATE users SET role_id = (SELECT id FROM roles WHERE roles.name = users.role) WHERE role_id IS NULL`);
  db.run(`UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'photography_admin') WHERE role = 'photography_admin'`);
  db.run(`UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'admin') WHERE username = 'admin'`);

  db.run(`
    INSERT OR IGNORE INTO user_roles (user_id, role_id)
    SELECT id, role_id FROM users WHERE role_id IS NOT NULL
  `);

  const travelDicts = [
    ['trip_status', 'planning', '筹划中', 'default', null, 1],
    ['trip_status', 'upcoming', '待出发', 'blue', null, 2],
    ['trip_status', 'ongoing', '进行中', 'orange', null, 3],
    ['trip_status', 'completed', '已结束', 'green', null, 4],
    ['trip_status', 'cancelled', '已取消', 'red', null, 5],
    ['budget_item_status', 'booked', '已订', 'green', null, 1],
    ['budget_item_status', 'pending', '待购', 'orange', null, 2],
    ['budget_item_status', 'estimated', '估算', 'default', null, 3],
    ['expense_category', 'flight', '机票', 'blue', null, 1],
    ['expense_category', 'lodging', '住宿', 'purple', null, 2],
    ['expense_category', 'transport', '交通', 'cyan', null, 3],
    ['expense_category', 'tickets', '门票', 'orange', null, 4],
    ['expense_category', 'attraction', '景点', 'gold', null, 5],
    ['expense_category', 'experience', '体验', 'magenta', null, 6],
    ['expense_category', 'food', '餐饮', 'volcano', null, 7],
    ['expense_category', 'shopping', '购物', 'geekblue', null, 8],
    ['expense_category', 'misc', '杂费', 'default', null, 9],
    ['trip_visibility', 'private', '私密', 'default', null, 1],
    ['trip_visibility', 'public', '公开', 'green', null, 2],
    ['currency', 'CNY', '人民币', null, null, 1],
    ['currency', 'JPY', '日元', null, null, 2],
    ['currency', 'USD', '美元', null, null, 3],
    ['currency', 'EUR', '欧元', null, null, 4],
    ['currency', 'KRW', '韩元', null, null, 5],
    ['currency', 'HKD', '港币', null, null, 6],
    ['currency', 'THB', '泰铢', null, null, 7],
  ];
  for (const [type, value, label, color, level, sort_order] of travelDicts) {
    db.run(`INSERT OR IGNORE INTO dictionaries (type, value, label, color, level, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      [type, value, label, color, level, sort_order]);
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      destination TEXT,
      start_date TEXT,
      end_date TEXT,
      status TEXT DEFAULT 'planning',
      summary TEXT,
      party_size INTEGER DEFAULT 1,
      base_currency TEXT DEFAULT 'CNY',
      trip_currency TEXT DEFAULT 'CNY',
      fx_rate REAL DEFAULT 1,
      fx_date TEXT,
      visibility TEXT DEFAULT 'private',
      cover_url TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS trip_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      day_index INTEGER NOT NULL,
      date TEXT,
      title TEXT,
      lodging TEXT,
      notes TEXT,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS trip_budget_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      category TEXT,
      title TEXT NOT NULL,
      qty REAL DEFAULT 1,
      unit_amount INTEGER DEFAULT 0,
      amount INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      optional INTEGER DEFAULT 0,
      note TEXT,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS trip_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      budget_item_id INTEGER,
      category TEXT,
      title TEXT,
      amount INTEGER DEFAULT 0,
      spent_on TEXT,
      note TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (budget_item_id) REFERENCES trip_budget_items(id) ON DELETE SET NULL
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_trip_days_trip_id ON trip_days(trip_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_trip_budget_items_trip_id ON trip_budget_items(trip_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_trip_expenses_trip_id ON trip_expenses(trip_id)');

  db.run(`
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      trip_id INTEGER,
      party_size INTEGER DEFAULT 1,
      base_currency TEXT DEFAULT 'CNY',
      trip_currency TEXT DEFAULT 'CNY',
      fx_rate REAL DEFAULT 1,
      fx_date TEXT,
      note TEXT,
      is_main INTEGER DEFAULT 0,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS budget_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      budget_id INTEGER NOT NULL,
      category TEXT,
      title TEXT NOT NULL,
      qty REAL DEFAULT 1,
      unit_amount INTEGER DEFAULT 0,
      amount INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      optional INTEGER DEFAULT 0,
      note TEXT,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS budget_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      budget_id INTEGER NOT NULL,
      budget_item_id INTEGER,
      category TEXT,
      title TEXT,
      amount INTEGER DEFAULT 0,
      spent_on TEXT,
      note TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
      FOREIGN KEY (budget_item_id) REFERENCES budget_items(id) ON DELETE SET NULL
    )
  `);

  try {
    db.run('ALTER TABLE budgets ADD COLUMN is_main INTEGER DEFAULT 0');
  } catch (e) {}

  const mainRows = sqlAll(db, 'SELECT id FROM budgets WHERE IFNULL(is_main, 0) = 1 ORDER BY id ASC');
  if (mainRows.length > 1) {
    db.run('UPDATE budgets SET is_main = 0 WHERE id != ?', [mainRows[0].id]);
  } else if (mainRows.length === 0) {
    const firstBudget = sqlOne(db, 'SELECT id FROM budgets ORDER BY id ASC');
    if (firstBudget) db.run('UPDATE budgets SET is_main = 1 WHERE id = ?', [firstBudget.id]);
  }

  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_trip_id ON budgets(trip_id) WHERE trip_id IS NOT NULL');
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_is_main ON budgets(is_main) WHERE is_main = 1');
  db.run('CREATE INDEX IF NOT EXISTS idx_budget_items_budget_id ON budget_items(budget_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_budget_expenses_budget_id ON budget_expenses(budget_id)');

  addColumnIfMissing(db, 'budget_items', 'quote_in', "TEXT DEFAULT 'trip'");
  addColumnIfMissing(db, 'budget_items', 'amount_base', 'INTEGER');
  addColumnIfMissing(db, 'budget_items', 'unit_amount_base', 'INTEGER');
  addColumnIfMissing(db, 'budget_expenses', 'amount_base', 'INTEGER');
  backfillBudgetBaseAmounts(db);

  db.run(`
    CREATE TABLE IF NOT EXISTS shopping_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      trip_currency TEXT DEFAULT 'CNY',
      base_currency TEXT DEFAULT 'CNY',
      fx_rate REAL DEFAULT 1,
      fx_date TEXT,
      note TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS shopping_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      place TEXT,
      quote_in TEXT DEFAULT 'trip',
      amount INTEGER DEFAULT 0,
      amount_base INTEGER DEFAULT 0,
      budget_item_id INTEGER,
      bought INTEGER DEFAULT 0,
      applied_amount INTEGER DEFAULT 0,
      applied_amount_base INTEGER DEFAULT 0,
      note TEXT,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE,
      FOREIGN KEY (budget_item_id) REFERENCES budget_items(id) ON DELETE SET NULL
    )
  `);
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_shopping_lists_trip_id ON shopping_lists(trip_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_shopping_items_list_id ON shopping_items(list_id)');

  migrateLegacyTripBudgets(db);

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

function sqlAll(database, sql, params = []) {
  const stmt = database.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function sqlOne(database, sql, params = []) {
  return sqlAll(database, sql, params)[0] || null;
}

function tableExists(database, name) {
  return !!sqlOne(
    database,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    [name]
  );
}

function addColumnIfMissing(database, table, column, ddl) {
  try {
    database.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  } catch (e) {}
}

function backfillBudgetBaseAmounts(database) {
  if (!tableExists(database, 'budgets')) return;
  const { toBaseMinor } = require('./lib/tripMoney.cjs');
  const budgets = sqlAll(database, 'SELECT id, trip_currency, base_currency, fx_rate FROM budgets');
  for (const budget of budgets) {
    const items = sqlAll(
      database,
      'SELECT id, amount, unit_amount, amount_base FROM budget_items WHERE budget_id = ?',
      [budget.id]
    );
    for (const item of items) {
      if (item.amount_base != null) continue;
      const amountBase = toBaseMinor(item.amount || 0, budget.trip_currency, budget.base_currency, budget.fx_rate);
      const unitBase = toBaseMinor(item.unit_amount || 0, budget.trip_currency, budget.base_currency, budget.fx_rate);
      database.run(
        'UPDATE budget_items SET amount_base = ?, unit_amount_base = COALESCE(unit_amount_base, ?) WHERE id = ?',
        [amountBase, unitBase, item.id]
      );
    }
    const expenses = sqlAll(
      database,
      'SELECT id, amount, amount_base FROM budget_expenses WHERE budget_id = ?',
      [budget.id]
    );
    for (const expense of expenses) {
      if (expense.amount_base != null) continue;
      const amountBase = toBaseMinor(expense.amount || 0, budget.trip_currency, budget.base_currency, budget.fx_rate);
      database.run('UPDATE budget_expenses SET amount_base = ? WHERE id = ?', [amountBase, expense.id]);
    }
  }
}

function migrateLegacyTripBudgets(database) {
  if (!tableExists(database, 'trip_budget_items') || !tableExists(database, 'budgets')) return;

  const trips = sqlAll(database, 'SELECT * FROM trips');
  for (const trip of trips) {
    const linked = sqlOne(database, 'SELECT id FROM budgets WHERE trip_id = ?', [trip.id]);
    if (linked) continue;

    const items = tableExists(database, 'trip_budget_items')
      ? sqlAll(database, 'SELECT * FROM trip_budget_items WHERE trip_id = ? ORDER BY sort_order ASC, id ASC', [trip.id])
      : [];
    const expenses = tableExists(database, 'trip_expenses')
      ? sqlAll(database, 'SELECT * FROM trip_expenses WHERE trip_id = ? ORDER BY id ASC', [trip.id])
      : [];
    if (!items.length && !expenses.length) continue;

    database.run(
      `INSERT INTO budgets (
        title, trip_id, party_size, base_currency, trip_currency, fx_rate, fx_date, note, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trip.title,
        trip.id,
        Number(trip.party_size) || 1,
        trip.base_currency || 'CNY',
        trip.trip_currency || 'CNY',
        trip.fx_rate == null ? 1 : trip.fx_rate,
        trip.fx_date || null,
        '',
        trip.created_by || null,
      ]
    );
    const budgetId = sqlOne(database, 'SELECT last_insert_rowid() as id').id;
    const itemIdMap = {};

    for (const item of items) {
      database.run(
        `INSERT INTO budget_items (
          budget_id, category, title, qty, unit_amount, amount, status, optional, note, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          budgetId,
          item.category || 'misc',
          item.title,
          item.qty == null ? 1 : item.qty,
          item.unit_amount || 0,
          item.amount || 0,
          item.status || 'pending',
          item.optional ? 1 : 0,
          item.note || '',
          item.sort_order || 0,
        ]
      );
      itemIdMap[item.id] = sqlOne(database, 'SELECT last_insert_rowid() as id').id;
    }

    for (const expense of expenses) {
      const mappedItemId = expense.budget_item_id ? (itemIdMap[expense.budget_item_id] || null) : null;
      database.run(
        `INSERT INTO budget_expenses (
          budget_id, budget_item_id, category, title, amount, spent_on, note, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          budgetId,
          mappedItemId,
          expense.category || '',
          expense.title || '',
          expense.amount || 0,
          expense.spent_on || null,
          expense.note || '',
          expense.created_by || null,
          expense.created_at || null,
          expense.updated_at || null,
        ]
      );
    }
  }
}

module.exports = { initDb, getDb, saveDb, flushDb, closeDb };
