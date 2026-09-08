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

export async function getTrips(params = {}) {
  const result = await request(withQuery(`${API_BASE}/trips`, { ...params, _: Date.now() }));
  return {
    data: result.data || [],
    pagination: result.pagination || { page: 1, pageSize: 10, total: 0, totalPages: 0 },
  };
}

export async function getTrip(id) {
  const result = await request(`${API_BASE}/trips/${id}`);
  return result.data;
}

export async function createTrip(data) {
  const result = await request(`${API_BASE}/trips`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function updateTrip(id, data) {
  const result = await request(`${API_BASE}/trips/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function deleteTrip(id) {
  return request(`${API_BASE}/trips/${id}`, { method: 'DELETE' });
}

export async function saveTripDays(id, days) {
  const result = await request(`${API_BASE}/trips/${id}/days`, {
    method: 'PUT',
    body: JSON.stringify({ days }),
  });
  return result.data;
}
