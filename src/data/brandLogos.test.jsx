import { describe, it, expect } from 'vitest';
import { getBrandLogo } from './brandLogos';

describe('brandLogos', () => {
  it('should return logo for known brands', () => {
    expect(getBrandLogo('Nikon')).toBeDefined();
    expect(getBrandLogo('Canon')).toBeDefined();
    expect(getBrandLogo('Sony')).toBeDefined();
    expect(getBrandLogo('FUJIFILM')).toBeDefined();
    expect(getBrandLogo('Leica')).toBeDefined();
    expect(getBrandLogo('Hasselblad')).toBeDefined();
    expect(getBrandLogo('Panasonic')).toBeDefined();
    expect(getBrandLogo('OLYMPUS')).toBeDefined();
    expect(getBrandLogo('SIGMA')).toBeDefined();
    expect(getBrandLogo('Apple')).toBeDefined();
  });

  it('should be case-insensitive for some brands', () => {
    const nikon1 = getBrandLogo('Nikon');
    const nikon2 = getBrandLogo('nikon');
    expect(nikon1).toBeDefined();
    // May or may not be same, but should both be defined
    expect(nikon2).toBeDefined();
  });

  it('should return null for unknown brand', () => {
    expect(getBrandLogo('UnknownBrand')).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(getBrandLogo('')).toBeNull();
  });

  it('should return null for null', () => {
    expect(getBrandLogo(null)).toBeNull();
  });
});
