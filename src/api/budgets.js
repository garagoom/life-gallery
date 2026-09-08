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

export async function getBudgets(params = {}) {
  const result = await request(withQuery(`${API_BASE}/budgets`, params));
  return {
    data: result.data || [],
    pagination: result.pagination || { page: 1, pageSize: 10, total: 0, totalPages: 0 },
    totals: result.totals || {},
    by_category: result.by_category || [],
  };
}

export async function getBudget(id, params = {}) {
  const result = await request(withQuery(`${API_BASE}/budgets/${id}`, params));
  return result.data;
}

export async function createBudget(data) {
  const result = await request(`${API_BASE}/budgets`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function updateBudget(id, data) {
  const result = await request(`${API_BASE}/budgets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function deleteBudget(id) {
  return request(`${API_BASE}/budgets/${id}`, { method: 'DELETE' });
}

export async function setBudgetMain(id, isMain) {
  const result = await request(`${API_BASE}/budgets/${id}/main`, {
    method: 'PUT',
    body: JSON.stringify({ is_main: isMain ? 1 : 0 }),
  });
  return result.data;
}

export async function saveBudgetItems(id, items, includeOptional = false) {
  const result = await request(`${API_BASE}/budgets/${id}/items`, {
    method: 'PUT',
    body: JSON.stringify({ items, include_optional: includeOptional }),
  });
  return result.data;
}

export async function createBudgetExpense(id, data) {
  const result = await request(`${API_BASE}/budgets/${id}/expenses`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function updateBudgetExpense(id, expenseId, data) {
  const result = await request(`${API_BASE}/budgets/${id}/expenses/${expenseId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function deleteBudgetExpense(id, expenseId) {
  const result = await request(`${API_BASE}/budgets/${id}/expenses/${expenseId}`, {
    method: 'DELETE',
  });
  return result.data;
}
