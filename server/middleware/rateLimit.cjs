function rateLimit({ windowMs, max, keyFn, message = '请求过于频繁，请稍后再试' }) {
  const hits = new Map();

  function prune(now) {
    if (hits.size < 500) return;
    for (const [key, rec] of hits) {
      if (rec.reset < now) hits.delete(key);
    }
  }

  return (req, res, next) => {
    const now = Date.now();
    prune(now);
    const key = keyFn(req);
    let rec = hits.get(key);
    if (!rec || rec.reset < now) {
      rec = { count: 0, reset: now + windowMs };
    }
    rec.count += 1;
    hits.set(key, rec);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - rec.count)));

    if (rec.count > max) {
      return res.status(429).json({ code: 429, message, data: null });
    }
    next();
  };
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  keyFn: (req) => `${clientIp(req)}:${String(req.body?.username || '').toLowerCase()}`,
  message: '登录尝试过多，请 15 分钟后再试',
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyFn: (req) => clientIp(req),
  message: '注册过于频繁，请稍后再试',
});

module.exports = { rateLimit, loginLimiter, registerLimiter };
