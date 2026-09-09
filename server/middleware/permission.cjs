const { getDb } = require('../db.cjs');
const { loadRoleRows } = require('../lib/userRoles.cjs');

const ROLE_HIERARCHY = {
  admin: 4,
  photography_admin: 3,
  system_admin: 3,
  travel_admin: 3,
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
  'trips.read.own',
  'trips.read.all',
  'trips.write.own',
  'trips.write.all',
  'budgets.read.own',
  'budgets.read.all',
  'budgets.write.own',
  'budgets.write.all',
  'users.manage',
  'roles.manage',
  'menus.manage',
];

const MENU_SCOPE_ALIASES = {
  'admin.all': ['photos.read.all', 'photos.write.all'],
  'admin.own': ['photos.read.own', 'photos.write.own'],
  'calendar.all': ['photos.read.all'],
  'calendar.own': ['photos.read.own'],
  'review.all': ['photos.read.all', 'photos.review'],
  'review.own': ['photos.review'],
  'users.all': ['users.manage'],
  'roles.all': ['roles.manage'],
  'menus.all': ['menus.manage'],
  'travel_trips.all': ['trips.read.all', 'trips.write.all'],
  'travel_trips.own': ['trips.read.own', 'trips.write.own'],
  'travel_budget.all': ['budgets.read.all', 'budgets.write.all'],
  'travel_budget.own': ['budgets.read.own', 'budgets.write.own'],
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
  return requireRole('photography_admin', 'system_admin', 'travel_admin', 'module_admin')(req, res, next);
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

function requireAnyMenu(...menuKeys) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ code: 401, message: '请先登录', data: null });
    }

    try {
      if (menuKeys.some((key) => hasMenu(req.user, key))) return next();
      return res.status(403).json({ code: 403, message: '权限不足', data: null });
    } catch (error) {
      console.error('requireAnyMenu error:', error);
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

function publicGallerySql(alias) {
  const prefix = alias ? `${alias}.` : '';
  return `${prefix}review_status = 1 AND IFNULL(${prefix}is_public, 1) = 1`;
}

function buildPhotoListFilter(user, { scope } = {}) {
  if (scope === 'all') {
    return { sql: publicGallerySql('p'), params: [] };
  }
  if (hasDataPerm(user, 'photos.read.all')) {
    return { sql: '1=1', params: [] };
  }
  if (hasDataPerm(user, 'photos.read.own') || hasDataPerm(user, 'photos.write.own')) {
    return { sql: 'p.uploaded_by = ?', params: [user.username] };
  }
  return { sql: publicGallerySql('p'), params: [] };
}

function canWritePhoto(user, photo) {
  if (!user || !photo) return false;
  if (hasDataPerm(user, 'photos.write.all')) return true;
  return hasDataPerm(user, 'photos.write.own') && photo.uploaded_by === user.username;
}

function hasTripListAccess(user) {
  return hasDataPerm(user, 'trips.read.all')
    || hasDataPerm(user, 'trips.write.all')
    || hasDataPerm(user, 'budgets.read.all')
    || hasDataPerm(user, 'budgets.write.all');
}

function hasTripOwnAccess(user) {
  return hasDataPerm(user, 'trips.read.own')
    || hasDataPerm(user, 'trips.write.own')
    || hasDataPerm(user, 'budgets.read.own')
    || hasDataPerm(user, 'budgets.write.own');
}

function buildTripListFilter(user) {
  if (hasTripListAccess(user)) {
    return { sql: '1=1', params: [] };
  }
  if (hasTripOwnAccess(user)) {
    return { sql: 'created_by = ?', params: [user.username] };
  }
  return { sql: '1=0', params: [] };
}

function canReadTrip(user, trip) {
  if (!user || !trip) return false;
  if (hasTripListAccess(user)) return true;
  return hasTripOwnAccess(user) && trip.created_by === user.username;
}

function canWriteTrip(user, trip) {
  if (!user || !trip) return false;
  if (hasDataPerm(user, 'trips.write.all')) return true;
  return hasDataPerm(user, 'trips.write.own') && trip.created_by === user.username;
}

function buildBudgetListFilter(user) {
  if (hasDataPerm(user, 'budgets.read.all') || hasDataPerm(user, 'budgets.write.all')) {
    return { sql: '1=1', params: [] };
  }
  if (hasDataPerm(user, 'budgets.read.own') || hasDataPerm(user, 'budgets.write.own')) {
    return { sql: 'created_by = ?', params: [user.username] };
  }
  return { sql: '1=0', params: [] };
}

function canReadBudget(user, budget) {
  if (!user || !budget) return false;
  if (hasDataPerm(user, 'budgets.read.all') || hasDataPerm(user, 'budgets.write.all')) return true;
  return (hasDataPerm(user, 'budgets.read.own') || hasDataPerm(user, 'budgets.write.own'))
    && budget.created_by === user.username;
}

function canWriteBudget(user, budget) {
  if (!user || !budget) return false;
  if (hasDataPerm(user, 'budgets.write.all')) return true;
  return hasDataPerm(user, 'budgets.write.own') && budget.created_by === user.username;
}

function visibilitySql(user) {
  if (hasDataPerm(user, 'photos.read.all') || hasDataPerm(user, 'photos.review')) {
    return { sql: '1=1', params: [] };
  }
  if (user) {
    return {
      sql: `((${publicGallerySql()}) OR uploaded_by = ?)`,
      params: [user.username],
    };
  }
  return { sql: publicGallerySql(), params: [] };
}

module.exports = {
  requireRole,
  requireAdmin,
  requireModuleAdmin,
  requireCreator,
  requireMenu,
  requireAnyMenu,
  requireDataPerm,
  hasMenu,
  hasDataPerm,
  hasRoleName,
  isAdminUser,
  loadUserAccess,
  publicGallerySql,
  buildPhotoListFilter,
  canWritePhoto,
  buildTripListFilter,
  canReadTrip,
  canWriteTrip,
  buildBudgetListFilter,
  canReadBudget,
  canWriteBudget,
  visibilitySql,
  ROLE_HIERARCHY,
  DATA_PERM_CODES,
  isAllowedDataCode,
};
