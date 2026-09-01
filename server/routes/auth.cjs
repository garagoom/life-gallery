const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb, saveDb } = require('../db.cjs');
const { generateTokens, verifyRefreshToken, authMiddleware, REFRESH_TOKEN_EXPIRES } = require('../middleware/auth.cjs');

const router = express.Router();

// Helper to parse refresh token expiry to days
function parseRefreshTokenExpiry() {
  // Convert '7d' to days
  const match = REFRESH_TOKEN_EXPIRES.match(/^(\d+)([d])$/);
  if (match) {
    return parseInt(match[1]);
  }
  return 7; // default 7 days
}

router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ code: 400, message: '请输入用户名和密码', data: null });
    }
    
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    stmt.bind([username]);
    
    if (!stmt.step()) {
      stmt.free();
      return res.status(401).json({ code: 401, message: '用户名或密码错误', data: null });
    }
    
    const user = stmt.getAsObject();
    stmt.free();
    
    if (user.status === 0) {
      return res.status(403).json({ code: 403, message: '账号已被禁用', data: null });
    }
    
    const isValidPassword = bcrypt.compareSync(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ code: 401, message: '用户名或密码错误', data: null });
    }
    
    // Generate access and refresh tokens
    const { accessToken, refreshToken } = generateTokens(user);
    
    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseRefreshTokenExpiry());
    
    db.run(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, refreshToken, expiresAt.toISOString()]
    );
    
    // Update user's last login time
    db.run('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    saveDb();
    
    res.json({
      code: 200,
      message: '登录成功',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          email: user.email,
          avatar: user.avatar,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ code: 500, message: '登录失败', data: null });
  }
});

router.post('/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ code: 400, message: '请提供刷新令牌', data: null });
    }
    
    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(401).json({ code: 401, message: '无效的刷新令牌', data: null });
    }
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ code: 401, message: '无效的令牌类型', data: null });
    }
    
    const db = getDb();
    
    // Check if refresh token exists in database
    const stmt = db.prepare('SELECT * FROM refresh_tokens WHERE token = ? AND user_id = ?');
    stmt.bind([refreshToken, decoded.id]);
    
    if (!stmt.step()) {
      stmt.free();
      return res.status(401).json({ code: 401, message: '刷新令牌不存在', data: null });
    }
    
    const tokenRecord = stmt.getAsObject();
    stmt.free();
    
    // Check if token is expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      // Delete expired token
      db.run('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
      saveDb();
      return res.status(401).json({ code: 401, message: '刷新令牌已过期', data: null });
    }
    
    // Get user from database
    const userStmt = db.prepare('SELECT * FROM users WHERE id = ?');
    userStmt.bind([decoded.id]);
    
    if (!userStmt.step()) {
      userStmt.free();
      return res.status(404).json({ code: 404, message: '用户不存在', data: null });
    }
    
    const user = userStmt.getAsObject();
    userStmt.free();
    
    if (user.status === 0) {
      return res.status(403).json({ code: 403, message: '账号已被禁用', data: null });
    }
    
    // Generate new tokens
    const newTokens = generateTokens(user);
    
    // Delete old refresh token and store new one
    db.run('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseRefreshTokenExpiry());
    
    db.run(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, newTokens.refreshToken, expiresAt.toISOString()]
    );
    
    saveDb();
    
    res.json({
      code: 200,
      message: '令牌刷新成功',
      data: {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          email: user.email,
          avatar: user.avatar,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ code: 500, message: '刷新令牌失败', data: null });
  }
});

router.post('/logout', authMiddleware, (req, res) => {
  try {
    const { refreshToken } = req.body;
    const db = getDb();
    
    // Delete refresh token from database
    if (refreshToken) {
      db.run('DELETE FROM refresh_tokens WHERE token = ? AND user_id = ?', 
        [refreshToken, req.user.id]);
    } else {
      // Delete all refresh tokens for this user
      db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [req.user.id]);
    }
    
    saveDb();
    
    res.json({ code: 200, message: '退出登录成功', data: null });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ code: 500, message: '退出登录失败', data: null });
  }
});

router.get('/profile', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    stmt.bind([req.user.id]);
    
    if (!stmt.step()) {
      stmt.free();
      return res.status(404).json({ code: 404, message: '用户不存在', data: null });
    }
    
    const user = stmt.getAsObject();
    stmt.free();
    
    res.json({
      code: 200,
      message: 'success',
      data: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        avatar: user.avatar,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ code: 500, message: '获取用户信息失败', data: null });
  }
});

router.put('/profile', authMiddleware, (req, res) => {
  try {
    const { displayName, email } = req.body;
    const db = getDb();
    
    db.run(
      'UPDATE users SET display_name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [displayName || null, email || null, req.user.id]
    );
    saveDb();
    
    res.json({ code: 200, message: '个人信息更新成功', data: null });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ code: 500, message: '更新个人信息失败', data: null });
  }
});

router.put('/password', authMiddleware, (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ code: 400, message: '请输入原密码和新密码', data: null });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ code: 400, message: '新密码至少6位', data: null });
    }
    
    const db = getDb();
    const stmt = db.prepare('SELECT password FROM users WHERE id = ?');
    stmt.bind([req.user.id]);
    stmt.step();
    const user = stmt.getAsObject();
    stmt.free();
    
    if (!bcrypt.compareSync(oldPassword, user.password)) {
      return res.status(400).json({ code: 400, message: '原密码错误', data: null });
    }
    
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.run('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
      [hashedPassword, req.user.id]);
    saveDb();
    
    res.json({ code: 200, message: '密码修改成功', data: null });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ code: 500, message: '修改密码失败', data: null });
  }
});

module.exports = router;
