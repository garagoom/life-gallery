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

  const res = await fetch(url, { ...options, headers });
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
          const retryRes = await fetch(url, { ...options, headers });
          isRefreshing = false;
          return await retryRes.json();
        }
      } catch (e) { /* fall through */ }
      isRefreshing = false;
    }
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.location.href = '/login';
    throw new Error(json.message);
  }

  if (json.code === 401) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.location.href = '/login';
    throw new Error(json.message);
  }

  if (json.code >= 400) {
    throw new Error(json.message);
  }

  return json;
}

export async function getPhotos(params = {}) {
  const searchParams = new URLSearchParams();
  
  if (params.category) searchParams.append('category', params.category);
  if (params.title) searchParams.append('title', params.title);
  if (params.dateFrom) searchParams.append('dateFrom', params.dateFrom);
  if (params.dateTo) searchParams.append('dateTo', params.dateTo);
  if (params.page) searchParams.append('page', params.page);
  if (params.pageSize) searchParams.append('pageSize', params.pageSize);
  
  const queryString = searchParams.toString();
  const url = `${API_BASE}/photos${queryString ? '?' + queryString : ''}`;
  
  const result = await request(url);
  return {
    data: result.data || [],
    pagination: result.pagination || { page: 1, pageSize: 20, total: 0, totalPages: 0 }
  };
}

export async function getRandomPhotos(count = 20) {
  const result = await request(`${API_BASE}/photos/random?count=${count}`);
  return {
    data: result.data || [],
    pagination: result.pagination || { total: 0, count: 0 }
  };
}

export async function getPhoto(id) {
  const result = await request(`${API_BASE}/photos/${id}`);
  return result.data;
}

export async function uploadPhoto(formData) {
  const result = await request(`${API_BASE}/photos`, {
    method: 'POST',
    body: formData
  });
  return result.data;
}

export async function updatePhoto(id, data) {
  const result = await request(`${API_BASE}/photos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return result.data;
}

export async function deletePhoto(id) {
  const result = await request(`${API_BASE}/photos/${id}`, {
    method: 'DELETE'
  });
  return result;
}

export async function batchUploadPhotos(formData) {
  const result = await request(`${API_BASE}/photos/batch`, {
    method: 'POST',
    body: formData
  });
  return result;
}

export async function batchDeletePhotos(ids) {
  const result = await request(`${API_BASE}/photos/batch-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  });
  return result;
}
