import { describe, expect, it } from 'vitest';
import { fitLightboxSize, lightboxMaxBox } from './lightboxSize.js';

describe('fitLightboxSize', () => {
  it('keeps aspect ratio within max box', () => {
    expect(fitLightboxSize(4000, 3000, 700, 700)).toEqual({ width: 700, height: 525 });
  });

  it('fits portrait photos without inventing side margins', () => {
    expect(fitLightboxSize(2000, 3000, 700, 700)).toEqual({ width: 467, height: 700 });
  });

  it('does not upscale smaller originals', () => {
    expect(fitLightboxSize(400, 300, 700, 700)).toEqual({ width: 400, height: 300 });
  });

  it('returns null for invalid sizes', () => {
    expect(fitLightboxSize(0, 100, 700, 700)).toBeNull();
    expect(fitLightboxSize(100, 100, 0, 700)).toBeNull();
  });
});

describe('lightboxMaxBox', () => {
  it('uses tighter height on mobile', () => {
    expect(lightboxMaxBox(390, 800)).toEqual({ maxW: 390 * 0.95, maxH: 800 * 0.5 });
  });

  it('reserves side space for meta on desktop', () => {
    expect(lightboxMaxBox(1400, 900)).toEqual({ maxW: 1400 * 0.7 - 140, maxH: 900 * 0.7 });
  });
});
