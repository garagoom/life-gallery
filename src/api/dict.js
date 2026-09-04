import { request, API_BASE } from './client';

export function fetchAllDicts() {
  return request(`${API_BASE}/dict`, { allowAnonymous: true });
}

export function fetchDict(type) {
  return request(`${API_BASE}/dict/${type}`, { allowAnonymous: true });
}
