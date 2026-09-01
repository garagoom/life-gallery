const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'photography-portfolio-secret-key';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'photography-portfolio-refresh-secret-key';

// Token expiration times
const ACCESS_TOKEN_EXPIRES = '15m';  // 15 minutes
const REFRESH_TOKEN_EXPIRES = '7d';  // 7 days

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

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '请先登录', data: null });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = verifyAccessToken(token);
    if (decoded.type !== 'access') {
      return res.status(401).json({ code: 401, message: '无效的访问令牌', data: null });
    }
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 401, message: '令牌已过期', data: null, expired: true });
    }
    return res.status(401).json({ code: 401, message: '登录已过期，请重新登录', data: null });
  }
}

module.exports = { 
  generateTokens, 
  verifyAccessToken, 
  verifyRefreshToken, 
  authMiddleware, 
  JWT_SECRET, 
  REFRESH_SECRET,
  ACCESS_TOKEN_EXPIRES,
  REFRESH_TOKEN_EXPIRES
};
