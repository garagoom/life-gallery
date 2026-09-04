const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const { getDb, saveDb } = require('../db.cjs');
const {
  generateTokens,
  verifyRefreshToken,
  verifyAccessToken,
  authMiddleware,
  publicUser,
  ACCESS_MAX_AGE_MS,
  REFRESH_MAX_AGE_MS,
  REFRESH_TOKEN_EXPIRES,
} = require('../middleware/auth.cjs');
const {
  REFRESH_COOKIE,
  SESSION_COOKIE,
  setAuthCookies,
  clearAuthCookies,
  getAccessTokenFromRequest,
} = require('../middleware/cookies.cjs');
const { csrfTokenHandler } = require('../middleware/csrf.cjs');
const { loginLimiter } = require('../middleware/rateLimit.cjs');
const {
  revokeUserSessions,
  findRefreshRecord,
  storeRefreshToken,
  deleteRefreshRecord,
} = require('../lib/session.cjs');
const { unwrapPassword } = require('../lib/passwordCrypto.cjs');

const router = express.Router();

const avatarsDir = path.join(__dirname, '..', 'uploads', 'avatars');
fs.mkdirSync(avatarsDir, { recursive: true });

const WEAK_PASSWORDS = new Set(['admin123']);

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExt = /\.(jpg|jpeg|png|gif|webp)$/i;
    const allowedMime = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedExt.test(path.extname(file.originalname)) && allowedMime.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 jpg/png/gif/webp 格式'));
    }
  },
});

function parseRefreshTokenExpiryDays() {
  const match = String(REFRESH_TOKEN_EXPIRES).match(/^(\d+)d$/);
  return match ? parseInt(match[1], 10) : 7;
}

function refreshExpiresAt() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + parseRefreshTokenExpiryDays());
  return expiresAt.toISOString();
}

function issueSession(res, user) {
  const sessionId = crypto.randomUUID();
  const { accessToken, refreshToken } = generateTokens(user);
  const db = getDb();
  db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [user.id]);
  db.run('UPDATE users SET login_session = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [sessionId, user.id]);
  storeRefreshToken(user.id, refreshToken, refreshExpiresAt());
  saveDb();
  setAuthCookies(res, {
    accessToken,
    refreshToken,
    sessionId,
    accessMaxAgeMs: ACCESS_MAX_AGE_MS,
    refreshMaxAgeMs: REFRESH_MAX_AGE_MS,
  });
  return { sessionId, expiresIn: Math.floor(ACCESS_MAX_AGE_MS / 1000) };
}

router.get('/csrf', csrfTokenHandler);

router.post('/login', loginLimiter, (req, res) => {
  try {
    const { username, force } = req.body;
    let password;
    try {
      password = unwrapPassword(req.body.password);
    } catch (err) {
      return res.status(400).json({ code: 400, message: err.message || '请输入用户名和密码', data: null });
    }

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

    if (WEAK_PASSWORDS.has(password) || Number(user.must_change_password) === 1) {
      db.run('UPDATE users SET must_change_password = 1 WHERE id = ?', [user.id]);
      user.must_change_password = 1;
    }

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
          data: null,
        });
      }
    }

    const { expiresIn } = issueSession(res, user);

    res.json({
      code: 200,
      message: '登录成功',
      data: {
        expiresIn,
        user: publicUser(user),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ code: 500, message: '登录失败', data: null });
  }
});

