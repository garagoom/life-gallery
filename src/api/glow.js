import { request, API_BASE } from './client';

export async function getGlowForecast({ lat, lng } = {}) {
  const params = new URLSearchParams();
  if (lat != null) params.set('lat', String(lat));
  if (lng != null) params.set('lng', String(lng));
  const qs = params.toString();
  const result = await request(`${API_BASE}/glow/forecast${qs ? `?${qs}` : ''}`);
  return result.data;
}

export async function searchGlowPlaces(query = '') {
  const q = String(query || '').trim();
  const url = q
    ? `${API_BASE}/glow/places?q=${encodeURIComponent(q)}`
    : `${API_BASE}/glow/places`;
  const result = await request(url);
  return result.data || [];
}
