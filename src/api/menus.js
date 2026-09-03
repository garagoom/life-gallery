const API_BASE = '/api';
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

let isRefreshing = false;

async function request(url, options = {}) {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const headers = { ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { cache: 'no-store', ...options, headers });
  const json = await res.json();

  if (json.code === 401 && json.expired && !isRefreshing) {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
        const refreshJson = await refreshRes.json();
        if (refreshJson.code === 200) {
          localStorage.setItem(ACCESS_TOKEN_KEY, refreshJson.data.accessToken);
          localStorage.setItem(REFRESH_TOKEN_KEY, refreshJson.data.refreshToken);
          headers['Authorization'] = `Bearer ${refreshJson.data.accessToken}`;
          const retryRes = await fetch(url, { cache: 'no-store', ...options, headers });
          return await retryRes.json();
        }
      } catch {}
      isRefreshing = false;
    }
    if (window.location.pathname !== '/login') {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      window.location.href = '/login';
    }
  }

  return json;
}

export function getMyMenus() {
  return request(`${API_BASE}/menus/my`);
}

export function getAllMenus() {
  return request(`${API_BASE}/menus`);
}

export function getFlatMenus() {
  return request(`${API_BASE}/menus/flat`);
}

export function createMenu(data) {
  return request(`${API_BASE}/menus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateMenu(id, data) {
  return request(`${API_BASE}/menus/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteMenu(id) {
  return request(`${API_BASE}/menus/${id}`, {
    method: 'DELETE',
  });
}
