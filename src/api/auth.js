const API_BASE = '/api';

// Token storage keys
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const SESSION_ID_KEY = 'sessionId';
const USER_KEY = 'user';

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

async function request(url, options = {}) {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const headers = {
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  
  const res = await fetch(url, { ...options, headers });
  const json = await res.json();
  
  // If token is expired and we're not already refreshing
  if (json.code === 401 && json.expired && !isRefreshing) {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    
    if (!refreshToken) {
      // No refresh token, redirect to login
      clearAuth();
      window.location.href = '/login';
      throw new Error(json.message);
    }
    
    // If we're already refreshing, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(token => {
        // Retry original request with new token
        headers['Authorization'] = `Bearer ${token}`;
        return fetch(url, { ...options, headers }).then(res => res.json());
      });
    }
    
    isRefreshing = true;
    
    try {
      const refreshResult = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken, sessionId: localStorage.getItem(SESSION_ID_KEY) })
      });
      
      const refreshJson = await refreshResult.json();
      
      if (refreshJson.code === 200) {
        // Store new tokens
        localStorage.setItem(ACCESS_TOKEN_KEY, refreshJson.data.accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshJson.data.refreshToken);
        localStorage.setItem(USER_KEY, JSON.stringify(refreshJson.data.user));
        
        // Process queued requests
        processQueue(null, refreshJson.data.accessToken);
        
        // Retry original request with new token
        headers['Authorization'] = `Bearer ${refreshJson.data.accessToken}`;
        const retryRes = await fetch(url, { ...options, headers });
        return await retryRes.json();
      } else {
        // Refresh failed, clear auth and redirect
        processQueue(new Error('Refresh failed'));
        clearAuth();
        window.location.href = '/login';
        throw new Error(refreshJson.message || '令牌刷新失败');
      }
    } catch (error) {
      processQueue(error);
      clearAuth();
      window.location.href = '/login';
      throw error;
    } finally {
      isRefreshing = false;
    }
  }
  
  // Handle other errors
  if (json.code === 401) {
    // Don't redirect if already on login/register page
    if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
      clearAuth();
      window.location.href = '/login';
    }
    throw new Error(json.message);
  }
  
  if (json.code >= 400) {
    throw new Error(json.message);
  }
  
  return json;
}

function clearAuth() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(SESSION_ID_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function login(username, password, force = false) {
  const result = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, force })
  }).then(r => r.json());

  // Session conflict — return 409 for caller to handle
  if (result.code === 409) {
    return result;
  }

  if (result.code !== 200) {
    throw new Error(result.message || '登录失败');
  }

  if (result.data?.accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, result.data.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, result.data.refreshToken);
    localStorage.setItem(SESSION_ID_KEY, result.data.sessionId || '');
    localStorage.setItem(USER_KEY, JSON.stringify(result.data.user));
  }

  return result.data;
}

export async function refreshToken(refreshToken) {
  const result = await request(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    body: JSON.stringify({ refreshToken })
  });
  
  if (result.data?.accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, result.data.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, result.data.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(result.data.user));
  }
  
  return result.data;
}

export async function getProfile() {
  const result = await request(`${API_BASE}/auth/profile`);
  return result.data;
}

export async function changePassword(oldPassword, newPassword) {
  const result = await request(`${API_BASE}/auth/password`, {
    method: 'PUT',
    body: JSON.stringify({ oldPassword, newPassword })
  });
  return result;
}

export async function logout() {
  const refreshTokenValue = localStorage.getItem(REFRESH_TOKEN_KEY);
  
  try {
    await request(`${API_BASE}/auth/logout`, {
      method: 'POST',
      body: JSON.stringify({ refreshToken: refreshTokenValue })
    });
  } catch (error) {
    // Ignore logout errors, just clear local storage
  }
  
  clearAuth();
  window.location.href = '/login';
}

export function getUser() {
  const userStr = localStorage.getItem(USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function isAuthenticated() {
  return !!getAccessToken() && !!getRefreshToken();
}

export function getTokenExpiration() {
  const token = getAccessToken();
  if (!token) return null;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000; // Convert to milliseconds
  } catch {
    return null;
  }
}

export function isTokenExpired() {
  const expiration = getTokenExpiration();
  if (!expiration) return true;
  
  // Add 30 second buffer to prevent edge cases
  return Date.now() >= expiration - 30000;
}

export async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append('avatar', file);
  const result = await request(`${API_BASE}/auth/avatar`, {
    method: 'POST',
    body: formData,
  });
  return result.data;
}
