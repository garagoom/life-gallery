# RBAC 权限管理系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现完整的 RBAC 权限管理系统，包含角色管理、菜单管理、动态路由和侧边栏

**Architecture:** 
- 后端：新增 roles、permissions、menus、role_permissions、menu_roles 表，替代 users.role 字符串字段
- 前端：FloatingMenu 根据用户权限动态渲染，ProtectedRoute 从服务端获取权限校验
- 权限粒度：菜单级（控制页面访问，不控制具体操作）

**Tech Stack:** Express + SQLite (sql.js) + React + Ant Design + JWT

---

## 文件结构

### 后端新增/修改
- `server/db.cjs` - 新增 5 张表，迁移 users.role 字段
- `server/middleware/permission.cjs` - 改为从数据库查询角色权限
- `server/routes/roles.cjs` - 角色 CRUD API（新建）
- `server/routes/menus.cjs` - 菜单 CRUD API（新建）
- `server/routes/permissions.cjs` - 权限查询 API（新建）
- `server/routes/auth.cjs` - 登录返回时附带权限列表
- `server/routes/users.cjs` - 创建/编辑用户时关联角色ID
- `server/index.cjs` - 注册新路由

### 前端新增/修改
- `src/api/roles.js` - 角色管理 API（新建）
- `src/api/menus.js` - 菜单管理 API（新建）
- `src/components/RoleManage.jsx` - 角色管理页面（新建）
- `src/components/RoleManage.module.css` - 角色管理样式（新建）
- `src/components/MenuManage.jsx` - 菜单管理页面（新建）
- `src/components/MenuManage.module.css` - 菜单管理样式（新建）
- `src/components/FloatingMenu.jsx` - 改为从 API 获取菜单动态渲染
- `src/components/ProtectedRoute.jsx` - 改为从 API 获取权限校验
- `src/components/UserManage.jsx` - 用户表单改为选择角色（下拉）
- `src/contexts/AuthContext.jsx` - 存储用户权限列表
- `src/App.jsx` - 路由配置更新

---

## Task 1: 数据库迁移 — 新增 RBAC 表

**Files:**
- Modify: `server/db.cjs`

- [ ] **Step 1: 在 db.cjs 中新增 5 张表**

在 `initDatabase()` 函数中，在创建 `users` 表之后添加：

```sql
-- 角色表
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  level INTEGER DEFAULT 0,
  status INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 权限/菜单表
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
);

-- 角色-权限关联表
CREATE TABLE IF NOT EXISTS role_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL,
  menu_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE,
  UNIQUE(role_id, menu_id)
);
```

- [ ] **Step 2: 插入默认角色数据**

在建表语句之后添加默认数据：

```sql
-- 默认角色
INSERT OR IGNORE INTO roles (name, label, level) VALUES 
  ('admin', '管理员', 3),
  ('editor', '编辑者', 2),
  ('viewer', '查看者', 1);
```

- [ ] **Step 3: 插入默认菜单数据**

```sql
-- 默认菜单（摄影模块）
INSERT OR IGNORE INTO menus (id, parent_id, key, label, icon, path, sort_order) VALUES
  (1, NULL, 'photography', '摄影', 'CameraOutlined', '/photography', 1),
  (2, 1, 'home', '首页', 'HomeOutlined', '/photography/home', 1),
  (3, 1, 'portfolio', '作品集', 'PictureOutlined', '/photography/portfolio', 2),
  (4, 1, 'admin', '照片管理', 'SettingOutlined', '/photography/admin', 3),
  (5, NULL, 'system', '系统管理', 'AppstoreOutlined', '/system', 10),
  (6, 5, 'users', '用户管理', 'TeamOutlined', '/photography/admin/users', 1),
  (7, 5, 'roles', '角色管理', 'SafetyOutlined', '/photography/admin/roles', 2),
  (8, 5, 'menus', '菜单管理', 'MenuOutlined', '/photography/admin/menus', 3);
```

- [ ] **Step 4: 为默认角色分配菜单权限**

```sql
-- admin 拥有所有菜单权限
INSERT OR IGNORE INTO role_permissions (role_id, menu_id)
SELECT r.id, m.id FROM roles r, menus m WHERE r.name = 'admin';

-- editor 拥有摄影模块权限（不含系统管理）
INSERT OR IGNORE INTO role_permissions (role_id, menu_id)
SELECT r.id, m.id FROM roles r, menus m 
WHERE r.name = 'editor' AND m.id IN (1, 2, 3, 4);

-- viewer 只有首页和作品集
INSERT OR IGNORE INTO role_permissions (role_id, menu_id)
SELECT r.id, m.id FROM roles r, menus m 
WHERE r.name = 'viewer' AND m.id IN (1, 2, 3);
```

