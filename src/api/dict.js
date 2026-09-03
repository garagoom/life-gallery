const API_BASE = '/api';
const ACCESS_TOKEN_KEY = 'accessToken';

async function request(url) {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  return await res.json();
}

export function fetchAllDicts() {
  return request(`${API_BASE}/dict`);
}

export function fetchDict(type) {
  return request(`${API_BASE}/dict/${type}`);
}
