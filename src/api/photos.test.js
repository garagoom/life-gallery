import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value; }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock window.location
delete window.location;
window.location = { href: '' };

describe('API photos.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockFetch.mockReset();
  });

  describe('request helper (via getPhotos)', () => {
    it('should add Authorization header when token exists', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'accessToken') return 'test-token';
        return null;
      });

      mockFetch.mockResolvedValueOnce({
        json: async () => ({ code: 200, data: [], pagination: { page: 1, pageSize: 20, total: 0 } }),
      });

      const { getPhotos } = await import('./photos.js');
      await getPhotos();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should not add Authorization header when no token', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      mockFetch.mockResolvedValueOnce({
        json: async () => ({ code: 200, data: [], pagination: { page: 1, pageSize: 20, total: 0 } }),
      });

      const { getPhotos } = await import('./photos.js');
      await getPhotos();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.not.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.any(String),
          }),
        })
      );
    });

    it('should redirect to login on 401', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'accessToken') return 'expired-token';
        return null;
      });

      mockFetch.mockResolvedValueOnce({
        json: async () => ({ code: 401, message: 'Unauthorized' }),
      });

      const { getPhotos } = await import('./photos.js');
      await expect(getPhotos()).rejects.toThrow();
      expect(window.location.href).toBe('/login');
    });
  });

  describe('getPhotos', () => {
    it('should return data and pagination', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      const mockData = [{ id: 1, title: 'test' }];
      const mockPagination = { page: 1, pageSize: 20, total: 1, totalPages: 1 };

      mockFetch.mockResolvedValueOnce({
        json: async () => ({ code: 200, data: mockData, pagination: mockPagination }),
      });

      const { getPhotos } = await import('./photos.js');
      const result = await getPhotos();

      expect(result.data).toEqual(mockData);
      expect(result.pagination).toEqual(mockPagination);
    });

    it('should build query params correctly', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ code: 200, data: [], pagination: { page: 1, pageSize: 10, total: 0 } }),
      });

      const { getPhotos } = await import('./photos.js');
      await getPhotos({ page: 2, pageSize: 10, category: 'landscape' });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('page=2');
      expect(url).toContain('pageSize=10');
      expect(url).toContain('category=landscape');
    });
  });

  describe('getPhotoById', () => {
    it('should return photo data', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      const mockPhoto = { id: 1, title: 'test', camera_model: 'Nikon Z6' };

      mockFetch.mockResolvedValueOnce({
        json: async () => ({ code: 200, data: mockPhoto }),
      });

      const { getPhotoById } = await import('./photos.js');
      const result = await getPhotoById(1);

      expect(result).toEqual(mockPhoto);
    });
  });

  describe('uploadPhoto', () => {
    it('should send POST request with FormData', async () => {
      localStorageMock.getItem.mockReturnValue('editor-token');
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ code: 200, data: { id: 1 } }),
      });

      const formData = new FormData();
      formData.append('file', new Blob(), 'test.jpg');

      const { uploadPhoto } = await import('./photos.js');
      await uploadPhoto(formData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/photos'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('deletePhoto', () => {
    it('should send DELETE request', async () => {
      localStorageMock.getItem.mockReturnValue('editor-token');
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ code: 200, message: 'deleted' }),
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
      localStorageMock.getItem.mockReturnValue('editor-token');
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ code: 200, data: { deletedCount: 2 } }),
      });

      const { batchDeletePhotos } = await import('./photos.js');
      await batchDeletePhotos([1, 2]);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.ids).toEqual([1, 2]);
    });
  });
});