- [ ] **Step 5: 修改 users 表添加 role_id 字段**

```sql
-- 添加 role_id 字段（如果不存在）
-- SQLite 不支持 ALTER TABLE ADD COLUMN IF NOT EXISTS，需要检查
```

在 db.cjs 中添加迁移逻辑：

```javascript
// 迁移：添加 role_id 字段
try {
  db.exec(`ALTER TABLE users ADD COLUMN role_id INTEGER`);
} catch (e) {
  // 字段已存在，忽略错误
}

// 迁移：将旧 role 字符串映射到 role_id
db.exec(`
  UPDATE users SET role_id = (
    SELECT id FROM roles WHERE roles.name = users.role
  ) WHERE role_id IS NULL
`);
```

- [ ] **Step 6: 更新默认管理员的 role_id**

```javascript
// 确保默认管理员有正确的 role_id
db.exec(`
  UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'admin') 
  WHERE username = 'admin' AND role_id IS NULL
`);
```

- [ ] **Step 7: 运行测试验证数据库结构**

```bash
node -e "const db = require('./server/db.cjs'); const database = db.getDatabase(); console.log(database.exec('SELECT name FROM sqlite_master WHERE type=\"table\"')[0]);"
```

- [ ] **Step 8: Commit**

```bash
git add server/db.cjs
git commit -m "feat(db): 添加 RBAC 数据库表结构"
```

---

## Task 2: 后端 — 角色管理 API

**Files:**
- Create: `server/routes/roles.cjs`
- Modify: `server/index.cjs`

- [ ] **Step 1: 创建 roles.cjs 路由文件**

