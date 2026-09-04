const { describe, it, expect, beforeAll, afterAll } = require('vitest');

process.env.JWT_SECRET = 'test-jwt-secret';
process.env.REFRESH_SECRET = 'test-refresh-secret';
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';

const { initDb, getDb, saveDb, closeDb } = require('../db.cjs');

beforeAll(async () => {
  await initDb();
});

afterAll(() => {
  closeDb();
});

describe('Database', () => {
  it('should initialize successfully', () => {
    const db = getDb();
    expect(db).toBeDefined();
  });

  it('should have photos table', () => {
    const db = getDb();
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='photos'");
    expect(stmt.step()).toBe(true);
    stmt.free();
  });

  it('should have users table', () => {
    const db = getDb();
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
    expect(stmt.step()).toBe(true);
    stmt.free();
  });

  it('should have roles table', () => {
    const db = getDb();
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='roles'");
    expect(stmt.step()).toBe(true);
    stmt.free();
  });

  it('should have default admin user', () => {
    const db = getDb();
    const stmt = db.prepare("SELECT * FROM users WHERE username = 'admin'");
    expect(stmt.step()).toBe(true);
    const user = stmt.getAsObject();
    expect(user.username).toBe('admin');
    expect(user.role).toBe('admin');
    stmt.free();
  });

  it('should have default roles', () => {
    const db = getDb();
    const stmt = db.prepare("SELECT COUNT(*) as count FROM roles");
    stmt.step();
    const result = stmt.getAsObject();
    expect(result.count).toBeGreaterThanOrEqual(3);
    stmt.free();
  });

  it('should insert and retrieve a photo', () => {
    const db = getDb();
    db.run(
      `INSERT INTO photos (title, filename, thumbnail, date) VALUES (?, ?, ?, ?)`,
      ['Test Photo', 'test.webp', 'thumb-test.webp', '2024-01-15']
    );
    saveDb();

    const stmt = db.prepare("SELECT * FROM photos WHERE title = 'Test Photo'");
    expect(stmt.step()).toBe(true);
    const photo = stmt.getAsObject();
    expect(photo.filename).toBe('test.webp');
    expect(photo.thumbnail).toBe('thumb-test.webp');
    stmt.free();

    db.run("DELETE FROM photos WHERE title = 'Test Photo'");
    saveDb();
  });

  it('should insert a user with hashed password', () => {
    const bcrypt = require('bcryptjs');
    const db = getDb();
    const hash = bcrypt.hashSync('testpass123', 10);

    db.run(
      `INSERT INTO users (username, password, display_name, role) VALUES (?, ?, ?, ?)`,
      ['testuser', hash, 'Test User', 'viewer']
    );
    saveDb();

    const stmt = db.prepare("SELECT * FROM users WHERE username = 'testuser'");
    expect(stmt.step()).toBe(true);
    const user = stmt.getAsObject();
    expect(user.display_name).toBe('Test User');
    expect(user.role).toBe('viewer');
    expect(bcrypt.compareSync('testpass123', user.password)).toBe(true);
    stmt.free();

    db.run("DELETE FROM users WHERE username = 'testuser'");
    saveDb();
  });

  it('should enforce unique username constraint', () => {
    const bcrypt = require('bcryptjs');
    const db = getDb();
    const hash = bcrypt.hashSync('pass123', 10);

    db.run(
      `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
      ['unique_test', hash, 'viewer']
    );

    expect(() => {
      db.run(
        `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
        ['unique_test', hash, 'viewer']
      );
    }).toThrow();

    db.run("DELETE FROM users WHERE username = 'unique_test'");
    saveDb();
  });
});
