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
  roleIdByName,
  loadRoleRows,
  syncPrimaryRole,
  setUserRoles,
  countUsersWithRole,
};
