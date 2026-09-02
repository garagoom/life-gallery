import { describe, it, expect } from 'vitest';

// Test the formatting logic from ExifInfo separately
describe('ExifInfo formatting logic', () => {
  const formatExposure = (val) => {
    if (!val) return null;
    if (val.includes('/') || val.includes('1/')) {
      const parts = val.replace('1/', '').split('/');
      if (parts.length === 2 && parts[1] === '1') return `1/${parts[0]}s`;
      return val.includes('s') ? val : `${val}s`;
    }
    return val.includes('s') ? val : `${val}s`;
  };

  const formatFNumber = (val) => {
    if (!val) return null;
    return val.startsWith('f/') ? val : `f/${val}`;
  };

  const formatFocalLength = (val) => {
    if (!val) return null;
    return val.includes('mm') ? val : `${val}mm`;
  };

  describe('formatExposure', () => {
    it('should format fraction exposure', () => {
      expect(formatExposure('1/250')).toBe('1/250s');
    });

    it('should add s suffix to plain number', () => {
      expect(formatExposure('0.5')).toBe('0.5s');
    });

    it('should not double s suffix', () => {
      expect(formatExposure('1/125s')).toBe('1/125s');
    });

    it('should return null for null/undefined', () => {
      expect(formatExposure(null)).toBeNull();
      expect(formatExposure(undefined)).toBeNull();
    });

    it('should handle long exposure', () => {
      expect(formatExposure('30')).toBe('30s');
    });
  });

  describe('formatFNumber', () => {
    it('should add f/ prefix', () => {
      expect(formatFNumber('2.8')).toBe('f/2.8');
    });

    it('should not double f/ prefix', () => {
      expect(formatFNumber('f/4')).toBe('f/4');
    });

    it('should return null for null', () => {
      expect(formatFNumber(null)).toBeNull();
    });
  });

  describe('formatFocalLength', () => {
    it('should add mm suffix', () => {
      expect(formatFocalLength('50')).toBe('50mm');
    });

    it('should not double mm suffix', () => {
      expect(formatFocalLength('50mm')).toBe('50mm');
    });

    it('should return null for null', () => {
      expect(formatFocalLength(null)).toBeNull();
    });
  });
});
