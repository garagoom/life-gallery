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

module.exports = { requireRole, requireAdmin, requireModuleAdmin, requireCreator, ROLE_HIERARCHY };
