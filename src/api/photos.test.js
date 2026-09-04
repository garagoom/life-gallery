import { describe, it, expect, vi, beforeEach } from 'vitest';

function mockRes(body, status = 200) {
  const raw = JSON.stringify(body);
  return {
    status,
    statusText: 'OK',
    json: async () => body,
    text: async () => raw,
  };
}

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API photos.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    document.cookie = 'lg_csrf=test-csrf';
    delete window.location;
    window.location = { href: '', pathname: '/photography/home' };
  });

  describe('request helper (via getPhotos)', () => {
    it('should send credentials and CSRF header', async () => {
      mockFetch.mockImplementation((url) => {
        if (String(url).includes('/csrf')) {
          return Promise.resolve(mockRes({ code: 200, data: { csrfToken: 'test-csrf' } }));
        }
        return Promise.resolve(mockRes({ code: 200, data: [], pagination: { page: 1, pageSize: 20, total: 0 } }));
      });

      const { getPhotos } = await import('./photos.js');
      await getPhotos();

      const call = mockFetch.mock.calls.find(([url]) => String(url).includes('/api/photos'));
      expect(call[1]).toEqual(expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({
          'X-CSRF-Token': 'test-csrf',
        }),
      }));
      expect(call[1].headers.Authorization).toBeUndefined();
    });

    it('should redirect to login on 401', async () => {
      mockFetch.mockImplementation((url) => {
        if (String(url).includes('/csrf')) {
          return Promise.resolve(mockRes({ code: 200, data: { csrfToken: 'test-csrf' } }));
        }
        return Promise.resolve(mockRes({ code: 401, message: 'Unauthorized' }));
      });

      const { getPhotos } = await import('./photos.js');
      await expect(getPhotos()).rejects.toThrow();
      expect(window.location.href).toBe('/login');
    });

    it('should redirect with kicked notice', async () => {
      mockFetch.mockImplementation((url) => {
        if (String(url).includes('/csrf')) {
          return Promise.resolve(mockRes({ code: 200, data: { csrfToken: 'test-csrf' } }));
        }
        return Promise.resolve(mockRes({
          code: 401,
          message: '账号已在其他设备登录，请重新登录',
          reason: 'kicked',
        }));
      });

      const { getPhotos } = await import('./photos.js');
      await expect(getPhotos()).rejects.toThrow('账号已在其他设备登录');
      expect(window.location.href).toBe('/login?notice=kicked');
    });

    it('should redirect with expired notice after refresh fails', async () => {
      mockFetch.mockImplementation((url) => {
        if (String(url).includes('/csrf')) {
          return Promise.resolve(mockRes({ code: 200, data: { csrfToken: 'test-csrf' } }));
        }
        if (String(url).includes('/auth/refresh')) {
          return Promise.resolve(mockRes({
            code: 401,
            message: '登录已过期，请重新登录',
            expired: true,
            reason: 'expired',
          }));
        }
        return Promise.resolve(mockRes({
          code: 401,
          message: '登录已过期，请重新登录',
          expired: true,
          reason: 'expired',
        }));
      });

      const { getPhotos } = await import('./photos.js');
      await expect(getPhotos()).rejects.toThrow('登录已过期');
      expect(window.location.href).toBe('/login?notice=expired');
    });
  });

  describe('getPhotos', () => {
    it('should return data and pagination', async () => {
      const mockData = [{ id: 1, title: 'test' }];
      const mockPagination = { page: 1, pageSize: 20, total: 1, totalPages: 1 };
      mockFetch.mockImplementation((url) => {
        if (String(url).includes('/csrf')) {
          return Promise.resolve(mockRes({ code: 200, data: { csrfToken: 'test-csrf' } }));
        }
        return Promise.resolve(mockRes({ code: 200, data: mockData, pagination: mockPagination }));
      });

      const { getPhotos } = await import('./photos.js');
      const result = await getPhotos();

      expect(result.data).toEqual(mockData);
      expect(result.pagination).toEqual(mockPagination);
    });

    it('should build query params correctly', async () => {
      mockFetch.mockImplementation((url) => {
        if (String(url).includes('/csrf')) {
          return Promise.resolve(mockRes({ code: 200, data: { csrfToken: 'test-csrf' } }));
        }
        return Promise.resolve(mockRes({ code: 200, data: [], pagination: { page: 1, pageSize: 10, total: 0 } }));
      });

      const { getPhotos } = await import('./photos.js');
      await getPhotos({ page: 2, pageSize: 10, category: 'landscape' });

      const url = mockFetch.mock.calls.find(([u]) => String(u).includes('/api/photos'))[0];
      expect(url).toContain('page=2');
      expect(url).toContain('pageSize=10');
      expect(url).toContain('category=landscape');
    });
  });

  describe('getPhotoById', () => {
    it('should return photo data', async () => {
      const mockPhoto = { id: 1, title: 'test', camera_model: 'Nikon Z6' };
      mockFetch.mockImplementation((url) => {
        if (String(url).includes('/csrf')) {
          return Promise.resolve(mockRes({ code: 200, data: { csrfToken: 'test-csrf' } }));
        }
        return Promise.resolve(mockRes({ code: 200, data: mockPhoto }));
      });

      const { getPhotoById } = await import('./photos.js');
      const result = await getPhotoById(1);

      expect(result).toEqual(mockPhoto);
    });
  });

  describe('uploadPhoto', () => {
    it('should send POST request with FormData', async () => {
      mockFetch.mockImplementation((url) => {
        if (String(url).includes('/csrf')) {
          return Promise.resolve(mockRes({ code: 200, data: { csrfToken: 'test-csrf' } }));
        }
        return Promise.resolve(mockRes({ code: 200, data: { id: 1 } }));
      });

      const formData = new FormData();
      formData.append('file', new Blob(), 'test.jpg');

      const { uploadPhoto } = await import('./photos.js');
      await uploadPhoto(formData);

      const call = mockFetch.mock.calls.find(([url, opts]) => String(url).includes('/api/photos') && opts?.method === 'POST');
      expect(call).toBeTruthy();
    });
  });

  describe('deletePhoto', () => {
    it('should send DELETE request', async () => {
      mockFetch.mockImplementation((url) => {
        if (String(url).includes('/csrf')) {
          return Promise.resolve(mockRes({ code: 200, data: { csrfToken: 'test-csrf' } }));
        }
        return Promise.resolve(mockRes({ code: 200, message: 'deleted' }));
      });

      const { deletePhoto } = await import('./photos.js');
      await deletePhoto(1);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/photos/1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('batchDeletePhotos', () => {
    it('should send POST with ids array', async () => {
      mockFetch.mockImplementation((url) => {
        if (String(url).includes('/csrf')) {
          return Promise.resolve(mockRes({ code: 200, data: { csrfToken: 'test-csrf' } }));
        }
        return Promise.resolve(mockRes({ code: 200, data: { deletedCount: 2 } }));
      });

      const { batchDeletePhotos } = await import('./photos.js');
      await batchDeletePhotos([1, 2]);

      const call = mockFetch.mock.calls.find(([, opts]) => opts?.method === 'POST' && typeof opts.body === 'string');
      const body = JSON.parse(call[1].body);
      expect(body.ids).toEqual([1, 2]);
    });
  });
});
