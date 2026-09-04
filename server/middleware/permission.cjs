const { getDb } = require('../db.cjs');

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

function hasMenu(user, menuKey) {
  if (!user) return false;
  if (user.role === 'admin') return true;

  const db = getDb();
  const menuStmt = db.prepare('SELECT id FROM menus WHERE key = ? AND status = 1');
  menuStmt.bind([menuKey]);
  if (!menuStmt.step()) {
    menuStmt.free();
    return false;
  }
  const menu = menuStmt.getAsObject();
  menuStmt.free();

  const permStmt = db.prepare(
    'SELECT COUNT(*) as count FROM role_permissions WHERE role_id = ? AND menu_id = ?'
  );
  permStmt.bind([user.role_id, menu.id]);
  permStmt.step();
  const perm = permStmt.getAsObject();
  permStmt.free();
  return perm.count > 0;
}

function requireMenu(menuKey) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ code: 401, message: '请先登录', data: null });
    }

    try {
      if (hasMenu(req.user, menuKey)) return next();
      return res.status(403).json({ code: 403, message: '权限不足', data: null });
    } catch (error) {
      console.error('requireMenu error:', error);
      return res.status(500).json({ code: 500, message: '权限检查失败', data: null });
    }
  };
}

module.exports = {
  requireRole,
  requireAdmin,
  requireModuleAdmin,
  requireCreator,
  requireMenu,
  hasMenu,
  ROLE_HIERARCHY,
};
