const UA = 'life-gallery/1.0 (glow places)';
const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search';

const searchCache = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** 常用拍摄地快捷选项（免费，无需检索） */
const PRESET_PLACES = [
  { label: '上海', value: '上海', lat: 31.2304, lng: 121.4737 },
  { label: '北京', value: '北京', lat: 39.9042, lng: 116.4074 },
  { label: '杭州', value: '杭州', lat: 30.2741, lng: 120.1551 },
  { label: '成都', value: '成都', lat: 30.5728, lng: 104.0668 },
  { label: '重庆', value: '重庆', lat: 29.5630, lng: 106.5516 },
  { label: '厦门', value: '厦门', lat: 24.4798, lng: 118.0894 },
  { label: '青岛', value: '青岛', lat: 36.0671, lng: 120.3826 },
  { label: '大理', value: '大理', lat: 25.6065, lng: 100.2679 },
  { label: '丽江', value: '丽江', lat: 26.8550, lng: 100.2270 },
  { label: '三亚', value: '三亚', lat: 18.2528, lng: 109.5119 },
  { label: '香港', value: '香港', lat: 22.3193, lng: 114.1694 },
  { label: '台北', value: '台北', lat: 25.0330, lng: 121.5654 },
  { label: '东京', value: '东京', lat: 35.6762, lng: 139.6503 },
  { label: '大阪', value: '大阪', lat: 34.6937, lng: 135.5023 },
  { label: '京都', value: '京都', lat: 35.0116, lng: 135.7681 },
  { label: '首尔', value: '首尔', lat: 37.5665, lng: 126.9780 },
  { label: '曼谷', value: '曼谷', lat: 13.7563, lng: 100.5018 },
  { label: '清迈', value: '清迈', lat: 18.7883, lng: 98.9853 },
  { label: '新加坡', value: '新加坡', lat: 1.3521, lng: 103.8198 },
  { label: '巴黎', value: '巴黎', lat: 48.8566, lng: 2.3522 },
];

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

function roundCoord(n) {
  return Math.round(Number(n) * 1e4) / 1e4;
}

function formatPlace(row = {}) {
  const name = String(row.name || '').trim();
  if (!name) return null;
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const parts = [row.country, row.admin1, name]
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  // 去重相邻同名
  const unique = [];
  for (const part of parts) {
    if (unique[unique.length - 1] === part) continue;
    unique.push(part);
  }
  const label = unique.join(' / ');
  return {
    label,
    value: `${label}|${roundCoord(lat)},${roundCoord(lng)}`,
    lat: roundCoord(lat),
    lng: roundCoord(lng),
    country: row.country || null,
  };
}

async function searchGlowPlaces(query) {
  const q = String(query || '').trim();
  if (q.length < 1) return PRESET_PLACES.slice(0, 12);

  const local = PRESET_PLACES.filter((item) => item.label.includes(q) || item.value.includes(q));
  const cacheKey = q.toLowerCase();
  const cached = cacheGet(cacheKey);
  if (cached) return dedupePlaces([...local, ...cached]);

  const url = new URL(GEOCODE);
  url.searchParams.set('name', q);
  url.searchParams.set('count', '10');
  url.searchParams.set('language', 'zh');
  url.searchParams.set('format', 'json');

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10000);
  try {
    const response = await fetch(url, {
      signal: ac.signal,
      headers: { Accept: 'application/json', 'User-Agent': UA },
    });
    if (!response.ok) throw new Error(`geocode HTTP ${response.status}`);
    const payload = await response.json();
    const rows = (Array.isArray(payload?.results) ? payload.results : [])
      .map(formatPlace)
      .filter(Boolean);
    cacheSet(cacheKey, rows);
    return dedupePlaces([...local, ...rows]);
  } finally {
    clearTimeout(timer);
  }
}

function dedupePlaces(rows = []) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = `${row.lat},${row.lng}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out.slice(0, 16);
}

function listPresetPlaces() {
  return PRESET_PLACES.map((item) => ({ ...item }));
}

module.exports = {
  PRESET_PLACES,
  searchGlowPlaces,
  listPresetPlaces,
  formatPlace,
};
