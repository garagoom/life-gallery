const DEFAULT_ADMIN_USERNAME = 'admin';

const ASSIGNABLE_ROLES = [
  'photography_admin',
  'system_admin',
  'reviewer',
  'creator',
  'viewer',
  'module_admin',
];

function isDefaultAdminUsername(username) {
  return username === DEFAULT_ADMIN_USERNAME;
}

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function assertAssignableRoles(roleNames, { username = null } = {}) {
  if (!Array.isArray(roleNames) || roleNames.length === 0) {
    throw httpError('请至少选择一个角色', 400);
  }

  const nextHasAdmin = roleNames.includes('admin');
  const isDefault = isDefaultAdminUsername(username);

  if (nextHasAdmin && !isDefault) {
    throw httpError('超级管理员角色不可分配', 403);
  }
  if (isDefault && !nextHasAdmin) {
    throw httpError('不能取消默认超级管理员的超管角色', 400);
  }

  for (const role of roleNames) {
    if (role === 'admin' && isDefault) continue;
    if (!ASSIGNABLE_ROLES.includes(role)) {
      throw httpError('无效的角色', 400);
    }
  }
}

function roleIdByName(db, name) {
  const stmt = db.prepare('SELECT id, name, level FROM roles WHERE name = ? AND status = 1');
  stmt.bind([name]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

function loadRoleRows(db, userId) {
  const rows = [];
  const stmt = db.prepare(`
    SELECT r.id, r.name, r.level
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = ? AND r.status = 1
    ORDER BY r.level DESC, r.id ASC
  `);
  stmt.bind([userId]);
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function syncPrimaryRole(db, userId) {
  const rows = loadRoleRows(db, userId);
  let primary = rows[0];
  if (!primary) {
    const fallback = roleIdByName(db, 'viewer');
    primary = fallback || { id: null, name: 'viewer' };
  }
  db.run('UPDATE users SET role = ?, role_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
    primary.name,
    primary.id,
    userId,
  ]);
  return primary;
}

function setUserRoles(db, userId, roleNames) {
  const unique = [...new Set((roleNames || []).filter(Boolean))];
  db.run('DELETE FROM user_roles WHERE user_id = ?', [userId]);
  for (const name of unique) {
    const role = roleIdByName(db, name);
    if (!role) continue;
    db.run('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, role.id]);
  }
  return syncPrimaryRole(db, userId);
}

function countUsersWithRole(db, roleId) {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM user_roles WHERE role_id = ?');
  stmt.bind([roleId]);
  stmt.step();
  const count = stmt.getAsObject().count;
  stmt.free();
  return count;
}

module.exports = {
  DEFAULT_ADMIN_USERNAME,
  ASSIGNABLE_ROLES,
  isDefaultAdminUsername,
  assertAssignableRoles,
  roleIdByName,
  loadRoleRows,
  syncPrimaryRole,
  setUserRoles,
  countUsersWithRole,
};
