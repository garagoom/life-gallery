const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb, saveDb } = require('../db.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');
const { requireMenu } = require('../middleware/permission.cjs');
const { revokeUserSessions } = require('../lib/session.cjs');
const { unwrapPassword } = require('../lib/passwordCrypto.cjs');
const { roleIdByName, setUserRoles, assertAssignableRoles, isDefaultAdminUsername } = require('../lib/userRoles.cjs');

const router = express.Router();

router.use(authMiddleware, requireMenu('users'));

const DEFAULT_AVATARS = {
  male: '/images/avatars/male.svg',
  female: '/images/avatars/female.svg',
};

function normalizeRoles(body, fallbackRole) {
  const fromArray = Array.isArray(body.roles) ? body.roles.filter(Boolean) : [];
  if (fromArray.length > 0) return [...new Set(fromArray)];
  if (body.role) return [body.role];
  if (fallbackRole) return [fallbackRole];
  return [];
}

function loadUserRoleMap(db, userIds) {
  const map = new Map(userIds.map((id) => [id, []]));
  if (userIds.length === 0) return map;
  const placeholders = userIds.map(() => '?').join(',');
  const stmt = db.prepare(`
    SELECT ur.user_id, r.name
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id IN (${placeholders})
    ORDER BY r.level DESC, r.id ASC
  `);
  stmt.bind(userIds);
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const list = map.get(row.user_id) || [];
    list.push(row.name);
    map.set(row.user_id, list);
  }
  stmt.free();
  return map;
}

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;

    const countResult = db.exec('SELECT COUNT(*) as count FROM users');
    const total = countResult[0] ? countResult[0].values[0][0] : 0;

    const stmt = db.prepare('SELECT id, username, display_name, email, avatar, gender, bio, role, status, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?');
    stmt.bind([pageSize, offset]);

    const users = [];
    while (stmt.step()) {
      users.push(stmt.getAsObject());
    }
    stmt.free();

    const roleMap = loadUserRoleMap(db, users.map((u) => u.id));
    const data = users.map((user) => ({
      ...user,
      roles: roleMap.get(user.id)?.length ? roleMap.get(user.id) : (user.role ? [user.role] : []),
    }));

    res.json({
      code: 200,
      message: 'success',
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ code: 500, message: '获取用户列表失败', data: null });
  }
});

