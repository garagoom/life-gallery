import { request, API_BASE } from './client';

function withQuery(url, params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.append(key, String(value));
  });
  const query = search.toString();
  return query ? `${url}?${query}` : url;
}

export async function getShoppingLists(params = {}) {
  const result = await request(withQuery(`${API_BASE}/shopping`, { ...params, _: Date.now() }));
  return {
    data: result.data || [],
    pagination: result.pagination || { page: 1, pageSize: 10, total: 0, totalPages: 0 },
  };
}

export async function getShoppingList(id) {
  const result = await request(`${API_BASE}/shopping/${id}`);
  return result.data;
}

export async function createShoppingList(data) {
  const result = await request(`${API_BASE}/shopping`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function updateShoppingList(id, data) {
  const result = await request(`${API_BASE}/shopping/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function deleteShoppingList(id) {
  return request(`${API_BASE}/shopping/${id}`, { method: 'DELETE' });
}

export async function saveShoppingItems(id, items, extra = {}) {
  const result = await request(`${API_BASE}/shopping/${id}/items`, {
    method: 'PUT',
    body: JSON.stringify({ items, ...extra }),
  });
  return result.data;
}
