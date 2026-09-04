const crypto = require('crypto');

const ACCESS_COOKIE = 'lg_access';
const REFRESH_COOKIE = 'lg_refresh';
const SESSION_COOKIE = 'lg_session';
const CSRF_COOKIE = 'lg_csrf';

function isProd() {
  return process.env.NODE_ENV === 'production';
}

function parseCookieHeader(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 1) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}

function cookieMiddleware(req, res, next) {
  req.cookies = parseCookieHeader(req.headers.cookie);
  next();
}

function baseCookieOptions() {
  return {
    secure: isProd(),
    sameSite: isProd() ? 'strict' : 'lax',
  };
}

function setAuthCookies(res, { accessToken, refreshToken, sessionId, accessMaxAgeMs, refreshMaxAgeMs }) {
  const base = baseCookieOptions();
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...base,
    httpOnly: true,
    path: '/',
    maxAge: accessMaxAgeMs,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...base,
    httpOnly: true,
    path: '/api/auth',
    maxAge: refreshMaxAgeMs,
  });
  res.cookie(SESSION_COOKIE, sessionId, {
    ...base,
    httpOnly: true,
    path: '/',
    maxAge: refreshMaxAgeMs,
  });
  issueCsrfCookie(res, refreshMaxAgeMs);
}

function clearAuthCookies(res) {
  const base = baseCookieOptions();
  res.clearCookie(ACCESS_COOKIE, { ...base, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: '/api/auth' });
  res.clearCookie(SESSION_COOKIE, { ...base, path: '/' });
  res.clearCookie(SESSION_COOKIE, { ...base, path: '/api/auth' });
  res.clearCookie(CSRF_COOKIE, { ...base, path: '/' });
}

function issueCsrfCookie(res, maxAgeMs) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE, token, {
    ...baseCookieOptions(),
    httpOnly: false,
    path: '/',
    maxAge: maxAgeMs,
  });
  return token;
}

function getAccessTokenFromRequest(req) {
  const cookieToken = req.cookies?.[ACCESS_COOKIE];
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    return token || null;
  }
  return null;
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SESSION_COOKIE,
  CSRF_COOKIE,
  cookieMiddleware,
  setAuthCookies,
  clearAuthCookies,
  issueCsrfCookie,
  getAccessTokenFromRequest,
  parseCookieHeader,
};
