const API_BASE = '/api';

async function request(url, options = {}) {
  const token = localStorage.getItem('accessToken');
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  const res = await fetch(url, { ...options, headers });
  const json = await res.json();
  
  if (json.code === 401) {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error(json.message);
  }
  
  if (json.code >= 400) {
    throw new Error(json.message);
  }
  
  return json;
}

export async function getUsers() {
  const result = await request(`${API_BASE}/users`);
  return result.data;
}

export async function createUser(data) {
  const result = await request(`${API_BASE}/users`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return result;
}

export async function updateUser(id, data) {
  const result = await request(`${API_BASE}/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  return result;
}

export async function updateUserStatus(id, status) {
  const result = await request(`${API_BASE}/users/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
  return result;
}

export async function deleteUser(id) {
  const result = await request(`${API_BASE}/users/${id}`, {
    method: 'DELETE'
  });
  return result;
}
