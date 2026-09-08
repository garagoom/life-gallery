const express = require('express');
const { getCurrencies } = require('@countrystatecity/currencies');
const { authMiddleware } = require('../middleware/auth.cjs');
const { requireAnyMenu } = require('../middleware/permission.cjs');
const { rateLimit } = require('../middleware/rateLimit.cjs');
const { mapCurrencies, parseFrankfurterRate, isCurrencyCode } = require('../lib/fxCatalog.cjs');

const router = express.Router();
let currencyCache = null;
const rateCache = new Map();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyFn: (req) => `fx:${req.user?.id || req.ip || 'anon'}`,
});

router.use(authMiddleware, requireAnyMenu('travel_trips', 'travel_budget'), limiter);

async function fetchJson(url, timeoutMs = 8000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: ac.signal,
      headers: { 'User-Agent': 'life-gallery/1.0 (travel planner)', Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`http ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function quoteRate(from, to, date) {
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : 'latest';
  const cacheKey = `${from}|${to}|${day}`;
  const hit = rateCache.get(cacheKey);
  if (hit && hit.expire > Date.now()) return hit.value;

  const frankfurterUrl = day === 'latest'
    ? `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    : `https://api.frankfurter.app/${day}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  let value;
  try {
    const payload = await fetchJson(frankfurterUrl);
    const rate = parseFrankfurterRate(payload, to);
    if (rate == null) throw new Error('empty');
    value = { rate, date: payload.date || new Date().toISOString().slice(0, 10) };
  } catch {
    const payload = await fetchJson(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`);
    const rate = Number(payload?.rates?.[to]);
    if (!Number.isFinite(rate)) throw new Error('获取汇率失败');
    const quotedAt = payload?.time_last_update_utc
      ? new Date(payload.time_last_update_utc).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    value = { rate, date: quotedAt };
  }

  rateCache.set(cacheKey, { value, expire: Date.now() + 60 * 60 * 1000 });
  return value;
}

router.get('/currencies', async (req, res) => {
  try {
    if (!currencyCache) {
      currencyCache = mapCurrencies(await getCurrencies());
    }
    res.json({ code: 200, message: 'success', data: currencyCache });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message || '货币列表读取失败', data: null });
  }
});

router.get('/rate', async (req, res) => {
  const from = String(req.query.from || '').trim().toUpperCase();
  const to = String(req.query.to || '').trim().toUpperCase();
  const date = String(req.query.date || '').trim();
  if (!isCurrencyCode(from) || !isCurrencyCode(to)) {
    return res.status(400).json({ code: 400, message: '货币代码无效', data: null });
  }
  if (from === to) {
    return res.json({
      code: 200,
      message: 'success',
      data: { rate: 1, date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10) },
    });
  }
  try {
    const data = await quoteRate(from, to, date);
    res.json({ code: 200, message: 'success', data });
  } catch (error) {
    res.status(502).json({ code: 502, message: error.message || '获取汇率失败', data: null });
  }
});

module.exports = router;
