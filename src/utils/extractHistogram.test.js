import { describe, it, expect } from 'vitest';
import { lumaValue } from './extractHistogram';

describe('lumaValue', () => {
  it('maps white to 255', () => {
    expect(lumaValue(255, 255, 255)).toBe(255);
  });

  it('maps black to 0', () => {
    expect(lumaValue(0, 0, 0)).toBe(0);
  });

  it('weights green more than red and blue', () => {
    expect(lumaValue(0, 255, 0)).toBeGreaterThan(lumaValue(255, 0, 0));
    expect(lumaValue(255, 0, 0)).toBeGreaterThan(lumaValue(0, 0, 255));
  });
});
