const express = require('express');
const { getCountries, getStatesOfCountry, getCitiesOfState, getAllCitiesOfCountry } = require('@countrystatecity/countries');
const { getTranslations } = require('@countrystatecity/translations');
const { authMiddleware } = require('../middleware/auth.cjs');
const { requireAnyMenu } = require('../middleware/permission.cjs');
const { rateLimit } = require('../middleware/rateLimit.cjs');
const { isCountryCode, isStateCode, translationMap, mapCountries } = require('../lib/geoCatalog.cjs');
const { localizePlaces } = require('../lib/geoLookup.cjs');

const router = express.Router();
const cache = {
  countries: null,
  states: new Map(),
  cities: new Map(),
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

function normalizeCountry(value) {
  const code = String(value || '').trim().toUpperCase();
  return isCountryCode(code) ? code : '';
}

function normalizeState(value) {
  const code = String(value || '').trim();
  return isStateCode(code) ? code : '';
}

router.get('/countries', async (req, res) => {
  try {
    if (!cache.countries) {
      const [countries, translations] = await Promise.all([getCountries(), getTranslations()]);
      cache.countries = mapCountries(countries, translationMap(translations));
    }
    return success(res, cache.countries);
  } catch (err) {
    return error(res, err.message || '国家列表读取失败');
  }
});

router.get('/states', async (req, res) => {
  const country = normalizeCountry(req.query.country);
  if (!country) return error(res, '国家代码无效', 400);
  try {
    if (!cache.states.has(country)) {
      const states = await getStatesOfCountry(country);
      cache.states.set(country, await localizePlaces(states, { isLeaf: false }));
    }
    return success(res, cache.states.get(country) || []);
  } catch (err) {
    return error(res, err.message || '地区列表读取失败');
  }
});

router.get('/cities', async (req, res) => {
  const country = normalizeCountry(req.query.country);
  const state = normalizeState(req.query.state);
  if (!country) return error(res, '国家代码无效', 400);
  const key = `${country}::${state}`;
  try {
    if (!cache.cities.has(key)) {
      const cities = state
        ? await getCitiesOfState(country, state)
        : await getAllCitiesOfCountry(country);
      cache.cities.set(key, await localizePlaces(cities, { isLeaf: true }));
    }
    return success(res, cache.cities.get(key) || []);
  } catch (err) {
    return error(res, err.message || '城市列表读取失败');
  }
});

module.exports = router;
