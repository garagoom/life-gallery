const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { getDb, saveDb } = require('../db.cjs');
const { generateTokens, verifyRefreshToken, verifyAccessToken, authMiddleware, REFRESH_TOKEN_EXPIRES } = require('../middleware/auth.cjs');

const router = express.Router();

const avatarsDir = path.join(__dirname, '..', 'uploads', 'avatars');
fs.mkdirSync(avatarsDir, { recursive: true });

const avatarStorage = multer.memoryStorage();
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('只支持 jpg/png/gif/webp 格式'));
    }
  },
});

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
    const { username, password, force } = req.body;
    
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
    
    // Single session: only conflict if another live session still exists
    if (user.login_session && !force) {
      const activeStmt = db.prepare(
        'SELECT COUNT(*) as count FROM refresh_tokens WHERE user_id = ? AND expires_at > ?'
      );
      activeStmt.bind([user.id, new Date().toISOString()]);
      activeStmt.step();
      const activeCount = activeStmt.getAsObject().count;
      activeStmt.free();

      if (activeCount > 0) {
        return res.status(409).json({
          code: 409,
          message: '该账号已在其他设备登录，是否踢出对方？',
          data: { sessionId: user.login_session }
        });
      }
    }
    
    // Generate new session ID
    const crypto = require('crypto');
    const sessionId = crypto.randomUUID();
    
    // Generate access and refresh tokens
    const { accessToken, refreshToken } = generateTokens(user);
    
    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseRefreshTokenExpiry());
    
    db.run(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, refreshToken, expiresAt.toISOString()]
    );
    
    // Update user: set login_session, clear old refresh tokens if force
    if (force) {
      db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [user.id]);
      db.run(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
        [user.id, refreshToken, expiresAt.toISOString()]
      );
    }
    db.run('UPDATE users SET login_session = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [sessionId, user.id]);
    saveDb();
    
    res.json({
      code: 200,
      message: '登录成功',
      data: {
        accessToken,
        refreshToken,
        sessionId,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          email: user.email,
          avatar: user.avatar,
          gender: user.gender,
          bio: user.bio,
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
    
    // Validate login session — if session was kicked, reject refresh
    const { sessionId } = req.body;
    if (sessionId && user.login_session && user.login_session !== sessionId) {
      db.run('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
      saveDb();
      return res.status(401).json({ code: 401, message: '账号已在其他设备登录，请重新登录', data: null, expired: true });
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
          gender: user.gender,
          bio: user.bio,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ code: 500, message: '刷新令牌失败', data: null });
  }
});

router.post('/logout', (req, res) => {
  try {
    const { refreshToken } = req.body;
    const db = getDb();
    let userId = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = verifyAccessToken(authHeader.split(' ')[1]);
        if (decoded?.type === 'access') userId = decoded.id;
      } catch {
        // access token may already be expired; fall back to refresh token
      }
    }

    if (!userId && refreshToken) {
      const stmt = db.prepare('SELECT user_id FROM refresh_tokens WHERE token = ?');
      stmt.bind([refreshToken]);
      if (stmt.step()) {
        userId = stmt.getAsObject().user_id;
      }
      stmt.free();
    }

    if (userId) {
      db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
      db.run('UPDATE users SET login_session = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
      saveDb();
    }

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
        gender: user.gender,
        bio: user.bio,
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
    const { displayName, email, gender, bio } = req.body;
    const db = getDb();

    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    stmt.bind([req.user.id]);
    if (!stmt.step()) {
      stmt.free();
      return res.status(404).json({ code: 404, message: '用户不存在', data: null });
    }
    const existing = stmt.getAsObject();
    stmt.free();

    db.run(
      'UPDATE users SET display_name = ?, email = ?, gender = ?, bio = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [
        displayName !== undefined ? displayName : existing.display_name,
        email !== undefined ? email : existing.email,
        gender !== undefined ? gender : existing.gender,
        bio !== undefined ? bio : existing.bio,
        req.user.id
      ]
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
    
    if (newPassword.length < 8 || newPassword.length > 20) {
      return res.status(400).json({ code: 400, message: '新密码长度需在8-20个字符之间', data: null });
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

router.post('/avatar', authMiddleware, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ code: 400, message: '请选择图片', data: null });
    }

    const filename = `avatar-${req.user.id}-${Date.now()}.webp`;
    const filepath = path.join(avatarsDir, filename);

    await sharp(req.file.buffer)
      .resize(256, 256, { fit: 'cover' })
      .webp({ quality: 85 })
      .toFile(filepath);

    const avatarUrl = `/uploads/avatars/${filename}`;

    const db = getDb();

    const stmt = db.prepare('SELECT avatar FROM users WHERE id = ?');
    stmt.bind([req.user.id]);
    stmt.step();
    const user = stmt.getAsObject();
    stmt.free();

    if (user.avatar && user.avatar.startsWith('/uploads/avatars/avatar-')) {
      const oldPath = path.join(__dirname, '..', user.avatar);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    db.run('UPDATE users SET avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [avatarUrl, req.user.id]);
    saveDb();

    res.json({ code: 200, message: '头像上传成功', data: { avatar: avatarUrl } });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ code: 500, message: '头像上传失败', data: null });
  }
});

module.exports = router;
