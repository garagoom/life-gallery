import { describe, it, expect } from 'vitest';
import { FALLBACK_CURRENCIES } from './fx';

describe('fx helpers', () => {
  it('keeps a local fallback currency list', () => {
    expect(FALLBACK_CURRENCIES).toEqual(expect.arrayContaining([
      { value: 'CNY', label: '人民币 CNY' },
      { value: 'JPY', label: '日元 JPY' },
    ]));
  });
});
