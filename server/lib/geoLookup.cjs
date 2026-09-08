const OpenCC = require('opencc-js');

const toSimplified = OpenCC.Converter({ from: 't', to: 'cn' });
const CJK_RE = /[\u3400-\u9fff]/;
const PHOTON_URL = 'https://photon.komoot.io/api/';
const PHOTON_UA = 'life-gallery/1.0 (travel planner)';

function hasCjk(text) {
  return CJK_RE.test(String(text || ''));
}

function simplify(text) {
  const value = String(text || '').trim();
  if (!value) return '';
  return hasCjk(value) ? toSimplified(value) : value;
}

function normalizePlaceQuery(name) {
  return String(name || '')
    .replace(/[-_]/g, ' ')
    .replace(/\b(ku|shi|ken|gun|mura|machi|cho|prefecture|province|county|district|city|ward|arrondissement)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function photonScore(feature) {
  const props = feature?.properties || {};
  let score = 0;
  if (props.osm_key === 'place') score += 12;
  if (['city', 'district', 'town', 'village', 'county', 'state'].includes(props.type)) score += 8;
  if (hasCjk(props.name)) score += 6;
  if (hasCjk(props.district) || hasCjk(props.city)) score += 3;
  if (['house', 'street'].includes(props.type) || props.osm_key === 'highway' || props.osm_key === 'shop') score -= 20;
  return score;
}

function pickChineseFromPhoton(features = []) {
  const ranked = [...(Array.isArray(features) ? features : [])].sort((a, b) => photonScore(b) - photonScore(a));
  for (const feature of ranked) {
    const props = feature?.properties || {};
    const hit = [props.name, props.district, props.city, props.state].find(hasCjk);
    if (hit) return simplify(hit);
  }
  return '';
}

async function fetchPhoton(item) {
  const query = normalizePlaceQuery(item?.name || item?.native || '');
  if (!query) return '';
  const url = new URL(PHOTON_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '5');
  const lat = Number(item?.latitude);
  const lng = Number(item?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 6000);
  try {
    const response = await fetch(url, {
      signal: ac.signal,
      headers: { 'User-Agent': PHOTON_UA, Accept: 'application/json' },
    });
    if (!response.ok) return '';
    const payload = await response.json();
    return pickChineseFromPhoton(payload?.features);
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

async function mapPool(items, limit, worker) {
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = index;
      index += 1;
      await worker(items[current], current);
    }
  }
  const n = Math.min(Math.max(limit, 1), items.length || 1);
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, () => run()));
}

async function localizePlaces(list = [], { isLeaf } = { isLeaf: true }) {
  const rows = (Array.isArray(list) ? list : []).map((item) => {
    const local = simplify(item?.translations?.['zh-CN'] || item?.translations?.zh || item?.native || '');
    const fallback = simplify(item?.name || '');
    return {
      item,
      label: hasCjk(local) ? local : (hasCjk(fallback) ? fallback : ''),
      fallback: fallback || local,
    };
  });
  const missing = rows.filter((row) => !row.label);
  if (missing.length) {
    await mapPool(missing, 4, async (row) => {
      row.label = await fetchPhoton(row.item);
    });
  }
  return rows
    .map((row) => {
      const label = row.label || row.fallback;
      if (!label) return null;
      return {
        label,
        value: label,
        iso2: row.item?.iso2 || '',
        isLeaf: Boolean(isLeaf),
      };
    })
    .filter(Boolean);
}

module.exports = {
  hasCjk,
  simplify,
  normalizePlaceQuery,
  photonScore,
  pickChineseFromPhoton,
  localizePlaces,
};
