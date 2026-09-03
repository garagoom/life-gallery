const ROLE_HIERARCHY = {
  admin: 4,
  module_admin: 3,
  creator: 2,
  viewer: 1
};

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ code: 401, message: '请先登录', data: null });
    }
    
    const userRoleLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredLevel = Math.max(...roles.map(r => ROLE_HIERARCHY[r] || 0));
    
    if (userRoleLevel < requiredLevel) {
      return res.status(403).json({ code: 403, message: '权限不足', data: null });
    }
    
    next();
  };
}

function requireAdmin(req, res, next) {
  return requireRole('admin')(req, res, next);
}

function requireModuleAdmin(req, res, next) {
  return requireRole('module_admin')(req, res, next);
}

function requireCreator(req, res, next) {
  return requireRole('creator')(req, res, next);
}

// Check if user's role has permission for a menu key
function requireMenu(menuKey) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ code: 401, message: '请先登录', data: null });
    }

    const { getDb } = require('../db.cjs');
    const db = getDb();

    try {
      // Get user's role_id
      const userStmt = db.prepare('SELECT role_id FROM users WHERE id = ?');
      userStmt.bind([req.user.id]);
      if (!userStmt.step()) {
        userStmt.free();
        return res.status(401).json({ code: 401, message: '用户不存在', data: null });
      }
      const user = userStmt.getAsObject();
      userStmt.free();

      // Admin has all permissions
      if (req.user.role === 'admin') return next();

      // Get menu id by key
      const menuStmt = db.prepare('SELECT id FROM menus WHERE key = ? AND status = 1');
      menuStmt.bind([menuKey]);
      if (!menuStmt.step()) {
        menuStmt.free();
        return res.status(403).json({ code: 403, message: '菜单不存在', data: null });
      }
      const menu = menuStmt.getAsObject();
      menuStmt.free();

      // Check if role has this menu permission
      const permStmt = db.prepare('SELECT COUNT(*) as count FROM role_permissions WHERE role_id = ? AND menu_id = ?');
      permStmt.bind([user.role_id, menu.id]);
      permStmt.step();
      const perm = permStmt.getAsObject();
      permStmt.free();

      if (perm.count > 0) {
        return next();
      }

      return res.status(403).json({ code: 403, message: '权限不足', data: null });
    } catch (error) {
      console.error('requireMenu error:', error);
      return res.status(500).json({ code: 500, message: '权限检查失败', data: null });
    }
  };
}

module.exports = { requireRole, requireAdmin, requireModuleAdmin, requireCreator, requireMenu, ROLE_HIERARCHY };
