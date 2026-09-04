const crypto = require('crypto');
const { getDb, saveDb } = require('../db.cjs');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function revokeUserSessions(userId) {
  const db = getDb();
  db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
  db.run('UPDATE users SET login_session = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
  saveDb();
}

function findRefreshRecord(rawToken) {
  const db = getDb();
  const hashed = hashToken(rawToken);

  const hashedStmt = db.prepare('SELECT * FROM refresh_tokens WHERE token = ?');
  hashedStmt.bind([hashed]);
  if (hashedStmt.step()) {
    const row = hashedStmt.getAsObject();
    hashedStmt.free();
    return row;
  }
  hashedStmt.free();

  const legacyStmt = db.prepare('SELECT * FROM refresh_tokens WHERE token = ?');
  legacyStmt.bind([rawToken]);
  if (legacyStmt.step()) {
    const row = legacyStmt.getAsObject();
    legacyStmt.free();
    return row;
  }
  legacyStmt.free();
  return null;
}

function storeRefreshToken(userId, rawToken, expiresAtIso) {
  const db = getDb();
  db.run(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    [userId, hashToken(rawToken), expiresAtIso]
  );
}

function deleteRefreshRecord(rawToken) {
  const db = getDb();
  const hashed = hashToken(rawToken);
  db.run('DELETE FROM refresh_tokens WHERE token = ? OR token = ?', [hashed, rawToken]);
}

module.exports = {
  hashToken,
  revokeUserSessions,
  findRefreshRecord,
  storeRefreshToken,
  deleteRefreshRecord,
};
