import { request, API_BASE, noteAccessExpiry, refreshSession, clearLegacyTokens, ensureCsrf } from './client';
import { encryptPassword } from '../utils/encryptPassword';

clearLegacyTokens();

export async function login(username, password, force = false) {
  await ensureCsrf();
  const result = await request(`${API_BASE}/auth/login`, {
    method: 'POST',
    allowAnonymous: true,
    body: JSON.stringify({
      username,
      password: await encryptPassword(password),
      force,
    }),
  });

  if (result.code === 409) {
    return result;
  }

  if (result.data?.expiresIn) {
    noteAccessExpiry(result.data.expiresIn);
  }

  return result.data;
}

export async function register(payload) {
  await ensureCsrf();
  return request(`${API_BASE}/register`, {
    method: 'POST',
    allowAnonymous: true,
    body: JSON.stringify({
      ...payload,
      password: await encryptPassword(payload.password),
    }),
  });
}

export async function getProfile() {
  try {
    const result = await request(`${API_BASE}/auth/profile`, { allowAnonymous: true });
    return result.data || null;
  } catch (error) {
    if (error.reason === 'kicked' || error.reason === 'expired') throw error;
    return null;
  }
}

export async function updateProfile(values) {
  return request(`${API_BASE}/auth/profile`, {
    method: 'PUT',
    body: JSON.stringify(values),
  });
}

export async function changePassword(oldPassword, newPassword) {
  await ensureCsrf();
  const result = await request(`${API_BASE}/auth/password`, {
    method: 'PUT',
    body: JSON.stringify({
      oldPassword: await encryptPassword(oldPassword),
      newPassword: await encryptPassword(newPassword),
    }),
  });
  if (result.data?.expiresIn) {
    noteAccessExpiry(result.data.expiresIn);
  }
  return result;
}

export async function logout() {
  try {
    await request(`${API_BASE}/auth/logout`, {
      method: 'POST',
      body: '{}',
      allowAnonymous: true,
    });
  } catch {
    // ignore
  }
  window.location.href = '/login';
}

export async function refreshToken() {
  const result = await refreshSession();
  return result.data;
}

export { getAccessExpiresAt as getTokenExpiration } from './client';

export async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append('avatar', file);
  const result = await request(`${API_BASE}/auth/avatar`, {
    method: 'POST',
    body: formData,
  });
  return result.data;
}
