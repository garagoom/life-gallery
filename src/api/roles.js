import { request, API_BASE } from './client';

export function getRoles() {
  return request(`${API_BASE}/roles`);
}

export function getRole(id) {
  return request(`${API_BASE}/roles/${id}`);
}

export function createRole(data) {
  return request(`${API_BASE}/roles`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateRole(id, data) {
  return request(`${API_BASE}/roles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteRole(id) {
  return request(`${API_BASE}/roles/${id}`, {
    method: 'DELETE',
  });
}
