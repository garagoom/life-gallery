import { describe, it, expect } from 'vitest';
import { formatMeteringMode, formatWhiteBalance, formatExposureBias } from './exifFormat';

describe('formatMeteringMode', () => {
  it('maps EXIF numbers to Chinese labels', () => {
    expect(formatMeteringMode(5)).toBe('评价测光');
    expect(formatMeteringMode('2')).toBe('中央重点测光');
    expect(formatMeteringMode(3)).toBe('点测光');
  });

  it('keeps already formatted labels', () => {
    expect(formatMeteringMode('评价测光')).toBe('评价测光');
  });

  it('returns empty for missing values', () => {
    expect(formatMeteringMode(null)).toBe('');
    expect(formatMeteringMode('')).toBe('');
  });
});

describe('formatWhiteBalance', () => {
  it('maps 0/1 to 自动/手动', () => {
    expect(formatWhiteBalance(0)).toBe('自动');
    expect(formatWhiteBalance('1')).toBe('手动');
  });
});

describe('formatExposureBias', () => {
  it('formats zero and thirds', () => {
    expect(formatExposureBias(0)).toBe('0 EV');
    expect(formatExposureBias(0.33)).toBe('+1/3 EV');
    expect(formatExposureBias(-0.67)).toBe('-2/3 EV');
    expect(formatExposureBias(1)).toBe('+1 EV');
  });

  it('formats rational objects', () => {
    expect(formatExposureBias({ numerator: -1, denominator: 3 })).toBe('-1/3 EV');
  });

  it('keeps stored EV strings', () => {
    expect(formatExposureBias('+1/3 EV')).toBe('+1/3 EV');
  });
});
