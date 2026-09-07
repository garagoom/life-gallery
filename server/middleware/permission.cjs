const { getDb } = require('../db.cjs');
const { loadRoleRows } = require('../lib/userRoles.cjs');

const ROLE_HIERARCHY = {
  admin: 4,
  photography_admin: 3,
  system_admin: 3,
  module_admin: 3,
  reviewer: 2,
  creator: 2,
  viewer: 1,
};

const DATA_PERM_CODES = [
  'photos.read.own',
  'photos.read.all',
  'photos.write.own',
  'photos.write.all',
  'photos.review',
  'users.manage',
  'roles.manage',
  'menus.manage',
];

const MENU_SCOPE_ALIASES = {
  'admin.all': ['photos.read.all', 'photos.write.all'],
  'admin.own': ['photos.read.own', 'photos.write.own'],
  'review.all': ['photos.read.all', 'photos.review'],
  'review.own': ['photos.review'],
  'users.all': ['users.manage'],
  'roles.all': ['roles.manage'],
  'menus.all': ['menus.manage'],
};

function isAllowedDataCode(code) {
  if (DATA_PERM_CODES.includes(code)) return true;
  return /^[a-z0-9_]+\.(own|all)$/i.test(String(code || ''));
}

function isAdminUser(user) {
  if (!user) return false;
  if (Array.isArray(user.roles) && user.roles.includes('admin')) return true;
  return user.role === 'admin';
}

function hasRoleName(user, name) {
  if (!user || !name) return false;
  if (Array.isArray(user.roles) && user.roles.length > 0) {
    return user.roles.includes(name);
  }
  return user.role === name;
}

function loadUserAccess(userId, { fallbackRole = 'viewer', fallbackRoleId = null } = {}) {
  const db = getDb();
  if (!db || userId == null) {
    const roles = fallbackRole ? [fallbackRole] : [];
    return {
      roles,
      roleIds: fallbackRoleId ? [fallbackRoleId] : [],
      permissions: [],
      role: fallbackRole,
      role_id: fallbackRoleId,
    };
  }

  let roleRows = loadRoleRows(db, userId);
  if (roleRows.length === 0 && fallbackRoleId) {
    const stmt = db.prepare('SELECT id, name, level FROM roles WHERE id = ? AND status = 1');
    stmt.bind([fallbackRoleId]);
    if (stmt.step()) roleRows = [stmt.getAsObject()];
    stmt.free();
  }
  if (roleRows.length === 0 && fallbackRole) {
    const stmt = db.prepare('SELECT id, name, level FROM roles WHERE name = ? AND status = 1');
    stmt.bind([fallbackRole]);
    if (stmt.step()) roleRows = [stmt.getAsObject()];
    stmt.free();
  }

  const roleIds = roleRows.map((row) => row.id);
  const roles = roleRows.map((row) => row.name);
  const permissions = new Set();

  if (roleIds.length > 0) {
    const placeholders = roleIds.map(() => '?').join(',');
    const permStmt = db.prepare(
      `SELECT code FROM role_data_permissions WHERE role_id IN (${placeholders})`
    );
    permStmt.bind(roleIds);
    while (permStmt.step()) {
      const { code } = permStmt.getAsObject();
      if (code) permissions.add(code);
    }
    permStmt.free();
  }

  const primary = roleRows[0] || { name: fallbackRole || 'viewer', id: fallbackRoleId };
  return {
    roles,
    roleIds,
    permissions: [...permissions],
    role: primary.name,
    role_id: primary.id,
  };
}

function hasDataPerm(user, code) {
  if (!user || !code) return false;
  if (isAdminUser(user)) return true;
  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  if (perms.includes(code)) return true;
  for (const [scopeCode, aliases] of Object.entries(MENU_SCOPE_ALIASES)) {
    if (perms.includes(scopeCode) && aliases.includes(code)) return true;
  }
  return false;
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ code: 401, message: '请先登录', data: null });
    }
    if (isAdminUser(req.user)) return next();
    if (roles.some((role) => hasRoleName(req.user, role))) return next();
    return res.status(403).json({ code: 403, message: '权限不足', data: null });
  };
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ code: 401, message: '请先登录', data: null });
  }
  if (isAdminUser(req.user)) return next();
  return res.status(403).json({ code: 403, message: '权限不足', data: null });
}

function requireModuleAdmin(req, res, next) {
  return requireRole('photography_admin', 'system_admin', 'module_admin')(req, res, next);
}

function requireCreator(req, res, next) {
  return requireRole('creator')(req, res, next);
}

function hasMenu(user, menuKey) {
  if (!user) return false;
  if (isAdminUser(user)) return true;

  const db = getDb();
  if (!db) return false;

  const menuStmt = db.prepare('SELECT id FROM menus WHERE key = ? AND status = 1');
  menuStmt.bind([menuKey]);
  if (!menuStmt.step()) {
    menuStmt.free();
    return false;
  }
  const menu = menuStmt.getAsObject();
  menuStmt.free();

  const roleIds = Array.isArray(user.roleIds) && user.roleIds.length > 0
    ? user.roleIds
    : (user.role_id ? [user.role_id] : []);
  if (roleIds.length === 0) return false;

  const placeholders = roleIds.map(() => '?').join(',');
  const permStmt = db.prepare(
    `SELECT COUNT(*) as count FROM role_permissions WHERE menu_id = ? AND role_id IN (${placeholders})`
  );
  permStmt.bind([menu.id, ...roleIds]);
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

function requireDataPerm(code) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ code: 401, message: '请先登录', data: null });
    }
    if (hasDataPerm(req.user, code)) return next();
    return res.status(403).json({ code: 403, message: '权限不足', data: null });
  };
}

function buildPhotoListFilter(user, { scope } = {}) {
  if (scope === 'all') {
    return { sql: 'p.review_status = 1', params: [] };
  }
  if (hasDataPerm(user, 'photos.read.all')) {
    return { sql: '1=1', params: [] };
  }
  if (hasDataPerm(user, 'photos.read.own') || hasDataPerm(user, 'photos.write.own')) {
    return { sql: 'p.uploaded_by = ?', params: [user.username] };
  }
  return { sql: 'p.review_status = 1', params: [] };
}

function canWritePhoto(user, photo) {
  if (!user || !photo) return false;
  if (hasDataPerm(user, 'photos.write.all')) return true;
  return hasDataPerm(user, 'photos.write.own') && photo.uploaded_by === user.username;
}

function visibilitySql(user) {
  if (hasDataPerm(user, 'photos.read.all') || hasDataPerm(user, 'photos.review')) {
    return { sql: '1=1', params: [] };
  }
  if (user) {
    return { sql: '(review_status = 1 OR uploaded_by = ?)', params: [user.username] };
  }
  return { sql: 'review_status = 1', params: [] };
}

module.exports = {
  requireRole,
  requireAdmin,
  requireModuleAdmin,
  requireCreator,
  requireMenu,
  requireDataPerm,
  hasMenu,
  hasDataPerm,
  hasRoleName,
  isAdminUser,
  loadUserAccess,
  buildPhotoListFilter,
  canWritePhoto,
  visibilitySql,
  ROLE_HIERARCHY,
  DATA_PERM_CODES,
  isAllowedDataCode,
};
