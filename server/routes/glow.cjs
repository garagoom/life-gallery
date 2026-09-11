const express = require('express');
const { authMiddleware } = require('../middleware/auth.cjs');
const { requireAnyMenu } = require('../middleware/permission.cjs');
const { rateLimit } = require('../middleware/rateLimit.cjs');
const { buildGlowForecast } = require('../lib/glowScore.cjs');
const { listPresetPlaces, searchGlowPlaces } = require('../lib/glowPlaces.cjs');

const router = express.Router();
const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

const DEFAULT_LAT = 31.2304;
const DEFAULT_LNG = 121.4737;

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  keyFn: (req) => `glow:${req.user?.id || req.ip || 'anon'}`,
});

router.use(authMiddleware, requireAnyMenu('glow', 'home', 'portfolio', 'calendar'), limiter);

function parseCoord(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return Math.round(n * 1e4) / 1e4;
}

async function fetchOpenMeteo(lat, lng) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: [
      'cloud_cover',
      'cloud_cover_low',
      'cloud_cover_mid',
      'cloud_cover_high',
      'visibility',
      'relative_humidity_2m',
      'precipitation_probability',
      'precipitation',
    ].join(','),
    daily: 'sunrise,sunset',
    timezone: 'auto',
    forecast_days: '2',
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12000);
  try {
    const response = await fetch(url, {
      signal: ac.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'life-gallery/1.0 (glow forecast)',
      },
    });
    if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

router.get('/places', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.json({ code: 200, message: 'success', data: listPresetPlaces() });
    }
    const rows = await searchGlowPlaces(q);
    return res.json({ code: 200, message: 'success', data: rows });
  } catch (error) {
    console.error('glow places error:', error);
    return res.status(502).json({
      code: 502,
      message: error.name === 'AbortError' ? '地点搜索超时' : (error.message || '地点搜索失败'),
      data: null,
    });
  }
});

router.get('/forecast', async (req, res) => {
  try {
    const lat = parseCoord(req.query.lat, DEFAULT_LAT, -90, 90);
    const lng = parseCoord(req.query.lng, DEFAULT_LNG, -180, 180);
    const cacheKey = `${lat},${lng}`;
    const hit = cache.get(cacheKey);
    if (hit && hit.expire > Date.now()) {
      return res.json({ code: 200, message: 'success', data: { ...hit.value, cached: true } });
    }

    const forecast = await fetchOpenMeteo(lat, lng);
    const value = {
      ...buildGlowForecast(forecast, new Date()),
      source: 'open-meteo',
      cached: false,
      disclaimer: '预测仅供参考，实际观感受局地天气与视野遮挡影响。',
    };

    cache.set(cacheKey, { value, expire: Date.now() + CACHE_TTL_MS });
    return res.json({ code: 200, message: 'success', data: value });
  } catch (error) {
    console.error('glow forecast error:', error);
    return res.status(502).json({
      code: 502,
      message: error.name === 'AbortError' ? '气象服务超时，请稍后重试' : (error.message || '火烧云预测失败'),
      data: null,
    });
  }
});

module.exports = router;
