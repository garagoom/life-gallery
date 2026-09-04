const jwt = require('jsonwebtoken');
const { getDb } = require('../db.cjs');
const { getAccessTokenFromRequest, ACCESS_COOKIE, SESSION_COOKIE } = require('./cookies.cjs');

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

if (!JWT_SECRET || !REFRESH_SECRET) {
  console.error('FATAL: JWT_SECRET and REFRESH_SECRET environment variables are required!');
  process.exit(1);
}

const ACCESS_TOKEN_EXPIRES = '15m';
const REFRESH_TOKEN_EXPIRES = '7d';

function parseDurationToMs(str) {
  const match = String(str).match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60 * 1000;
  const n = parseInt(match[1], 10);
  const unit = { s: 1000, m: 60 * 1000, h: 3600 * 1000, d: 86400 * 1000 };
  return n * (unit[match[2]] || 1000);
}

const ACCESS_MAX_AGE_MS = parseDurationToMs(ACCESS_TOKEN_EXPIRES);
const REFRESH_MAX_AGE_MS = parseDurationToMs(REFRESH_TOKEN_EXPIRES);

function generateTokens(user) {
  const accessToken = jwt.sign(
    { id: user.id, username: user.username, role: user.role, type: 'access' },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES }
  );

  const refreshToken = jwt.sign(
    { id: user.id, username: user.username, type: 'refresh' },
    REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES }
  );

  return { accessToken, refreshToken };
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

function attachDbUser(decoded) {
  const db = getDb();
  if (!db) {
    return {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role || 'viewer',
      role_id: decoded.role_id || null,
      status: 1,
      mustChangePassword: false,
    };
  }
  const stmt = db.prepare(
    'SELECT id, username, role, role_id, status, must_change_password, login_session FROM users WHERE id = ?'
  );
  stmt.bind([decoded.id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject();
  stmt.free();
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    role_id: row.role_id,
    status: row.status,
    loginSession: row.login_session || null,
    mustChangePassword: Number(row.must_change_password) === 1,
  };
}

function isMustChangeAllowed(req) {
  const route = `${req.method} ${req.baseUrl || ''}${req.path || ''}`;
  return (
    route === 'GET /api/auth/profile' ||
    route === 'PUT /api/auth/password' ||
    route === 'POST /api/auth/logout'
  );
}

function applyUserToRequest(req, decoded, { enforceMustChange = true, enforceSession = true } = {}) {
  const dbUser = attachDbUser(decoded);
  if (!dbUser) {
    return { error: { status: 401, body: { code: 401, message: '用户不存在', data: null } } };
  }
  if (dbUser.status === 0) {
    return { error: { status: 403, body: { code: 403, message: '账号已被禁用', data: null } } };
  }
  const usingAccessCookie = Boolean(req.cookies?.[ACCESS_COOKIE]);
  if (enforceSession && usingAccessCookie) {
    const sessionId = req.cookies?.[SESSION_COOKIE];
    if (!sessionId || !dbUser.loginSession || sessionId !== dbUser.loginSession) {
      return {
        error: {
          status: 401,
          body: {
            code: 401,
            message: '账号已在其他设备登录，请重新登录',
            data: null,
            reason: 'kicked',
          },
        },
      };
    }
  }
  if (enforceMustChange && dbUser.mustChangePassword && !isMustChangeAllowed(req)) {
    return {
      error: {
        status: 403,
        body: { code: 403, message: '请先修改初始密码', data: null, mustChangePassword: true },
      },
    };
  }
  req.user = dbUser;
  return { ok: true };
}

function readAccessPayload(req) {
  const token = getAccessTokenFromRequest(req);
  if (!token) return { missing: true };
  try {
    const decoded = verifyAccessToken(token);
    if (decoded.type !== 'access') {
      return { invalid: true, message: '无效的访问令牌' };
    }
    return { decoded };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { expired: true };
    }
    return { invalid: true, message: '登录已过期，请重新登录' };
  }
}

function authMiddleware(req, res, next) {
  const result = readAccessPayload(req);
  if (result.missing) {
    return res.status(401).json({ code: 401, message: '请先登录', data: null });
  }
  if (result.expired) {
    return res.status(401).json({
      code: 401,
      message: '登录已过期，请重新登录',
      data: null,
      expired: true,
      reason: 'expired',
    });
  }
  if (result.invalid) {
    return res.status(401).json({ code: 401, message: result.message, data: null });
  }

  const applied = applyUserToRequest(req, result.decoded);
  if (applied.error) {
    return res.status(applied.error.status).json(applied.error.body);
  }
  next();
}

function optionalAuth(req, res, next) {
  const result = readAccessPayload(req);
  if (result.decoded) {
    applyUserToRequest(req, result.decoded, { enforceMustChange: false, enforceSession: false });
  }
  next();
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    email: user.email,
    avatar: user.avatar,
    gender: user.gender,
    bio: user.bio,
    role: user.role,
    mustChangePassword: Number(user.must_change_password) === 1,
  };
}

module.exports = {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  authMiddleware,
  optionalAuth,
  publicUser,
  JWT_SECRET,
  REFRESH_SECRET,
  ACCESS_TOKEN_EXPIRES,
  REFRESH_TOKEN_EXPIRES,
  ACCESS_MAX_AGE_MS,
  REFRESH_MAX_AGE_MS,
};
