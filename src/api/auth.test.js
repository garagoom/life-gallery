import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/encryptPassword', () => ({
  encryptPassword: async (plain) => `enc:${plain}`,
  setPasswordPublicKey: () => {},
}));

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

describe('API auth.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    document.cookie = 'lg_csrf=test-csrf';
    delete window.location;
    window.location = { href: '', pathname: '/login' };
  });

  describe('login', () => {
    it('should send encrypted password with credentials', async () => {
      mockFetch.mockImplementation((url) => {
        if (String(url).includes('/csrf')) {
          return Promise.resolve(mockRes({ code: 200, data: { csrfToken: 'test-csrf', passwordPublicKey: 'PEM' } }));
        }
        return Promise.resolve(mockRes({
          code: 200,
          data: { expiresIn: 900, user: { username: 'admin' } },
        }));
      });

      const { login } = await import('./auth.js');
      const result = await login('admin', 'password123');

      const loginCall = mockFetch.mock.calls.find(([url]) => String(url).includes('/auth/login'));
      expect(loginCall).toBeTruthy();
      expect(loginCall[1]).toEqual(expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }));
      const body = JSON.parse(loginCall[1].body);
      expect(body.password).toBe('enc:password123');
      expect(body.password).not.toBe('password123');
      expect(result.user.username).toBe('admin');
    });
  });

  describe('getProfile', () => {
    it('should send cookies instead of Authorization header', async () => {
      mockFetch.mockImplementation((url) => {
        if (String(url).includes('/csrf')) {
          return Promise.resolve(mockRes({ code: 200, data: { csrfToken: 'test-csrf' } }));
        }
        return Promise.resolve(mockRes({ code: 200, data: { username: 'admin' } }));
      });

      const { getProfile } = await import('./auth.js');
      await getProfile();

      const profileCall = mockFetch.mock.calls.find(([url]) => String(url).includes('/auth/profile'));
      expect(profileCall[1].credentials).toBe('include');
      expect(profileCall[1].headers.Authorization).toBeUndefined();
    });
  });

  describe('logout', () => {
    it('should call logout endpoint', async () => {
      mockFetch.mockImplementation((url) => {
        if (String(url).includes('/csrf')) {
          return Promise.resolve(mockRes({ code: 200, data: { csrfToken: 'test-csrf' } }));
        }
        return Promise.resolve(mockRes({ code: 200 }));
      });

      const { logout } = await import('./auth.js');
      await logout();

      const logoutCall = mockFetch.mock.calls.find(([url]) => String(url).includes('/auth/logout'));
      expect(logoutCall).toBeTruthy();
      expect(window.location.href).toBe('/login');
    });
  });
});
