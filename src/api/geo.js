import { request, API_BASE } from './client';

const cache = {
  countries: null,
  states: new Map(),
  cities: new Map(),
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

export async function getStates(countryCode) {
  const key = String(countryCode || '').toUpperCase();
  if (cache.states.has(key)) return cache.states.get(key);
  const result = await request(`${API_BASE}/geo/states?country=${encodeURIComponent(key)}`);
  const states = result.data || [];
  cache.states.set(key, states);
  return states;
}

export async function getCities(countryCode, stateCode = '') {
  const country = String(countryCode || '').toUpperCase();
  const state = String(stateCode || '');
  const key = `${country}::${state}`;
  if (cache.cities.has(key)) return cache.cities.get(key);
  const query = new URLSearchParams({ country });
  if (state) query.set('state', state);
  const result = await request(`${API_BASE}/geo/cities?${query.toString()}`);
  const cities = result.data || [];
  cache.cities.set(key, cities);
  return cities;
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
