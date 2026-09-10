const express = require('express');
const { getCountries } = require('@countrystatecity/countries');
const { authMiddleware } = require('../middleware/auth.cjs');
const { requireAnyMenu } = require('../middleware/permission.cjs');
const { rateLimit } = require('../middleware/rateLimit.cjs');
const { mapCountries } = require('../lib/geoCatalog.cjs');
const { searchPlaces } = require('../lib/geoSearch.cjs');

const router = express.Router();
const cache = {
  countries: null,
};

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyFn: (req) => `geo:${req.user?.id || req.ip || 'anon'}`,
});

router.use(authMiddleware, requireAnyMenu('travel_trips', 'travel_budget'), limiter);

function success(res, data) {
  return res.json({ code: 200, message: 'success', data });
}

function error(res, message = '地理数据读取失败', code = 500) {
  return res.status(code).json({ code, message, data: null });
}

async function loadCountries() {
  if (!cache.countries) {
    cache.countries = mapCountries(await getCountries());
  }
  return cache.countries;
}

router.get('/countries', async (req, res) => {
  try {
    return success(res, await loadCountries());
  } catch (err) {
    return error(res, err.message || '国家列表读取失败');
  }
});

router.get('/search', async (req, res) => {
  const query = String(req.query.q || req.query.query || '').trim();
  if (!query) return success(res, []);
  try {
    const countries = await loadCountries();
    return success(res, await searchPlaces(query, countries));
  } catch (err) {
    return error(res, err.message || '地点搜索失败');
  }
});

module.exports = router;
