const express = require('express');
const router = express.Router();
const { getDb, saveDb } = require('../db.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');
const { requireMenu, DATA_PERM_CODES } = require('../middleware/permission.cjs');
const { countUsersWithRole } = require('../lib/userRoles.cjs');

function sanitizeDataPermissions(codes) {
  if (!Array.isArray(codes)) return [];
  return [...new Set(codes.filter((code) => DATA_PERM_CODES.includes(code)))];
}

function loadDataPermissions(db, roleId) {
  const stmt = db.prepare('SELECT code FROM role_data_permissions WHERE role_id = ?');
  stmt.bind([roleId]);
  const codes = [];
  while (stmt.step()) {
    codes.push(stmt.getAsObject().code);
  }
  stmt.free();
  return codes;
}

function replaceDataPermissions(db, roleId, codes) {
  db.run('DELETE FROM role_data_permissions WHERE role_id = ?', [roleId]);
  for (const code of codes) {
    db.run('INSERT OR IGNORE INTO role_data_permissions (role_id, code) VALUES (?, ?)', [roleId, code]);
  }
}

router.get('/', authMiddleware, requireMenu('roles'), (req, res) => {
  try {
    const db = getDb();
    const roles = db.exec(`
      SELECT r.*
      FROM roles r
      ORDER BY r.level DESC
    `)[0];

    const list = roles ? roles.values.map(row => ({
      id: row[0],
      name: row[1],
      label: row[2],
      level: row[3],
      status: row[4],
      created_at: row[5],
      updated_at: row[6],
      user_count: countUsersWithRole(db, row[0]),
    })) : [];

    res.json({ code: 200, message: 'success', data: list });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

router.get('/:id', authMiddleware, requireMenu('roles'), (req, res) => {
  try {
    const db = getDb();
    const role = db.exec(`SELECT * FROM roles WHERE id = ?`, [req.params.id])[0];
    if (!role || role.values.length === 0) {
      return res.status(404).json({ code: 404, message: '角色不存在' });
    }

    const permissions = db.exec(`
      SELECT m.id, m.key, m.label, m.path FROM role_permissions rp
      JOIN menus m ON rp.menu_id = m.id
      WHERE rp.role_id = ?
    `, [req.params.id])[0];

    const row = role.values[0];
    res.json({
      code: 200,
      message: 'success',
      data: {
        id: row[0],
        name: row[1],
        label: row[2],
        level: row[3],
        status: row[4],
        created_at: row[5],
        updated_at: row[6],
        permissions: permissions ? permissions.values.map(p => ({
          id: p[0], key: p[1], label: p[2], path: p[3]
        })) : [],
        dataPermissions: loadDataPermissions(db, parseInt(req.params.id, 10)),
      }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

router.post('/', authMiddleware, requireMenu('roles'), (req, res) => {
  try {
    const { name, label, level, permissions, dataPermissions } = req.body;
    if (!name || !label) {
      return res.status(400).json({ code: 400, message: '角色名和标签不能为空' });
    }

    const db = getDb();

    const existing = db.exec(`SELECT id FROM roles WHERE name = ?`, [name])[0];
    if (existing && existing.values.length > 0) {
      return res.status(400).json({ code: 400, message: '角色名已存在' });
    }

    db.run(`INSERT INTO roles (name, label, level) VALUES (?, ?, ?)`,
      [name, label, level || 1]);

    const roleResult = db.exec(`SELECT last_insert_rowid()`)[0];
    const roleId = roleResult.values[0][0];

    if (permissions && permissions.length > 0) {
      const stmt = db.prepare(`INSERT INTO role_permissions (role_id, menu_id) VALUES (?, ?)`);
      permissions.forEach(menuId => {
        stmt.run([roleId, menuId]);
      });
      stmt.free();
    }

    replaceDataPermissions(db, roleId, sanitizeDataPermissions(dataPermissions));

    saveDb();
    res.json({ code: 200, message: '角色创建成功', data: { id: roleId } });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

router.put('/:id', authMiddleware, requireMenu('roles'), (req, res) => {
  try {
    const { name, label, level, status, permissions, dataPermissions } = req.body;
    const db = getDb();

    const role = db.exec(`SELECT name FROM roles WHERE id = ?`, [req.params.id])[0];
    if (role && role.values[0][0] === 'admin') {
      if (name !== 'admin' || level !== 4) {
        return res.status(400).json({ code: 400, message: '不能修改超级管理员角色' });
      }
    }

    if (name) {
      const existing = db.exec(`SELECT id FROM roles WHERE name = ? AND id != ?`,
        [name, req.params.id])[0];
      if (existing && existing.values.length > 0) {
        return res.status(400).json({ code: 400, message: '角色名已存在' });
      }
    }

    db.run(`UPDATE roles SET name = ?, label = ?, level = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [name, label, level, status, req.params.id]);

    if (permissions !== undefined) {
      db.run(`DELETE FROM role_permissions WHERE role_id = ?`, [req.params.id]);
      if (permissions.length > 0) {
        const stmt = db.prepare(`INSERT INTO role_permissions (role_id, menu_id) VALUES (?, ?)`);
        permissions.forEach(menuId => {
          stmt.run([parseInt(req.params.id), menuId]);
        });
        stmt.free();
      }
    }

    if (dataPermissions !== undefined) {
      replaceDataPermissions(db, parseInt(req.params.id, 10), sanitizeDataPermissions(dataPermissions));
    }

    saveDb();
    res.json({ code: 200, message: '角色更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

router.delete('/:id', authMiddleware, requireMenu('roles'), (req, res) => {
  try {
    const db = getDb();

    const role = db.exec(`SELECT name FROM roles WHERE id = ?`, [req.params.id])[0];
    if (role && role.values[0][0] === 'admin') {
      return res.status(400).json({ code: 400, message: '不能删除超级管理员角色' });
    }

    const users = countUsersWithRole(db, parseInt(req.params.id, 10));
    if (users > 0) {
      return res.status(400).json({ code: 400, message: '该角色下有用户，无法删除' });
    }

    db.run(`DELETE FROM role_data_permissions WHERE role_id = ?`, [req.params.id]);
    db.run(`DELETE FROM role_permissions WHERE role_id = ?`, [req.params.id]);
    db.run(`DELETE FROM roles WHERE id = ?`, [req.params.id]);

    saveDb();
    res.json({ code: 200, message: '角色删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = router;
