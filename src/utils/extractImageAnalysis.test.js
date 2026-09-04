import { describe, it, expect } from 'vitest';
import {
  lumaValue,
  analyzeRgba,
  parseStoredHistogram,
  parseStoredPalette,
} from './extractImageAnalysis';

describe('analyzeRgba', () => {
  it('builds histogram and palette from one scan', () => {
    const pixels = new Uint8ClampedArray([
      255, 0, 0, 255,
      255, 0, 0, 255,
      0, 255, 0, 255,
    ]);
    const { histogram, palette } = analyzeRgba(pixels, 4);

    expect(histogram.r[255]).toBe(2);
    expect(histogram.g[255]).toBe(1);
    expect(histogram.b[0]).toBe(3);
    expect(histogram.l[lumaValue(255, 0, 0)]).toBe(2);
    expect(palette.length).toBeGreaterThan(0);
    expect(palette[0].hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('skips nearly transparent pixels', () => {
    const pixels = new Uint8ClampedArray([10, 20, 30, 0]);
    const { histogram, palette } = analyzeRgba(pixels, 4);
    expect(histogram.r[10]).toBe(0);
    expect(palette).toEqual([]);
  });
});

describe('parseStoredHistogram', () => {
  it('accepts objects and JSON strings', () => {
    const hist = { r: [1], g: [2], b: [3] };
    expect(parseStoredHistogram(hist)).toEqual(hist);
    expect(parseStoredHistogram(JSON.stringify(hist))).toEqual(hist);
    expect(parseStoredHistogram(null)).toBeNull();
  });
});

describe('parseStoredPalette', () => {
  it('accepts arrays and JSON strings', () => {
    const palette = [{ hex: '#ff0000', rgb: 'rgb(255, 0, 0)' }];
    expect(parseStoredPalette(palette)).toEqual(palette);
    expect(parseStoredPalette(JSON.stringify(palette))).toEqual(palette);
    expect(parseStoredPalette(null)).toEqual([]);
  });
});
