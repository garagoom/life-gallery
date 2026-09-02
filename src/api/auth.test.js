import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

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
delete window.location;
window.location = { href: '' };

describe('API auth.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockFetch.mockReset();
  });

  describe('login', () => {
    it('should send POST with credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          code: 200,
          data: { accessToken: 'at', refreshToken: 'rt', user: { username: 'admin' } },
        }),
      });

      const { login } = await import('./auth.js');
      const result = await login('admin', 'password123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/login'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.accessToken).toBe('at');
    });

    it('should store tokens on success', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          code: 200,
          data: { accessToken: 'at', refreshToken: 'rt', user: { username: 'admin' } },
        }),
      });

      const { login } = await import('./auth.js');
      await login('admin', 'password123');

      expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', 'at');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('refreshToken', 'rt');
    });
  });

  describe('getProfile', () => {
    it('should send GET with auth header', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'accessToken') return 'my-token';
        return null;
      });

      mockFetch.mockResolvedValueOnce({
        json: async () => ({ code: 200, data: { username: 'admin' } }),
      });

      const { getProfile } = await import('./auth.js');
      await getProfile();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/profile'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        })
      );
    });
  });

  describe('logout', () => {
    it('should clear tokens', async () => {
      localStorageMock.getItem.mockReturnValue('some-token');
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ code: 200 }),
      });

      const { logout } = await import('./auth.js');
      await logout();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('refreshToken');
    });
  });
});
