import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCachedPhotos, getOrPreloadPhotos } from './preloader';

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value; }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(global, 'sessionStorage', { value: sessionStorageMock });

describe('preloader', () => {
  beforeEach(() => {
    sessionStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('getCachedPhotos', () => {
    it('should return null when no cache', () => {
      sessionStorageMock.getItem.mockReturnValue(null);
      expect(getCachedPhotos()).toBeNull();
    });

    it('should return cached photos when valid', () => {
      const photos = [{ id: 1, title: 'test' }];
      const now = Date.now();
      sessionStorageMock.getItem.mockImplementation((key) => {
        if (key === 'preloadedPhotos') return JSON.stringify(photos);
        if (key === 'preloadedPhotosTs') return String(now);
        return null;
      });
      expect(getCachedPhotos()).toEqual(photos);
    });

    it('should return null when cache expired', () => {
      const photos = [{ id: 1, title: 'test' }];
      const expired = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      sessionStorageMock.getItem.mockImplementation((key) => {
        if (key === 'preloadedPhotos') return JSON.stringify(photos);
        if (key === 'preloadedPhotosTs') return String(expired);
        return null;
      });
      expect(getCachedPhotos()).toBeNull();
    });

    it('should return null on parse error', () => {
      sessionStorageMock.getItem.mockImplementation((key) => {
        if (key === 'preloadedPhotos') return 'invalid-json';
        if (key === 'preloadedPhotosTs') return String(Date.now());
        return null;
      });
      expect(getCachedPhotos()).toBeNull();
    });
  });
});