router.post('/refresh', (req, res) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
    const sessionId = req.cookies?.[SESSION_COOKIE] || req.body?.sessionId;

    if (!refreshToken) {
      return res.status(401).json({
        code: 401,
        message: '登录已过期，请重新登录',
        data: null,
        expired: true,
        reason: 'expired',
      });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      return res.status(401).json({
        code: 401,
        message: '登录已过期，请重新登录',
        data: null,
        expired: true,
        reason: 'expired',
      });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        code: 401,
        message: '登录已过期，请重新登录',
        data: null,
        expired: true,
        reason: 'expired',
      });
    }

    const tokenRecord = findRefreshRecord(refreshToken);
    if (!tokenRecord || tokenRecord.user_id !== decoded.id) {
      return res.status(401).json({
        code: 401,
        message: '登录已过期，请重新登录',
        data: null,
        expired: true,
        reason: 'expired',
      });
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      deleteRefreshRecord(refreshToken);
      saveDb();
      return res.status(401).json({
        code: 401,
        message: '登录已过期，请重新登录',
        data: null,
        expired: true,
        reason: 'expired',
      });
    }

    const db = getDb();
    const userStmt = db.prepare('SELECT * FROM users WHERE id = ?');
    userStmt.bind([decoded.id]);

    if (!userStmt.step()) {
      userStmt.free();
      return res.status(404).json({ code: 404, message: '用户不存在', data: null });
    }

    const user = userStmt.getAsObject();
    userStmt.free();

    if (user.status === 0) {
      revokeUserSessions(user.id);
      clearAuthCookies(res);
      return res.status(403).json({ code: 403, message: '账号已被禁用', data: null });
    }

    if (!sessionId || !user.login_session || user.login_session !== sessionId) {
      deleteRefreshRecord(refreshToken);
      saveDb();
      clearAuthCookies(res);
      return res.status(401).json({
        code: 401,
        message: '账号已在其他设备登录，请重新登录',
        data: null,
        reason: 'kicked',
      });
    }

    deleteRefreshRecord(refreshToken);
    const { expiresIn } = issueSession(res, user);

    res.json({
      code: 200,
      message: '令牌刷新成功',
      data: {
        expiresIn,
        user: publicUser(user),
      },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ code: 500, message: '刷新令牌失败', data: null });
  }
});

router.post('/logout', (req, res) => {
  try {
    const db = getDb();
    let userId = null;

    const accessToken = getAccessTokenFromRequest(req);
    if (accessToken) {
      try {
        const decoded = verifyAccessToken(accessToken);
        if (decoded?.type === 'access') userId = decoded.id;
      } catch {
        // access may already be expired
      }
    }

    if (!userId) {
      const refreshToken = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
      if (refreshToken) {
        const record = findRefreshRecord(refreshToken);
        if (record) userId = record.user_id;
      }
    }

    if (userId) {
      revokeUserSessions(userId);
    }

    clearAuthCookies(res);
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
      data: publicUser(user),
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
        req.user.id,
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
    let oldPassword;
    let newPassword;
    try {
      oldPassword = unwrapPassword(req.body.oldPassword, '原密码');
      newPassword = unwrapPassword(req.body.newPassword, '新密码');
    } catch (err) {
      return res.status(400).json({ code: 400, message: err.message, data: null });
    }

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ code: 400, message: '请输入原密码和新密码', data: null });
    }

    if (newPassword.length < 8 || newPassword.length > 20) {
      return res.status(400).json({ code: 400, message: '新密码长度需在8-20个字符之间', data: null });
    }

    if (WEAK_PASSWORDS.has(newPassword)) {
      return res.status(400).json({ code: 400, message: '新密码过于简单，请更换', data: null });
    }

    const db = getDb();
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    stmt.bind([req.user.id]);
    stmt.step();
    const user = stmt.getAsObject();
    stmt.free();

    if (!bcrypt.compareSync(oldPassword, user.password)) {
      return res.status(400).json({ code: 400, message: '原密码错误', data: null });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.run(
      'UPDATE users SET password = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, req.user.id]
    );
    db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [req.user.id]);
    const { expiresIn } = issueSession(res, { ...user, must_change_password: 0 });

    res.json({
      code: 200,
      message: '密码修改成功',
      data: { expiresIn, user: publicUser({ ...user, must_change_password: 0 }) },
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ code: 500, message: '修改密码失败', data: null });
  }
});

router.post('/avatar', authMiddleware, (req, res, next) => {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? '图片过大，最大 20MB' : (err.message || '上传失败');
      return res.status(400).json({ code: 400, message, data: null });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ code: 400, message: '请选择图片', data: null });
    }

    const filename = `avatar-${req.user.id}-${Date.now()}.webp`;
    const filepath = path.join(avatarsDir, filename);

    await sharp(req.file.buffer)
      .rotate()
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
