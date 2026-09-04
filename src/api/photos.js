import { request, API_BASE } from './client';

export async function getPhotos(params = {}) {
  const searchParams = new URLSearchParams();

  if (params.category) searchParams.append('category', params.category);
  if (params.title) searchParams.append('title', params.title);
  if (params.dateFrom) searchParams.append('dateFrom', params.dateFrom);
  if (params.dateTo) searchParams.append('dateTo', params.dateTo);
  if (params.page) searchParams.append('page', params.page);
  if (params.pageSize) searchParams.append('pageSize', params.pageSize);
  if (params.scope) searchParams.append('scope', params.scope);

  const queryString = searchParams.toString();
  const url = `${API_BASE}/photos${queryString ? '?' + queryString : ''}`;

  const result = await request(url);
  return {
    data: result.data || [],
    pagination: result.pagination || { page: 1, pageSize: 20, total: 0, totalPages: 0 }
  };
}

export async function getRandomPhotos(count = 20) {
  const result = await request(`${API_BASE}/photos/random?count=${count}`, { allowAnonymous: true });
  return {
    data: result.data || [],
    pagination: result.pagination || { total: 0, count: 0 }
  };
}

export async function getPhotoById(id) {
  const result = await request(`${API_BASE}/photos/${id}`, { allowAnonymous: true });
  return result.data;
}

export async function uploadPhoto(formData) {
  const result = await request(`${API_BASE}/photos`, {
    method: 'POST',
    body: formData
  });
  return result.data;
}

export async function updatePhoto(id, data) {
  const result = await request(`${API_BASE}/photos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  return result.data;
}

export async function deletePhoto(id) {
  const result = await request(`${API_BASE}/photos/${id}`, {
    method: 'DELETE'
  });
  return result;
}

export async function batchUploadPhotos(formData) {
  const result = await request(`${API_BASE}/photos/batch`, {
    method: 'POST',
    body: formData
  });
  return result;
}

export async function batchDeletePhotos(ids) {
  const result = await request(`${API_BASE}/photos/batch-delete`, {
    method: 'POST',
    body: JSON.stringify({ ids })
  });
  return result;
}

export async function getReviewPhotos(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.review_status !== undefined && params.review_status !== '') searchParams.append('review_status', params.review_status);
  if (params.page) searchParams.append('page', params.page);
  if (params.pageSize) searchParams.append('pageSize', params.pageSize);
  const queryString = searchParams.toString();
  const url = `${API_BASE}/photos/review${queryString ? '?' + queryString : ''}`;
  const result = await request(url);
  return {
    data: result.data || [],
    pagination: result.pagination || { page: 1, pageSize: 20, total: 0, totalPages: 0 }
  };
}

export async function reviewPhoto(id, review_status) {
  const result = await request(`${API_BASE}/photos/${id}/review`, {
    method: 'PUT',
    body: JSON.stringify({ review_status })
  });
  return result;
}

export async function batchReviewPhotos(ids, review_status) {
  const result = await request(`${API_BASE}/photos/batch-review`, {
    method: 'POST',
    body: JSON.stringify({ ids, review_status })
  });
  return result;
}
