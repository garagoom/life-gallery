import { describe, it, expect } from 'vitest';

// Test PhotoDetail formatting logic
describe('PhotoDetail formatting', () => {
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const sec = String(d.getSeconds()).padStart(2, '0');
    return `${y}/${m}/${day} ${h}:${min}:${sec}`;
  };

  describe('formatDate', () => {
    it('should format ISO date string', () => {
      expect(formatDate('2024-03-15')).toBe('2024/03/15');
    });

    it('should format datetime string', () => {
      expect(formatDate('2024-03-15T10:30:00')).toBe('2024/03/15');
    });

    it('should return empty for null', () => {
      expect(formatDate(null)).toBe('');
    });

    it('should return raw string for invalid date', () => {
      expect(formatDate('not-a-date')).toBe('not-a-date');
    });

    it('should handle single digit months/days', () => {
      expect(formatDate('2024-01-05')).toBe('2024/01/05');
    });
  });

  describe('formatDateTime', () => {
    it('should format full datetime', () => {
      expect(formatDateTime('2024-03-15T14:30:45')).toBe('2024/03/15 14:30:45');
    });

    it('should return empty for null', () => {
      expect(formatDateTime(null)).toBe('');
    });

    it('should pad single digits', () => {
      expect(formatDateTime('2024-01-05T09:05:03')).toBe('2024/01/05 09:05:03');
    });
  });

  describe('camera name logic', () => {
    const getCameraName = (photo) => photo.camera_model || photo.camera_make || '';

    it('should prefer camera_model', () => {
      expect(getCameraName({ camera_model: 'Z6 III', camera_make: 'Nikon' })).toBe('Z6 III');
    });

    it('should fallback to camera_make', () => {
      expect(getCameraName({ camera_make: 'Canon' })).toBe('Canon');
    });

    it('should return empty when none', () => {
      expect(getCameraName({})).toBe('');
    });
  });

  describe('exif items filter', () => {
    it('should filter out null/undefined values', () => {
      const photo = {
        camera_model: 'Z6',
        lens_model: null,
        f_number: '2.8',
        exposure_time: undefined,
        iso: '100',
      };

      const items = [
        { label: '相机型号', value: photo.camera_model },
        { label: '镜头', value: photo.lens_model },
        { label: '光圈', value: photo.f_number },
        { label: '快门速度', value: photo.exposure_time },
        { label: 'ISO', value: photo.iso },
      ].filter(item => item.value);

      expect(items).toHaveLength(3);
      expect(items.map(i => i.label)).toEqual(['相机型号', '光圈', 'ISO']);
    });
  });
});
