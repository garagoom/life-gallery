import { describe, it, expect } from 'vitest';
import {
  fallbackPhotos,
  getPhotoUrl,
  getThumbnailUrl,
  getCameraInfo,
  getExposureSettings,
  getRandomPhoto,
  getPhotosByCategory,
  getShuffledPhotos,
} from './photos';

describe('photos.js helpers', () => {
  describe('getPhotoUrl', () => {
    it('should return /uploads/filename for backend photos', () => {
      const photo = { filename: 'abc123.webp' };
      expect(getPhotoUrl(photo)).toBe('/uploads/abc123.webp');
    });

    it('should return src for fallback photos', () => {
      const photo = { src: 'https://example.com/photo.jpg' };
      expect(getPhotoUrl(photo)).toBe('https://example.com/photo.jpg');
    });

    it('should prefer filename over src', () => {
      const photo = { filename: 'test.webp', src: 'https://example.com/photo.jpg' };
      expect(getPhotoUrl(photo)).toBe('/uploads/test.webp');
    });

    it('should handle photo with no filename or src', () => {
      const photo = {};
      expect(getPhotoUrl(photo)).toBeUndefined();
    });
  });

  describe('getThumbnailUrl', () => {
    it('should return /thumbnails/thumbnail for backend photos', () => {
      const photo = { thumbnail: 'thumb-abc.webp' };
      expect(getThumbnailUrl(photo)).toBe('/thumbnails/thumb-abc.webp');
    });

    it('should return src for fallback photos', () => {
      const photo = { src: 'https://example.com/photo.jpg' };
      expect(getThumbnailUrl(photo)).toBe('https://example.com/photo.jpg');
    });
  });

  describe('getCameraInfo', () => {
    it('should return camera_make + camera_model', () => {
      const photo = { camera_make: 'Nikon', camera_model: 'Z6 III' };
      expect(getCameraInfo(photo)).toBe('Nikon Z6 III');
    });

    it('should return camera_model only when no make', () => {
      const photo = { camera_model: 'Z6 III' };
      expect(getCameraInfo(photo)).toBe('Z6 III');
    });

    it('should return null when no camera info', () => {
      const photo = {};
      expect(getCameraInfo(photo)).toBeNull();
    });

    it('should return null when empty strings', () => {
      const photo = { camera_make: '', camera_model: '' };
      expect(getCameraInfo(photo)).toBeNull();
    });
  });

  describe('getExposureSettings', () => {
    it('should return all settings joined', () => {
      const photo = {
        f_number: 'f/2.8',
        exposure_time: '1/250',
        iso: 'ISO 400',
        focal_length: '50mm',
      };
      expect(getExposureSettings(photo)).toBe('f/2.8 | 1/250 | ISO 400 | 50mm');
    });

    it('should return only available settings', () => {
      const photo = { f_number: 'f/4', iso: 'ISO 100' };
      expect(getExposureSettings(photo)).toBe('f/4 | ISO 100');
    });

    it('should return null when no settings', () => {
      const photo = {};
      expect(getExposureSettings(photo)).toBeNull();
    });
  });

  describe('fallbackPhotos', () => {
    it('should be a non-empty array', () => {
      expect(Array.isArray(fallbackPhotos)).toBe(true);
      expect(fallbackPhotos.length).toBeGreaterThan(0);
    });

    it('each photo should have id, src, title', () => {
      fallbackPhotos.forEach((photo) => {
        expect(photo).toHaveProperty('id');
        expect(photo).toHaveProperty('src');
        expect(photo).toHaveProperty('title');
      });
    });
  });

  describe('getRandomPhoto', () => {
    it('should return a photo from fallback', () => {
      const photo = getRandomPhoto();
      expect(photo).toBeDefined();
      expect(photo).toHaveProperty('id');
    });

    it('should exclude specified id', () => {
      const photo = getRandomPhoto(1);
      expect(photo.id).not.toBe(1);
    });

    it('should return different photos on multiple calls (statistically)', () => {
      const ids = new Set();
      for (let i = 0; i < 50; i++) {
        ids.add(getRandomPhoto().id);
      }
      expect(ids.size).toBeGreaterThan(1);
    });
  });

  describe('getPhotosByCategory', () => {
    it('should filter by category', () => {
      const landscapePhotos = getPhotosByCategory('landscape');
      expect(landscapePhotos.length).toBeGreaterThan(0);
      landscapePhotos.forEach((p) => expect(p.category).toBe('landscape'));
    });

    it('should return empty for non-existent category', () => {
      const result = getPhotosByCategory('nonexistent');
      expect(result).toEqual([]);
    });
  });

  describe('getShuffledPhotos', () => {
    it('should return same length as fallback', () => {
      const shuffled = getShuffledPhotos();
      expect(shuffled.length).toBe(fallbackPhotos.length);
    });

    it('should contain all original ids', () => {
      const shuffled = getShuffledPhotos();
      const originalIds = fallbackPhotos.map((p) => p.id).sort();
      const shuffledIds = shuffled.map((p) => p.id).sort();
      expect(shuffledIds).toEqual(originalIds);
    });
  });
});
