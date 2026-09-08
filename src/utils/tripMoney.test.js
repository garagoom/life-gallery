import { describe, it, expect } from 'vitest';
import { formatMoney, roundMoney, foreignToBase, baseToForeign } from './tripMoney';

describe('tripMoney', () => {
  it('formats yen without decimals and yuan with two', () => {
    expect(formatMoney(155628, 'JPY')).toBe('155,628');
    expect(formatMoney(6692, 'CNY')).toBe('6,692.00');
  });

  it('rounds multiplied line amounts in yen', () => {
    expect(roundMoney(2 * 9800, 'JPY')).toBe(19600);
  });

  it('converts both ways with the trip fx rate', () => {
    expect(foreignToBase(155628, 0.043, 'CNY')).toBe(6692);
    expect(baseToForeign(6692, 0.043, 'JPY')).toBe(155628);
  });
});
