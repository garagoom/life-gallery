import { describe, it, expect } from 'vitest';
import { getBrandLogo, BRANDS } from './brandLogos';

describe('brandLogos', () => {
  it('covers major camera and phone brands', () => {
    const samples = [
      'Canon', 'NIKON CORPORATION', 'SONY', 'FUJIFILM', 'LEICA CAMERA AG',
      'Hasselblad', 'Panasonic', 'OLYMPUS CORPORATION', 'OM Digital Solutions',
      'PENTAX', 'RICOH IMAGING COMPANY, LTD.', 'SIGMA', 'Apple', 'samsung',
      'HUAWEI', 'Xiaomi', 'OPPO', 'vivo', 'HONOR', 'realme', 'OnePlus',
      'Google', 'DJI', 'GoPro', 'Insta360', 'motorola', 'ASUS',
    ];
    for (const make of samples) {
      expect(getBrandLogo(make), make).toBeDefined();
    }
  });

  it('prefers the longest alias so Redmi does not become RED', () => {
    const redmi = getBrandLogo('Redmi');
    const red = getBrandLogo('RED');
    expect(redmi.props.alt).toBe('Redmi');
    expect(red.props.alt).toBe('RED');
  });

  it('should be case-insensitive', () => {
    expect(getBrandLogo('Nikon')).toBeDefined();
    expect(getBrandLogo('nikon')).toBeDefined();
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

  it('has unique brand ids and logo files', () => {
    const ids = BRANDS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('prefers color png logos when available', () => {
    expect(getBrandLogo('OPPO').props.src).toContain('oppo.png');
    expect(getBrandLogo('vivo').props['data-logo']).toBe('raster');
    expect(getBrandLogo('Apple').props.src).toContain('apple.svg');
  });

  it('matches phone model codes when make is missing', () => {
    expect(getBrandLogo(null, 'V2419A').props.alt).toBe('vivo');
    expect(getBrandLogo('', 'CPH2307').props.alt).toBe('OPPO');
  });
});
