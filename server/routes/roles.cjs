const express = require('express');
const router = express.Router();
const { getDb, saveDb } = require('../db.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');
const { requireMenu } = require('../middleware/permission.cjs');

// 获取所有角色
router.get('/', authMiddleware, requireMenu('roles'), (req, res) => {
  try {
    const db = getDb();
    const roles = db.exec(`
      SELECT r.*, 
        (SELECT COUNT(*) FROM users WHERE role_id = r.id) as user_count
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
      user_count: row[7]
    })) : [];

    res.json({ code: 200, message: 'success', data: list });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取单个角色及其权限
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
        })) : []
      }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 创建角色
router.post('/', authMiddleware, requireMenu('roles'), (req, res) => {
  try {
    const { name, label, level, permissions } = req.body;
    if (!name || !label) {
      return res.status(400).json({ code: 400, message: '角色名和标签不能为空' });
    }

    const db = getDb();
    
    // 检查角色名是否已存在
    const existing = db.exec(`SELECT id FROM roles WHERE name = ?`, [name])[0];
    if (existing && existing.values.length > 0) {
      return res.status(400).json({ code: 400, message: '角色名已存在' });
    }

    // 插入角色
    db.run(`INSERT INTO roles (name, label, level) VALUES (?, ?, ?)`, 
      [name, label, level || 1]);
    
    const roleResult = db.exec(`SELECT last_insert_rowid()`)[0];
    const roleId = roleResult.values[0][0];

    // 插入权限
    if (permissions && permissions.length > 0) {
      const stmt = db.prepare(`INSERT INTO role_permissions (role_id, menu_id) VALUES (?, ?)`);
      permissions.forEach(menuId => {
        stmt.run([roleId, menuId]);
      });
      stmt.free();
    }

    saveDb();
    res.json({ code: 200, message: '角色创建成功', data: { id: roleId } });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新角色
router.put('/:id', authMiddleware, requireMenu('roles'), (req, res) => {
  try {
    const { name, label, level, status, permissions } = req.body;
    const db = getDb();

    // 不能修改超级管理员角色
    const role = db.exec(`SELECT name FROM roles WHERE id = ?`, [req.params.id])[0];
    if (role && role.values[0][0] === 'admin') {
      if (name !== 'admin' || level !== 3) {
        return res.status(400).json({ code: 400, message: '不能修改超级管理员角色' });
      }
    }

    // 检查角色名唯一性
    if (name) {
      const existing = db.exec(`SELECT id FROM roles WHERE name = ? AND id != ?`, 
        [name, req.params.id])[0];
      if (existing && existing.values.length > 0) {
        return res.status(400).json({ code: 400, message: '角色名已存在' });
      }
    }

    // 更新角色
    db.run(`UPDATE roles SET name = ?, label = ?, level = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [name, label, level, status, req.params.id]);

    // 更新权限（先删后插）
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

    saveDb();
    res.json({ code: 200, message: '角色更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除角色
router.delete('/:id', authMiddleware, requireMenu('roles'), (req, res) => {
  try {
    const db = getDb();

    // 不能删除 admin 角色
    const role = db.exec(`SELECT name FROM roles WHERE id = ?`, [req.params.id])[0];
    if (role && role.values[0][0] === 'admin') {
      return res.status(400).json({ code: 400, message: '不能删除超级管理员角色' });
    }

    // 检查是否有用户使用此角色
    const users = db.exec(`SELECT COUNT(*) FROM users WHERE role_id = ?`, [req.params.id])[0];
    if (users && users.values[0][0] > 0) {
      return res.status(400).json({ code: 400, message: '该角色下有用户，无法删除' });
    }

    db.run(`DELETE FROM role_permissions WHERE role_id = ?`, [req.params.id]);
    db.run(`DELETE FROM roles WHERE id = ?`, [req.params.id]);

    saveDb();
    res.json({ code: 200, message: '角色删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = router;
