import { request, API_BASE } from './client';

const cache = {
  countries: null,
};

export function joinDestination(paths = []) {
  return paths
    .map((path) => (Array.isArray(path) ? path.filter(Boolean).join(' / ') : ''))
    .filter(Boolean)
    .join(' · ');
}

export function splitDestination(text) {
  if (!text) return [];
  return String(text)
    .split(/\s*·\s*/)
    .map((part) => part.split(/\s*\/\s*/).map((item) => item.trim()).filter(Boolean))
    .filter((path) => path.length);
}

export async function getCountries() {
  if (cache.countries) return cache.countries;
  const result = await request(`${API_BASE}/geo/countries`);
  cache.countries = result.data || [];
  return cache.countries;
}

export async function searchPlaces(query) {
  const q = String(query || '').trim();
  if (!q) return [];
  const result = await request(`${API_BASE}/geo/search?q=${encodeURIComponent(q)}`);
  return result.data || [];
}

export function guessCurrencyFromDestination(text, countries = []) {
  const raw = String(text || '');
  if (!raw) return '';
  const hit = countries.find((item) => (
    raw.includes(item.label)
    || raw.includes(item.englishName)
    || raw.includes(item.value)
    || raw.includes(item.code)
  ));
  return hit?.currencies?.[0] || '';
}
