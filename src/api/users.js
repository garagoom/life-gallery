import { request, API_BASE } from './client';
import { encryptPassword } from '../utils/encryptPassword';
import { ensureCsrf } from './client';

export async function getUsers({ page = 1, pageSize = 20 } = {}) {
  const result = await request(`${API_BASE}/users?page=${page}&pageSize=${pageSize}`);
  return {
    data: result?.data || [],
    pagination: result?.pagination || { page, pageSize, total: 0, totalPages: 0 }
  };
}

export async function createUser(data) {
  await ensureCsrf();
  return request(`${API_BASE}/users`, {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      password: data.password ? await encryptPassword(data.password) : data.password,
    }),
  });
}

export async function updateUser(id, data) {
  return request(`${API_BASE}/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function updateUserStatus(id, status) {
  return request(`${API_BASE}/users/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export async function deleteUser(id) {
  return request(`${API_BASE}/users/${id}`, {
    method: 'DELETE',
  });
}
