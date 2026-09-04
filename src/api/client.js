import { setPasswordPublicKey } from '../utils/encryptPassword';

const CSRF_COOKIE = 'lg_csrf';
const API_BASE = '/api';
const AUTH_NOTICE_KEY = 'authNotice';

let isRefreshing = false;
let failedQueue = [];
let accessExpiresAt = 0;
let publicKeyReady = false;
let csrfBootstrap = null;

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function processQueue(error) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve();
  });
  failedQueue = [];
}

export function redirectToLogin(reason) {
  if (reason === 'kicked' || reason === 'expired') {
    try {
      sessionStorage.setItem(AUTH_NOTICE_KEY, reason);
    } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('auth-notice', { detail: reason }));
  }
  const path = window.location.pathname;
  if (path.startsWith('/login') || path.startsWith('/register')) return;
  const query = reason === 'kicked' || reason === 'expired' ? `?notice=${reason}` : '';
  window.location.href = `/login${query}`;
}

export function consumeAuthNotice() {
  let notice = null;
  try {
    notice = sessionStorage.getItem(AUTH_NOTICE_KEY);
    sessionStorage.removeItem(AUTH_NOTICE_KEY);
  } catch { /* ignore */ }
  if (notice === 'kicked' || notice === 'expired') return notice;
  return null;
}

export function noteAccessExpiry(expiresInSeconds) {
  const seconds = Number(expiresInSeconds) || 15 * 60;
  accessExpiresAt = Date.now() + seconds * 1000;
}

export function getAccessExpiresAt() {
  return accessExpiresAt || null;
}

export function clearLegacyTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('sessionId');
  localStorage.removeItem('user');
}

export async function ensureCsrf() {
  if (readCookie(CSRF_COOKIE) && publicKeyReady) return;
  if (!csrfBootstrap) {
    csrfBootstrap = (async () => {
      const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include', cache: 'no-store' });
      const json = await res.json();
      if (json?.data?.passwordPublicKey) {
        setPasswordPublicKey(json.data.passwordPublicKey);
      }
      publicKeyReady = true;
      return json?.data;
    })().finally(() => {
      csrfBootstrap = null;
    });
  }
  return csrfBootstrap;
}

function buildHeaders(options = {}) {
  const headers = { ...options.headers };
  const csrf = readCookie(CSRF_COOKIE);
  if (csrf) headers['X-CSRF-Token'] = csrf;
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

async function parseJson(res) {
  const text = await res.text();
  if (!text) return { code: res.status, message: res.statusText || '请求失败', data: null };
  try {
    return JSON.parse(text);
  } catch {
    return { code: res.status, message: '响应解析失败', data: null };
  }
}

async function doRefresh() {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: buildHeaders({ headers: { 'Content-Type': 'application/json' } }),
    body: '{}',
  });
  const json = await parseJson(res);
  if (json.code === 200) {
    if (json.data?.expiresIn) noteAccessExpiry(json.data.expiresIn);
    return json;
  }
  const error = new Error(json.message || '令牌刷新失败');
  error.reason = json.reason === 'kicked' ? 'kicked' : 'expired';
  throw error;
}

export async function request(url, options = {}) {
  await ensureCsrf();
  const headers = buildHeaders(options);
  const res = await fetch(url, {
    cache: 'no-store',
    ...options,
    credentials: 'include',
    headers,
  });
  const json = await parseJson(res);

  if (json.code === 401 && json.reason === 'kicked') {
    if (!options.allowAnonymous) {
      redirectToLogin('kicked');
    }
    const error = new Error(json.message || '账号已在其他设备登录，请重新登录');
    error.reason = 'kicked';
    throw error;
  }

  if (json.code === 401 && json.expired && !options.skipRefresh) {
    if (isRefreshing) {
      await new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      });
      return request(url, { ...options, skipRefresh: true });
    }

    isRefreshing = true;
    try {
      await doRefresh();
      processQueue(null);
      return request(url, { ...options, skipRefresh: true });
    } catch (error) {
      processQueue(error);
      if (!options.allowAnonymous) {
        redirectToLogin(error.reason === 'kicked' ? 'kicked' : 'expired');
      }
      throw error;
    } finally {
      isRefreshing = false;
    }
  }

  if (json.code === 401) {
    if (!options.allowAnonymous) {
      redirectToLogin(json.reason === 'expired' ? 'expired' : undefined);
    }
    throw new Error(json.message || '请先登录');
  }

  if (json.code === 409) {
    return json;
  }

  if (json.code >= 400) {
    throw new Error(json.message || '请求失败');
  }

  return json;
}

export async function refreshSession() {
  await ensureCsrf();
  return doRefresh();
}

export { API_BASE };
