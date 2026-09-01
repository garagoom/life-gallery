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
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.run(
      'INSERT INTO users (username, password, display_name, role) VALUES (?, ?, ?, ?)',
      ['admin', hashedPassword, '管理员', 'admin']
    );
    console.log('Default admin user created: admin / admin123');
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