```javascript
const express = require('express');
const router = express.Router();
const { getDatabase } = require('../db.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');
const { requireAdmin } = require('../middleware/permission.cjs');

// 获取所有角色
router.get('/', authMiddleware, requireAdmin, (req, res) => {
  try {
    const db = getDatabase();
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
router.get('/:id', authMiddleware, requireAdmin, (req, res) => {
  try {
    const db = getDatabase();
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
router.post('/', authMiddleware, requireAdmin, (req, res) => {
  try {
    const { name, label, level, permissions } = req.body;
    if (!name || !label) {
      return res.status(400).json({ code: 400, message: '角色名和标签不能为空' });
    }

    const db = getDatabase();
    
    // 检查角色名是否已存在
    const existing = db.exec(`SELECT id FROM roles WHERE name = ?`, [name])[0];
    if (existing && existing.values.length > 0) {
      return res.status(400).json({ code: 400, message: '角色名已存在' });
    }

    // 插入角色
    db.exec(`INSERT INTO roles (name, label, level) VALUES (?, ?, ?)`, 
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

    res.json({ code: 200, message: '角色创建成功', data: { id: roleId } });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新角色
router.put('/:id', authMiddleware, requireAdmin, (req, res) => {
  try {
    const { name, label, level, status, permissions } = req.body;
    const db = getDatabase();

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
    db.exec(`UPDATE roles SET name = ?, label = ?, level = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [name, label, level, status, req.params.id]);

    // 更新权限（先删后插）
    if (permissions !== undefined) {
      db.exec(`DELETE FROM role_permissions WHERE role_id = ?`, [req.params.id]);
      if (permissions.length > 0) {
        const stmt = db.prepare(`INSERT INTO role_permissions (role_id, menu_id) VALUES (?, ?)`);
        permissions.forEach(menuId => {
          stmt.run([parseInt(req.params.id), menuId]);
        });
        stmt.free();
      }
    }

    res.json({ code: 200, message: '角色更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除角色
router.delete('/:id', authMiddleware, requireAdmin, (req, res) => {
  try {
    const db = getDatabase();

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

    db.exec(`DELETE FROM role_permissions WHERE role_id = ?`, [req.params.id]);
    db.exec(`DELETE FROM roles WHERE id = ?`, [req.params.id]);

    res.json({ code: 200, message: '角色删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: 在 index.cjs 中注册角色路由**

```javascript
const rolesRouter = require('./routes/roles.cjs');
app.use('/api/roles', rolesRouter);
```

- [ ] **Step 3: 测试 API**

```bash
# 启动服务器
node server/index.cjs

# 测试获取角色列表（需要先登录获取 token）
curl http://localhost:3001/api/roles -H "Authorization: Bearer <token>"
```

- [ ] **Step 4: Commit**

```bash
git add server/routes/roles.cjs server/index.cjs
git commit -m "feat(api): 添加角色管理 CRUD API"
```

---

## Task 3: 后端 — 菜单管理 API

**Files:**
- Create: `server/routes/menus.cjs`
- Modify: `server/index.cjs`

- [ ] **Step 1: 创建 menus.cjs 路由文件**

```javascript
const express = require('express');
const router = express.Router();
const { getDatabase } = require('../db.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');
const { requireAdmin } = require('../middleware/permission.cjs');

// 获取所有菜单（树形结构）
router.get('/', authMiddleware, requireAdmin, (req, res) => {
  try {
    const db = getDatabase();
    const menus = db.exec(`SELECT * FROM menus ORDER BY sort_order ASC`)[0];
    
    const list = menus ? menus.values.map(row => ({
      id: row[0],
      parent_id: row[1],
      key: row[2],
      label: row[3],
      icon: row[4],
      path: row[5],
      sort_order: row[6],
      status: row[7],
      created_at: row[8],
      updated_at: row[9]
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
router.get('/flat', authMiddleware, requireAdmin, (req, res) => {
  try {
    const db = getDatabase();
    const menus = db.exec(`SELECT * FROM menus ORDER BY sort_order ASC`)[0];
    
    const list = menus ? menus.values.map(row => ({
      id: row[0],
      parent_id: row[1],
      key: row[2],
      label: row[3],
      icon: row[4],
      path: row[5],
      sort_order: row[6],
      status: row[7]
    })) : [];

    res.json({ code: 200, message: 'success', data: list });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取用户可见菜单（根据角色权限）
router.get('/my', authMiddleware, (req, res) => {
  try {
    const db = getDatabase();
    const menus = db.exec(`
      SELECT DISTINCT m.id, m.parent_id, m.key, m.label, m.icon, m.path, m.sort_order
      FROM menus m
      JOIN role_permissions rp ON m.id = rp.menu_id
      JOIN users u ON rp.role_id = u.role_id
      WHERE u.id = ? AND m.status = 1
      ORDER BY m.sort_order ASC
    `, [req.user.id])[0];
    
    const list = menus ? menus.values.map(row => ({
      id: row[0],
      parent_id: row[1],
      key: row[2],
      label: row[3],
      icon: row[4],
      path: row[5],
      sort_order: row[6]
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
router.post('/', authMiddleware, requireAdmin, (req, res) => {
  try {
    const { parent_id, key, label, icon, path, sort_order } = req.body;
    if (!key || !label) {
      return res.status(400).json({ code: 400, message: '菜单 key 和 label 不能为空' });
    }

    const db = getDatabase();
    
    // 检查 key 是否已存在
    const existing = db.exec(`SELECT id FROM menus WHERE key = ?`, [key])[0];
    if (existing && existing.values.length > 0) {
      return res.status(400).json({ code: 400, message: '菜单 key 已存在' });
    }

    db.exec(`INSERT INTO menus (parent_id, key, label, icon, path, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      [parent_id || null, key, label, icon || null, path || null, sort_order || 0]);
    
    const result = db.exec(`SELECT last_insert_rowid()`)[0];
    const menuId = result.values[0][0];

    res.json({ code: 200, message: '菜单创建成功', data: { id: menuId } });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新菜单
router.put('/:id', authMiddleware, requireAdmin, (req, res) => {
  try {
    const { parent_id, key, label, icon, path, sort_order, status } = req.body;
    const db = getDatabase();

    // 检查 key 唯一性
    if (key) {
      const existing = db.exec(`SELECT id FROM menus WHERE key = ? AND id != ?`, 
        [key, req.params.id])[0];
      if (existing && existing.values.length > 0) {
        return res.status(400).json({ code: 400, message: '菜单 key 已存在' });
      }
    }

    db.exec(`UPDATE menus SET parent_id = ?, key = ?, label = ?, icon = ?, path = ?, sort_order = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [parent_id || null, key, label, icon, path, sort_order, status, req.params.id]);

    res.json({ code: 200, message: '菜单更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除菜单
router.delete('/:id', authMiddleware, requireAdmin, (req, res) => {
  try {
    const db = getDatabase();

    // 检查是否有子菜单
    const children = db.exec(`SELECT COUNT(*) FROM menus WHERE parent_id = ?`, [req.params.id])[0];
    if (children && children.values[0][0] > 0) {
      return res.status(400).json({ code: 400, message: '该菜单下有子菜单，无法删除' });
    }

    db.exec(`DELETE FROM role_permissions WHERE menu_id = ?`, [req.params.id]);
    db.exec(`DELETE FROM menus WHERE id = ?`, [req.params.id]);

    res.json({ code: 200, message: '菜单删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: 在 index.cjs 中注册菜单路由**

```javascript
const menusRouter = require('./routes/menus.cjs');
app.use('/api/menus', menusRouter);
```

- [ ] **Step 3: 测试 API**

```bash
curl http://localhost:3001/api/menus -H "Authorization: Bearer <token>"
curl http://localhost:3001/api/menus/my -H "Authorization: Bearer <token>"
```

- [ ] **Step 4: Commit**

```bash
git add server/routes/menus.cjs server/index.cjs
git commit -m "feat(api): 添加菜单管理 CRUD API"
```

---

## Task 4: 后端 — 更新认证和用户 API

**Files:**
- Modify: `server/routes/auth.cjs`
- Modify: `server/routes/users.cjs`
- Modify: `server/middleware/permission.cjs`

- [ ] **Step 1: 更新 auth.cjs 登录接口返回权限列表**

在 login 接口中，登录成功后查询用户权限：

```javascript
// 登录成功后，查询用户菜单权限
const menus = db.exec(`
  SELECT DISTINCT m.key, m.path FROM menus m
  JOIN role_permissions rp ON m.id = rp.menu_id
  JOIN users u ON rp.role_id = u.role_id
  WHERE u.id = ? AND m.status = 1
`, [user.id])[0];

const permissions = menus ? menus.values.map(row => ({
  key: row[0],
  path: row[1]
})) : [];

// 返回时附带 permissions
res.json({
  code: 200,
  message: '登录成功',
  data: {
    user: { ...userData, role_id: user.role_id },
    accessToken,
    refreshToken,
    permissions
  }
});
```

- [ ] **Step 2: 更新 auth.cjs profile 接口返回权限**

```javascript
// getProfile 接口中，查询用户权限
const menus = db.exec(`
  SELECT DISTINCT m.key, m.path FROM menus m
  JOIN role_permissions rp ON m.id = rp.menu_id
  WHERE rp.role_id = ? AND m.status = 1
`, [user.role_id])[0];

const permissions = menus ? menus.values.map(row => ({
  key: row[0],
  path: row[1]
})) : [];

res.json({
  code: 200,
  message: 'success',
  data: { ...user, permissions }
});
```

- [ ] **Step 3: 更新 users.cjs 创建/编辑用户时支持 role_id**

```javascript
// 创建用户时
const { username, password, display_name, email, role_id } = req.body;
// 使用 role_id 而不是 role
db.exec(`INSERT INTO users (username, password, display_name, email, role_id) VALUES (?, ?, ?, ?, ?)`,
  [username, hashedPassword, display_name, email, role_id]);

// 编辑用户时
db.exec(`UPDATE users SET display_name = ?, email = ?, role_id = ?, status = ? WHERE id = ?`,
  [display_name, email, role_id, status, req.params.id]);
```

- [ ] **Step 4: 更新 permission.cjs 使用数据库角色**

```javascript
// 替换硬编码的 ROLE_HIERARCHY，改为从数据库查询
const requireRole = (...roles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ code: 401, message: '未登录' });
    }

    const db = getDatabase();
    const userRole = db.exec(`SELECT r.level FROM roles r WHERE r.id = ?`, [req.user.role_id])[0];
    
    if (!userRole || userRole.values.length === 0) {
      return res.status(403).json({ code: 403, message: '角色不存在' });
    }

    const userLevel = userRole.values[0][0];

    // 检查所需角色的等级
    const requiredRoles = db.exec(`SELECT MAX(level) as level FROM roles WHERE name IN (${roles.map(() => '?').join(',')})`, roles)[0];
    
    if (!requiredRoles || requiredRoles.values.length === 0) {
      return res.status(403).json({ code: 403, message: '权限配置错误' });
    }

    const requiredLevel = requiredRoles.values[0][0];

    if (userLevel < requiredLevel) {
      return res.status(403).json({ code: 403, message: '权限不足' });
    }

    next();
  };
};
```

- [ ] **Step 5: Commit**

```bash
git add server/routes/auth.cjs server/routes/users.cjs server/middleware/permission.cjs
git commit -m "feat(api): 更新认证和用户API支持RBAC"
```

---

## Task 5: 前端 — API 客户端

**Files:**
- Create: `src/api/roles.js`
- Create: `src/api/menus.js`
- Modify: `src/api/users.js`

- [ ] **Step 1: 创建 roles.js**

```javascript
import { getAccessToken } from './auth';

const API_BASE = '/api';

async function request(url, options = {}) {
  const token = getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${url}`, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '请求失败');
  }

  return data;
}

export async function getRoles() {
  return request('/roles');
}

export async function getRole(id) {
  return request(`/roles/${id}`);
}

export async function createRole(data) {
  return request('/roles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRole(id, data) {
  return request(`/roles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteRole(id) {
  return request(`/roles/${id}`, {
    method: 'DELETE',
  });
}
```

- [ ] **Step 2: 创建 menus.js**

```javascript
import { getAccessToken } from './auth';

const API_BASE = '/api';

async function request(url, options = {}) {
  const token = getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${url}`, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '请求失败');
  }

  return data;
}

export async function getMenus() {
  return request('/menus');
}

export async function getMenusFlat() {
  return request('/menus/flat');
}

export async function getMyMenus() {
  return request('/menus/my');
}

export async function createMenu(data) {
  return request('/menus', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateMenu(id, data) {
  return request(`/menus/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteMenu(id) {
  return request(`/menus/${id}`, {
    method: 'DELETE',
  });
}
```

- [ ] **Step 3: 更新 users.js 支持 role_id**

```javascript
// 更新 createUser 和 updateUser 函数
export async function createUser(data) {
  return request('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateUser(id, data) {
  return request(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/api/roles.js src/api/menus.js src/api/users.js
git commit -m "feat(api): 添加角色和菜单前端API客户端"
```

---

## Task 6: 前端 — 更新 AuthContext

**Files:**
- Modify: `src/contexts/AuthContext.jsx`

- [ ] **Step 1: 添加 permissions 状态**

```javascript
const [user, setUser] = useState(null);
const [permissions, setPermissions] = useState([]);

// 修改 loginUser 函数
const loginUser = useCallback((userData, userPermissions = []) => {
  setUser(userData);
  setPermissions(userPermissions);
  // Schedule token refresh
  scheduleNextRefresh();
}, [scheduleNextRefresh]);

// 修改 logoutUser 函数
const logoutUser = useCallback(() => {
  if (refreshTimeoutRef.current) {
    clearTimeout(refreshTimeoutRef.current);
  }
  setUser(null);
  setPermissions([]);
}, []);

// 添加检查权限的方法
const hasPermission = useCallback((menuKey) => {
  if (!user) return false;
  if (user.role === 'admin') return true; // admin 拥有所有权限
  return permissions.some(p => p.key === menuKey);
}, [user, permissions]);

// 修改 initAuth，获取权限
useEffect(() => {
  const initAuth = async () => {
    if (isAuthenticated()) {
      try {
        if (getTokenExpiration() && Date.now() >= getTokenExpiration() - 30000) {
          await handleTokenRefresh();
        } else {
          const userData = await getProfile();
          setUser(userData);
          setPermissions(userData.permissions || []);
          scheduleNextRefresh();
        }
      } catch {
        setUser(null);
        setPermissions([]);
      }
    }
    setLoading(false);
  };
  
  initAuth();
  // ...
}, []);

// 修改 Provider value
return (
  <AuthContext.Provider value={{ user, loading, permissions, loginUser, logoutUser, hasRole, hasPermission }}>
    {children}
  </AuthContext.Provider>
);
```

- [ ] **Step 2: Commit**

```bash
git add src/contexts/AuthContext.jsx
git commit -m "feat(auth): 添加permissions状态和hasPermission方法"
```

---

## Task 7: 前端 — 角色管理页面

**Files:**
- Create: `src/components/RoleManage.jsx`
- Create: `src/components/RoleManage.module.css`

- [ ] **Step 1: 创建 RoleManage.jsx**

```jsx
import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Switch, Tree, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getRoles, getRole, createRole, updateRole, deleteRole } from '../api/roles';
import { getMenusFlat } from '../api/menus';
import styles from './RoleManage.module.css';

export default function RoleManage() {
  const [roles, setRoles] = useState([]);
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [form] = Form.useForm();
  const [checkedKeys, setCheckedKeys] = useState([]);

  useEffect(() => {
    loadRoles();
    loadMenus();
  }, []);

  const loadRoles = async () => {
    setLoading(true);
    try {
      const res = await getRoles();
      setRoles(res.data);
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMenus = async () => {
    try {
      const res = await getMenusFlat();
      setMenus(res.data);
    } catch (error) {
      message.error(error.message);
    }
  };

  const handleAdd = () => {
    setEditingRole(null);
    form.resetFields();
    setCheckedKeys([]);
    setModalVisible(true);
  };

  const handleEdit = async (record) => {
    try {
      const res = await getRole(record.id);
      setEditingRole(res.data);
      form.setFieldsValue({
        name: res.data.name,
        label: res.data.label,
        level: res.data.level,
        status: res.data.status,
      });
      setCheckedKeys(res.data.permissions.map(p => p.id));
      setModalVisible(true);
    } catch (error) {
      message.error(error.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteRole(id);
      message.success('删除成功');
      loadRoles();
    } catch (error) {
      message.error(error.message);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        permissions: checkedKeys,
      };

      if (editingRole) {
        await updateRole(editingRole.id, data);
        message.success('更新成功');
      } else {
        await createRole(data);
        message.success('创建成功');
      }

      setModalVisible(false);
      loadRoles();
    } catch (error) {
      if (error.message) {
        message.error(error.message);
      }
    }
  };

  const columns = [
    { title: '角色名', dataIndex: 'name', key: 'name' },
    { title: '标签', dataIndex: 'label', key: 'label' },
    { title: '等级', dataIndex: 'level', key: 'level', render: (v) => <Tag>{v}</Tag> },
    { title: '用户数', dataIndex: 'user_count', key: 'user_count' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <span className={styles.actions}>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          {record.name !== 'admin' && (
            <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </span>
      ),
    },
  ];

  // 构建菜单树用于权限选择
  const menuTreeData = menus
    .filter(m => !m.parent_id)
    .map(m => ({
      title: m.label,
      key: m.id,
      children: menus
        .filter(c => c.parent_id === m.id)
        .map(c => ({
          title: c.label,
          key: c.id,
        })),
    }));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>角色管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增角色
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={roles}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title={editingRole ? '编辑角色' : '新增角色'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="角色名" rules={[{ required: true, message: '请输入角色名' }]}>
            <Input disabled={editingRole?.name === 'admin'} />
          </Form.Item>
          <Form.Item name="label" label="标签" rules={[{ required: true, message: '请输入标签' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="level" label="等级" rules={[{ required: true, message: '请输入等级' }]}>
            <InputNumber min={1} max={10} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
          <Form.Item label="菜单权限">
            <Tree
              checkable
              defaultExpandAll
              checkedKeys={checkedKeys}
              onCheck={(keys) => setCheckedKeys(keys)}
              treeData={menuTreeData}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 创建 RoleManage.module.css**

```css
.container {
  padding: 24px;
  height: 100%;
  overflow: auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header h2 {
  margin: 0;
  font-size: 20px;
  color: var(--text-primary);
}

.actions {
  display: flex;
  gap: 0;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/RoleManage.jsx src/components/RoleManage.module.css
git commit -m "feat: 添加角色管理页面"
```

---

## Task 8: 前端 — 菜单管理页面

**Files:**
- Create: `src/components/MenuManage.jsx`
- Create: `src/components/MenuManage.module.css`

- [ ] **Step 1: 创建 MenuManage.jsx**

```jsx
import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Switch, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getMenus, createMenu, updateMenu, deleteMenu } from '../api/menus';
import styles from './MenuManage.module.css';

export default function MenuManage() {
  const [menus, setMenus] = useState([]);
  const [flatMenus, setFlatMenus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMenu, setEditingMenu] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadMenus();
  }, []);

  const loadMenus = async () => {
    setLoading(true);
    try {
      const res = await getMenus();
      setMenus(res.data);
      // 扁平化用于父菜单选择
      const flat = [];
      const flatten = (items) => {
        items.forEach(item => {
          flat.push(item);
          if (item.children) flatten(item.children);
        });
      };
      flatten(res.data);
      setFlatMenus(flat);
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = (parentId = null) => {
    setEditingMenu(null);
    form.resetFields();
    if (parentId) {
      form.setFieldsValue({ parent_id: parentId });
    }
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingMenu(record);
    form.setFieldsValue({
      parent_id: record.parent_id,
      key: record.key,
      label: record.label,
      icon: record.icon,
      path: record.path,
      sort_order: record.sort_order,
      status: record.status,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await deleteMenu(id);
      message.success('删除成功');
      loadMenus();
    } catch (error) {
      message.error(error.message);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingMenu) {
        await updateMenu(editingMenu.id, values);
        message.success('更新成功');
      } else {
        await createMenu(values);
        message.success('创建成功');
      }

      setModalVisible(false);
      loadMenus();
    } catch (error) {
      if (error.message) {
        message.error(error.message);
      }
    }
  };

  const columns = [
    { title: '菜单名称', dataIndex: 'label', key: 'label' },
    { title: 'Key', dataIndex: 'key', key: 'key' },
    { title: '路径', dataIndex: 'path', key: 'path' },
    { title: '图标', dataIndex: 'icon', key: 'icon' },
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <span className={styles.actions}>
          <Button type="link" icon={<PlusOutlined />} onClick={() => handleAdd(record.id)}>
            添加子菜单
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </span>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>菜单管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAdd()}>
          新增菜单
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={menus}
        rowKey="id"
        loading={loading}
        pagination={false}
        childrenColumnName="children"
      />

      <Modal
        title={editingMenu ? '编辑菜单' : '新增菜单'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="parent_id" label="上级菜单">
            <Select allowClear placeholder="无（一级菜单）">
              {flatMenus.map(m => (
                <Select.Option key={m.id} value={m.id}>
                  {m.parent_id ? '└ ' : ''}{m.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="key" label="菜单 Key" rules={[{ required: true, message: '请输入菜单 Key' }]}>
            <Input disabled={editingMenu} />
          </Form.Item>
          <Form.Item name="label" label="菜单名称" rules={[{ required: true, message: '请输入菜单名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="icon" label="图标">
            <Input placeholder="如：HomeOutlined" />
          </Form.Item>
          <Form.Item name="path" label="路由路径">
            <Input placeholder="如：/photography/home" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 创建 MenuManage.module.css**

```css
.container {
  padding: 24px;
  height: 100%;
  overflow: auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header h2 {
  margin: 0;
  font-size: 20px;
  color: var(--text-primary);
}

.actions {
  display: flex;
  gap: 0;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/MenuManage.jsx src/components/MenuManage.module.css
git commit -m "feat: 添加菜单管理页面"
```

---

## Task 9: 前端 — 更新 FloatingMenu 动态渲染

**Files:**
- Modify: `src/components/FloatingMenu.jsx`

- [ ] **Step 1: 重写 FloatingMenu 从 API 获取菜单**

```jsx
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Popover, Dropdown, Avatar, Menu, Badge, Divider, Typography } from 'antd';
import { 
  CameraOutlined, 
  UserOutlined, 
  LogoutOutlined, 
  SettingOutlined,
  HomeOutlined,
  TeamOutlined,
  PictureOutlined,
  SafetyOutlined,
  MenuOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { logout } from '../api/auth';
import { getMyMenus } from '../api/menus';
import styles from './FloatingMenu.module.css';

const { Text } = Typography;

// 图标映射
const iconMap = {
  CameraOutlined: <CameraOutlined />,
  HomeOutlined: <HomeOutlined />,
  PictureOutlined: <PictureOutlined />,
  SettingOutlined: <SettingOutlined />,
  TeamOutlined: <TeamOutlined />,
  SafetyOutlined: <SafetyOutlined />,
  MenuOutlined: <MenuOutlined />,
  AppstoreOutlined: <AppstoreOutlined />,
};

export default function FloatingMenu() {
  const [menuTree, setMenuTree] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loginUser, hasRole } = useAuth();

  useEffect(() => {
    if (user) {
      loadMenus();
    }
  }, [user]);

  const loadMenus = async () => {
    try {
      const res = await getMyMenus();
      setMenuTree(res.data);
    } catch (error) {
      console.error('Failed to load menus:', error);
    }
  };

  // 获取当前模块（一级菜单）
  const getCurrentModule = () => {
    const path = location.pathname;
    for (const mod of menuTree) {
      if (mod.path && path.startsWith(mod.path)) {
        return mod;
      }
    }
    return menuTree[0];
  };

  const currentModule = getCurrentModule();

  // 获取当前页面（二级菜单）
  const getCurrentPage = () => {
    const path = location.pathname;
    for (const mod of menuTree) {
      if (mod.children) {
        for (const child of mod.children) {
          if (child.path === path) {
            return child.key;
          }
        }
      }
    }
    return 'home';
  };

  const currentPage = getCurrentPage();

  const handleLogout = () => {
    logout();
    loginUser(null);
  };

  const moduleMenuItems = menuTree.map(mod => ({
    key: mod.key,
    icon: iconMap[mod.icon] || <AppstoreOutlined />,
    label: mod.label,
    onClick: () => {
      if (mod.path) navigate(mod.path);
    },
  }));

  const pageMenuItems = currentModule?.children?.map(child => ({
    key: child.key,
    icon: iconMap[child.icon],
    label: child.label,
    onClick: () => navigate(child.path),
  })) || [];

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
    },
    hasRole('admin') && {
      key: 'users',
      icon: <TeamOutlined />,
      label: '用户管理',
      onClick: () => navigate('/photography/admin/users'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ].filter(Boolean);

  const popoverContent = (
    <div className={styles.popoverContent}>
      <div className={styles.section}>
        <Text type="secondary" className={styles.sectionTitle}>模块切换</Text>
        <Menu
          mode="vertical"
          selectedKeys={[currentModule?.key]}
          items={moduleMenuItems}
          className={styles.menu}
        />
      </div>

      <Divider style={{ margin: '4px 0' }} />

      <div className={styles.section}>
        <Text type="secondary" className={styles.sectionTitle}>{currentModule?.label}导航</Text>
        <Menu
          mode="vertical"
          selectedKeys={[currentPage]}
          items={pageMenuItems}
          className={styles.menu}
        />
      </div>

      {user && (
        <>
          <Divider style={{ margin: '4px 0' }} />
          <div className={styles.section}>
            <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="topRight">
              <div className={styles.userItem}>
                <Avatar 
                  icon={<UserOutlined />} 
                  size="small"
                  style={{ backgroundColor: 'var(--accent)' }}
                />
                <Text>{user.displayName || user.username}</Text>
              </div>
            </Dropdown>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className={styles.container}>
      <Popover
        content={popoverContent}
        trigger="hover"
        placement="topRight"
        overlayClassName={styles.popover}
        arrow={false}
      >
        <Badge dot={!!user} offset={[-2, 2]}>
          <div className={styles.mainButton}>
            <div className={styles.moduleIcon}>
              {iconMap[currentModule?.icon] || <AppstoreOutlined />}
            </div>
          </div>
        </Badge>
      </Popover>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FloatingMenu.jsx
git commit -m "feat: FloatingMenu改为动态菜单渲染"
```

---

## Task 10: 前端 — 更新路由和用户管理

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/UserManage.jsx`
- Modify: `src/components/ProtectedRoute.jsx`

- [ ] **Step 1: 在 App.jsx 添加新路由**

```jsx
import RoleManage from './components/RoleManage';
import MenuManage from './components/MenuManage';

// 在 Routes 中添加
<Route path="/photography/admin/roles" element={
  <ProtectedRoute requiredRole="admin">
    <div style={{ height: '100%', overflow: 'auto', paddingBottom: '80px' }}>
      <RoleManage />
    </div>
  </ProtectedRoute>
} />
<Route path="/photography/admin/menus" element={
  <ProtectedRoute requiredRole="admin">
    <div style={{ height: '100%', overflow: 'auto', paddingBottom: '80px' }}>
      <MenuManage />
    </div>
  </ProtectedRoute>
} />
```

- [ ] **Step 2: 更新 UserManage.jsx 使用角色下拉选择**

```jsx
import { getRoles } from '../api/roles';

// 在 useEffect 中加载角色列表
const [roles, setRoles] = useState([]);

useEffect(() => {
  loadRoles();
}, []);

const loadRoles = async () => {
  try {
    const res = await getRoles();
    setRoles(res.data);
  } catch (error) {
    console.error('Failed to load roles:', error);
  }
};

// 在表单中使用
<Form.Item name="role_id" label="角色">
  <Select>
    {roles.map(role => (
      <Select.Option key={role.id} value={role.id}>
        {role.label}
      </Select.Option>
    ))}
  </Select>
</Form.Item>

// 在表格中显示角色
{
  title: '角色',
  dataIndex: 'role_id',
  key: 'role_id',
  render: (role_id) => {
    const role = roles.find(r => r.id === role_id);
    return role?.label || role_id;
  },
}
```

- [ ] **Step 3: 更新 ProtectedRoute.jsx 使用权限检查**

```jsx
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, requiredRole, requiredPermission }) {
  const { user, loading, hasRole, hasPermission } = useAuth();

  if (loading) {
    return <Spin />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return <div>权限不足</div>;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <div>权限不足</div>;
  }

  return children;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/components/UserManage.jsx src/components/ProtectedRoute.jsx
git commit -m "feat: 更新路由和用户管理支持RBAC"
```

---

## Task 11: 测试和修复

- [ ] **Step 1: 启动后端服务器测试 API**

```bash
node server/index.cjs
```

- [ ] **Step 2: 测试登录获取权限**

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

- [ ] **Step 3: 测试角色管理 API**

```bash
# 获取角色列表
curl http://localhost:3001/api/roles -H "Authorization: Bearer <token>"

# 获取菜单列表
curl http://localhost:3001/api/menus -H "Authorization: Bearer <token>"

# 获取用户菜单
curl http://localhost:3001/api/menus/my -H "Authorization: Bearer <token>"
```

- [ ] **Step 4: 启动前端测试页面**

```bash
npm run dev
```

- [ ] **Step 5: 测试完整流程**

1. 登录 admin 账户
2. 访问角色管理页面，创建/编辑角色
3. 访问菜单管理页面，添加/编辑菜单
4. 为角色分配菜单权限
5. 创建新用户并分配角色
6. 用新用户登录，验证菜单可见性

- [ ] **Step 6: 修复发现的问题**

- [ ] **Step 7: Commit 最终修复**

```bash
git add -A
git commit -m "fix: 修复RBAC系统问题"
```

---

## 完成

所有任务完成后，系统将具备：

1. **角色管理** - 创建/编辑/删除角色，设置等级和权限
2. **菜单管理** - 动态添加/编辑/删除菜单，支持树形结构
3. **动态菜单** - FloatingMenu 根据用户权限动态渲染
4. **路由保护** - 前后端双重权限校验
5. **用户管理** - 支持角色选择和权限分配