router.post('/', (req, res) => {
  try {
    const { username, displayName, email, gender, bio } = req.body;
    const roles = normalizeRoles(req.body);
    let password;
    try {
      password = unwrapPassword(req.body.password);
    } catch (err) {
      return res.status(400).json({ code: 400, message: err.message, data: null });
    }

    if (!username || !password) {
      return res.status(400).json({ code: 400, message: '用户名和密码不能为空', data: null });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ code: 400, message: '用户名长度需在3-20个字符之间', data: null });
    }

    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      return res.status(400).json({ code: 400, message: '用户名只允许英文和数字', data: null });
    }

    if (password.length < 8 || password.length > 20) {
      return res.status(400).json({ code: 400, message: '密码长度需在8-20个字符之间', data: null });
    }

    assertAssignableRoles(roles);

    const db = getDb();

    const checkStmt = db.prepare('SELECT COUNT(*) as count FROM users WHERE username = ?');
    checkStmt.bind([username]);
    checkStmt.step();
    const exists = checkStmt.getAsObject().count > 0;
    checkStmt.free();

    if (exists) {
      return res.status(400).json({ code: 400, message: '用户名已存在', data: null });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const avatar = DEFAULT_AVATARS[gender] || DEFAULT_AVATARS.male;
    const primary = roleIdByName(db, roles[0]);
    db.run(
      'INSERT INTO users (username, password, display_name, email, role, role_id, gender, bio, avatar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, displayName || username, email || null, primary?.name || roles[0], primary?.id || null, gender || null, bio || null, avatar]
    );
    const idStmt = db.prepare('SELECT last_insert_rowid() as id');
    idStmt.step();
    const userId = idStmt.getAsObject().id;
    idStmt.free();
    setUserRoles(db, userId, roles);
    saveDb();

    res.status(201).json({ code: 201, message: '创建成功', data: null });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ code: error.statusCode, message: error.message, data: null });
    }
    console.error('Create user error:', error);
    res.status(500).json({ code: 500, message: '创建用户失败', data: null });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { displayName, email, gender, bio } = req.body;
    const userId = parseInt(req.params.id);

    const db = getDb();

    const checkStmt = db.prepare('SELECT * FROM users WHERE id = ?');
    checkStmt.bind([userId]);
    if (!checkStmt.step()) {
      checkStmt.free();
      return res.status(404).json({ code: 404, message: '用户不存在', data: null });
    }
    const existing = checkStmt.getAsObject();
    checkStmt.free();

    const existingRolesStmt = db.prepare(`
      SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ?
    `);
    existingRolesStmt.bind([userId]);
    const existingRoles = [];
    while (existingRolesStmt.step()) {
      existingRoles.push(existingRolesStmt.getAsObject().name);
    }
    existingRolesStmt.free();
    if (existingRoles.length === 0 && existing.role) existingRoles.push(existing.role);

    const nextRoles = isDefaultAdminUsername(existing.username)
      ? (existingRoles.includes('admin') ? existingRoles : ['admin', ...existingRoles])
      : normalizeRoles(req.body, existing.role);
    assertAssignableRoles(nextRoles, { username: existing.username });

    const sameRoles = nextRoles.length === existingRoles.length
      && nextRoles.every((role) => existingRoles.includes(role));

    if (userId === req.user.id && !sameRoles) {
      return res.status(400).json({ code: 400, message: '不能修改自己的角色', data: null });
    }

    db.run(
      'UPDATE users SET display_name = ?, email = ?, gender = ?, bio = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [displayName || existing.display_name, email || existing.email, gender || existing.gender, bio !== undefined ? bio : existing.bio, userId]
    );
    if (!sameRoles) {
      setUserRoles(db, userId, nextRoles);
    }
    saveDb();

    if (!sameRoles) {
      revokeUserSessions(userId);
    }

    res.json({ code: 200, message: '更新成功', data: null });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ code: error.statusCode, message: error.message, data: null });
    }
    console.error('Update user error:', error);
    res.status(500).json({ code: 500, message: '更新用户失败', data: null });
  }
});

router.put('/:id/status', (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { status } = req.body;

    if (userId === req.user.id) {
      return res.status(400).json({ code: 400, message: '不能禁用自己的账号', data: null });
    }

    const db = getDb();
    const userStmt = db.prepare('SELECT username FROM users WHERE id = ?');
    userStmt.bind([userId]);
    const target = userStmt.step() ? userStmt.getAsObject() : null;
    userStmt.free();
    if (!target) {
      return res.status(404).json({ code: 404, message: '用户不存在', data: null });
    }
    if (isDefaultAdminUsername(target.username)) {
      return res.status(400).json({ code: 400, message: '不能禁用默认超级管理员', data: null });
    }
    db.run('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, userId]);
    saveDb();

    if (status === 0) {
      revokeUserSessions(userId);
    }

    res.json({ code: 200, message: status === 1 ? '已启用' : '已禁用', data: null });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ code: 500, message: '操作失败', data: null });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (userId === req.user.id) {
      return res.status(400).json({ code: 400, message: '不能删除自己的账号', data: null });
    }

    const db = getDb();
    const userStmt = db.prepare('SELECT username FROM users WHERE id = ?');
    userStmt.bind([userId]);
    const target = userStmt.step() ? userStmt.getAsObject() : null;
    userStmt.free();
    if (!target) {
      return res.status(404).json({ code: 404, message: '用户不存在', data: null });
    }
    if (isDefaultAdminUsername(target.username)) {
      return res.status(400).json({ code: 400, message: '不能删除默认超级管理员', data: null });
    }

    revokeUserSessions(userId);
    db.run('DELETE FROM user_roles WHERE user_id = ?', [userId]);
    db.run('DELETE FROM users WHERE id = ?', [userId]);
    saveDb();

    res.json({ code: 200, message: '删除成功', data: null });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ code: 500, message: '删除用户失败', data: null });
  }
});

module.exports = router;
