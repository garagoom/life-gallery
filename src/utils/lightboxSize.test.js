import { describe, expect, it } from 'vitest';
import {
  fitLightboxSize,
  lightboxMaxBox,
  rotatedAabb,
  LIGHTBOX_ROTATION_BUDGET_DEG,
} from './lightboxSize.js';

describe('rotatedAabb', () => {
  it('expands width for landscape frames when tilted', () => {
    const box = rotatedAabb(400, 200, 4);
    expect(box.width).toBeGreaterThan(400);
    expect(box.height).toBeGreaterThan(200);
  });
});

describe('fitLightboxSize', () => {
  it('keeps aspect ratio within max box', () => {
    const size = fitLightboxSize(4000, 3000, 700, 700, 0, { x: 0, y: 0 });
    expect(size).toEqual({ width: 700, height: 525 });
  });

  it('fits portrait photos without inventing side margins', () => {
    const size = fitLightboxSize(2000, 3000, 700, 700, 0, { x: 0, y: 0 });
    expect(size).toEqual({ width: 467, height: 700 });
  });

  it('does not upscale smaller originals', () => {
    expect(fitLightboxSize(400, 300, 700, 700, 0, { x: 0, y: 0 })).toEqual({ width: 400, height: 300 });
  });

  it('shrinks wide photos so rotated card stays in safe width', () => {
    const noRot = fitLightboxSize(4000, 2000, 360, 500, 0, { x: 20, y: 50 });
    const withRot = fitLightboxSize(4000, 2000, 360, 500, LIGHTBOX_ROTATION_BUDGET_DEG, { x: 20, y: 50 });
    expect(withRot.width).toBeLessThan(noRot.width);
    const aabb = rotatedAabb(withRot.width + 20, withRot.height + 50, LIGHTBOX_ROTATION_BUDGET_DEG);
    expect(aabb.width).toBeLessThanOrEqual(360 + 0.5);
  });

  it('returns null for invalid sizes', () => {
    expect(fitLightboxSize(0, 100, 700, 700)).toBeNull();
    expect(fitLightboxSize(100, 100, 0, 700)).toBeNull();
  });
});

describe('lightboxMaxBox', () => {
  it('uses safe padding on mobile instead of nearly full width', () => {
    const box = lightboxMaxBox(390, 800);
    expect(box.maxW).toBe(390 - 36 * 2);
    expect(box.maxH).toBe(800 - 160 * 2);
    expect(box.maxW).toBeLessThan(390 * 0.9);
  });

  it('reserves side space on desktop', () => {
    const box = lightboxMaxBox(1400, 900);
    expect(box.maxW).toBe(1400 - 100 * 2 - 48);
    expect(box.maxH).toBe(900 - 120 * 2);
  });
});
