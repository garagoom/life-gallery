import { describe, it, expect } from 'vitest';
import { lumaValue } from './extractHistogram';
import {
  extractRgbParadeFromPixels,
  emptyParade,
  toggleChannel,
} from './extractRgbParade';

function fillRect(pixels, width, x0, x1, height, r, g, b, a = 255) {
  for (let y = 0; y < height; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = a;
    }
  }
}

describe('extractRgbParadeFromPixels', () => {
  it('returns empty parade for invalid size', () => {
    expect(extractRgbParadeFromPixels(new Uint8ClampedArray(0), 0, 0)).toEqual(emptyParade());
  });

  it('puts solid red density on R=255 for every column', () => {
    const w = 4;
    const h = 3;
    const pixels = new Uint8ClampedArray(w * h * 4);
    fillRect(pixels, w, 0, w, h, 255, 0, 0);
    const { cols, r, g, b, l } = extractRgbParadeFromPixels(pixels, w, h);

    expect(cols).toBe(4);
    for (let col = 0; col < 4; col++) {
      expect(r[col * 256 + 255]).toBe(h);
      expect(g[col * 256 + 0]).toBe(h);
      expect(b[col * 256 + 0]).toBe(h);
      expect(l[col * 256 + lumaValue(255, 0, 0)]).toBe(h);
    }
  });

  it('places left red and right blue in the matching columns', () => {
    const w = 4;
    const h = 2;
    const pixels = new Uint8ClampedArray(w * h * 4);
    fillRect(pixels, w, 0, 2, h, 255, 0, 0);
    fillRect(pixels, w, 2, 4, h, 0, 0, 255);
    const { r, b } = extractRgbParadeFromPixels(pixels, w, h);

    expect(r[0 * 256 + 255]).toBe(h);
    expect(r[1 * 256 + 255]).toBe(h);
    expect(r[2 * 256 + 255]).toBe(0);
    expect(b[2 * 256 + 255]).toBe(h);
    expect(b[3 * 256 + 255]).toBe(h);
    expect(b[0 * 256 + 255]).toBe(0);
  });

  it('raises luma toward the right on a black-to-white split', () => {
    const w = 2;
    const h = 4;
    const pixels = new Uint8ClampedArray(w * h * 4);
    fillRect(pixels, w, 0, 1, h, 0, 0, 0);
    fillRect(pixels, w, 1, 2, h, 255, 255, 255);
    const { l } = extractRgbParadeFromPixels(pixels, w, h);

    expect(l[0 * 256 + 0]).toBe(h);
    expect(l[1 * 256 + 255]).toBe(h);
  });

  it('skips nearly transparent pixels', () => {
    const w = 1;
    const h = 2;
    const pixels = new Uint8ClampedArray(w * h * 4);
    fillRect(pixels, w, 0, 1, h, 255, 255, 255, 8);
    const { r, l } = extractRgbParadeFromPixels(pixels, w, h);
    expect(r[255]).toBe(0);
    expect(l[255]).toBe(0);
  });
});

describe('toggleChannel', () => {
  const allOn = { r: true, g: true, b: true, l: true };

  it('turns a channel off', () => {
    expect(toggleChannel(allOn, 'r')).toEqual({ r: false, g: true, b: true, l: true });
  });

  it('keeps the last channel on', () => {
    const onlyL = { r: false, g: false, b: false, l: true };
    expect(toggleChannel(onlyL, 'l')).toEqual(onlyL);
  });
});
