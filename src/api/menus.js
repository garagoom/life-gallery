import { request, API_BASE } from './client';

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
    body: JSON.stringify(data),
  });
}

export function updateMenu(id, data) {
  return request(`${API_BASE}/menus/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteMenu(id) {
  return request(`${API_BASE}/menus/${id}`, {
    method: 'DELETE',
  });
}
