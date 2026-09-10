const { formatAmapTip, formatGeoname, searchLocalCountries } = require('./geoCatalog.cjs');

const AMAP_TIPS = 'https://restapi.amap.com/v3/assistant/inputtips';
const AMAP_GEOCODE = 'https://restapi.amap.com/v3/geocode/geo';
const GEONAMES_SEARCH = 'https://secure.geonames.org/searchJSON';
const UA = 'life-gallery/1.0 (travel planner)';

const searchCache = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function cacheGet(key) {
  const hit = searchCache.get(key);
  if (!hit) return null;
  if (hit.expire < Date.now()) {
    searchCache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  searchCache.set(key, { value, expire: Date.now() + CACHE_TTL_MS });
  return value;
}

async function fetchJson(url, timeoutMs = 8000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: ac.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`http ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

function amapKey() {
  return String(process.env.AMAP_KEY || process.env.AMAP_WEB_KEY || '').trim();
}

function geonamesUser() {
  return String(process.env.GEONAMES_USERNAME || process.env.GEONAMES_USER || '').trim();
}

function dedupeOptions(rows = []) {
  const seen = new Set();
  const options = [];
  for (const row of rows) {
    if (!row?.value || seen.has(row.value)) continue;
    seen.add(row.value);
    options.push(row);
  }
  return options;
}

async function searchAmap(query) {
  const key = amapKey();
  if (!key) return [];
  const tipsUrl = new URL(AMAP_TIPS);
  tipsUrl.searchParams.set('key', key);
  tipsUrl.searchParams.set('keywords', query);
  tipsUrl.searchParams.set('datatype', 'all');
  const payload = await fetchJson(tipsUrl);
  const tips = Array.isArray(payload?.tips) ? payload.tips : [];
  let rows = dedupeOptions(tips.map(formatAmapTip).filter(Boolean));
  if (rows.length) return rows;

  const geoUrl = new URL(AMAP_GEOCODE);
  geoUrl.searchParams.set('key', key);
  geoUrl.searchParams.set('address', query);
  const geo = await fetchJson(geoUrl);
  const geocodes = Array.isArray(geo?.geocodes) ? geo.geocodes : [];
  rows = dedupeOptions(geocodes.map((item) => formatAmapTip({
    name: item.formatted_address || item.city || item.district || query,
    district: [item.country, item.province, item.city].filter(Boolean).join(''),
    address: item.country,
  })).filter(Boolean));
  return rows;
}

async function searchGeonames(query) {
  const username = geonamesUser();
  if (!username) return [];
  const url = new URL(GEONAMES_SEARCH);
  url.searchParams.set('q', query);
  url.searchParams.set('lang', 'zh');
  url.searchParams.set('maxRows', '12');
  url.searchParams.set('username', username);
  url.searchParams.set('style', 'full');
  url.searchParams.set('orderby', 'relevance');
  const payload = await fetchJson(url, 10000);
  if (payload?.status?.message) throw new Error(payload.status.message);
  const geonames = Array.isArray(payload?.geonames) ? payload.geonames : [];
  return dedupeOptions(geonames.map(formatGeoname).filter(Boolean));
}

async function searchPlaces(query, countries = []) {
  const q = String(query || '').trim();
  if (q.length < 1) return [];
  const cacheKey = q.toLowerCase();
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const errors = [];
  if (amapKey()) {
    try {
      const rows = await searchAmap(q);
      if (rows.length) return cacheSet(cacheKey, rows);
    } catch (err) {
      errors.push(err);
    }
  }
  if (geonamesUser()) {
    try {
      const rows = await searchGeonames(q);
      if (rows.length) return cacheSet(cacheKey, rows);
    } catch (err) {
      errors.push(err);
    }
  }

  const local = searchLocalCountries(q, countries);
  if (local.length) return cacheSet(cacheKey, local);
  if (errors.length && !amapKey() && !geonamesUser()) {
    throw errors[0];
  }
  return local;
}

module.exports = {
  searchPlaces,
  searchAmap,
  searchGeonames,
  amapKey,
  geonamesUser,
};
