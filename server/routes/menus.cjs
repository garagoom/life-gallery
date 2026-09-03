const express = require('express');
const router = express.Router();
const { getDb, saveDb } = require('../db.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');
const { requireMenu } = require('../middleware/permission.cjs');

// 获取所有菜单（树形结构）
router.get('/', authMiddleware, requireMenu('menus'), (req, res) => {
  try {
    const db = getDb();
    const menus = db.exec(`SELECT * FROM menus ORDER BY sort_order ASC`)[0];
    
    const list = menus ? menus.values.map(row => ({
      id: row[0],
      parent_id: row[1],
      key: row[2],
      label: row[3],
      icon: row[4],
      path: row[5],
      type: row[6],
      visible: row[7],
      sort_order: row[8],
      status: row[9],
      created_at: row[10],
      updated_at: row[11]
    })) : [];

    // 构建树形结构
    const tree = [];
    const map = {};
    list.forEach(item => {
      map[item.id] = { ...item, children: [] };
    });
    list.forEach(item => {
      if (item.parent_id && map[item.parent_id]) {
        map[item.parent_id].children.push(map[item.id]);
      } else {
        tree.push(map[item.id]);
      }
    });

    res.json({ code: 200, message: 'success', data: tree });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取所有菜单（平铺，用于权限选择）
router.get('/flat', authMiddleware, requireMenu('menus'), (req, res) => {
  try {
    const db = getDb();
    const menus = db.exec(`SELECT * FROM menus ORDER BY sort_order ASC`)[0];
    
    const list = menus ? menus.values.map(row => ({
      id: row[0],
      parent_id: row[1],
      key: row[2],
      label: row[3],
      icon: row[4],
      path: row[5],
      type: row[6],
      visible: row[7],
      sort_order: row[8],
      status: row[9]
    })) : [];

    res.json({ code: 200, message: 'success', data: list });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取用户可见菜单（根据角色权限）
router.get('/my', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const menus = db.exec(`
      SELECT DISTINCT m.id, m.parent_id, m.key, m.label, m.icon, m.path, m.type, m.visible, m.sort_order
      FROM menus m
      JOIN role_permissions rp ON m.id = rp.menu_id
      JOIN users u ON rp.role_id = u.role_id
      WHERE u.id = ? AND m.status = 1 AND m.visible = 1
      ORDER BY m.sort_order ASC
    `, [req.user.id])[0];
    
    const list = menus ? menus.values.map(row => ({
      id: row[0],
      parent_id: row[1],
      key: row[2],
      label: row[3],
      icon: row[4],
      path: row[5],
      type: row[6],
      visible: row[7],
      sort_order: row[8]
    })) : [];

    // 构建树形结构
    const tree = [];
    const map = {};
    list.forEach(item => {
      map[item.id] = { ...item, children: [] };
    });
    list.forEach(item => {
      if (item.parent_id && map[item.parent_id]) {
        map[item.parent_id].children.push(map[item.id]);
      } else {
        tree.push(map[item.id]);
      }
    });

    res.json({ code: 200, message: 'success', data: tree });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 创建菜单
router.post('/', authMiddleware, requireMenu('menus'), (req, res) => {
  try {
    const { parent_id, key, label, icon, path, type, visible, sort_order } = req.body;
    if (!key || !label) {
      return res.status(400).json({ code: 400, message: '菜单 key 和 label 不能为空' });
    }

    const db = getDb();
    
    // 检查 key 是否已存在
    const existing = db.exec(`SELECT id FROM menus WHERE key = ?`, [key])[0];
    if (existing && existing.values.length > 0) {
      return res.status(400).json({ code: 400, message: '菜单 key 已存在' });
    }

    db.run(`INSERT INTO menus (parent_id, key, label, icon, path, type, visible, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [parent_id || null, key, label, icon || null, path || null, type || 'menu', visible !== undefined ? visible : 1, sort_order || 0]);
    
    const result = db.exec(`SELECT last_insert_rowid()`)[0];
    const menuId = result.values[0][0];

    saveDb();
    res.json({ code: 200, message: '菜单创建成功', data: { id: menuId } });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新菜单
router.put('/:id', authMiddleware, requireMenu('menus'), (req, res) => {
  try {
    const { parent_id, key, label, icon, path, type, visible, sort_order, status } = req.body;
    const db = getDb();

    // 检查 key 唯一性
    if (key) {
      const existing = db.exec(`SELECT id FROM menus WHERE key = ? AND id != ?`, 
        [key, req.params.id])[0];
      if (existing && existing.values.length > 0) {
        return res.status(400).json({ code: 400, message: '菜单 key 已存在' });
      }
    }

    db.run(`UPDATE menus SET parent_id = ?, key = ?, label = ?, icon = ?, path = ?, type = ?, visible = ?, sort_order = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [parent_id || null, key, label, icon, path, type || 'menu', visible !== undefined ? visible : 1, sort_order, status, req.params.id]);

    saveDb();
    res.json({ code: 200, message: '菜单更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除菜单
router.delete('/:id', authMiddleware, requireMenu('menus'), (req, res) => {
  try {
    const db = getDb();

    // 检查是否有子菜单
    const children = db.exec(`SELECT COUNT(*) FROM menus WHERE parent_id = ?`, [req.params.id])[0];
    if (children && children.values[0][0] > 0) {
      return res.status(400).json({ code: 400, message: '该菜单下有子菜单，无法删除' });
    }

    db.run(`DELETE FROM role_permissions WHERE menu_id = ?`, [req.params.id]);
    db.run(`DELETE FROM menus WHERE id = ?`, [req.params.id]);

    saveDb();
    res.json({ code: 200, message: '菜单删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = router;
