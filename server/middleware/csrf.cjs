const crypto = require('crypto');
const { CSRF_COOKIE, ACCESS_COOKIE, issueCsrfCookie } = require('./cookies.cjs');
const { getPublicKeyPem } = require('../lib/passwordCrypto.cjs');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function csrfMiddleware(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (!req.path.startsWith('/api')) return next();

  const hasAccessCookie = Boolean(req.cookies?.[ACCESS_COOKIE]);
  const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
  if (hasBearer && !hasAccessCookie && !req.cookies?.[CSRF_COOKIE]) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers['x-csrf-token'];
  if (!safeEqual(cookieToken, headerToken)) {
    return res.status(403).json({ code: 403, message: 'CSRF 校验失败', data: null });
  }
  next();
}

function csrfTokenHandler(req, res) {
  const token = issueCsrfCookie(res, CSRF_TTL_MS);
  res.json({
    code: 200,
    message: 'success',
    data: { csrfToken: token, passwordPublicKey: getPublicKeyPem() },
  });
}

module.exports = { csrfMiddleware, csrfTokenHandler, CSRF_TTL_MS };
