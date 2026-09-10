import { describe, it, expect } from 'vitest';
import { formatMoney, roundMoney, foreignToBase, baseToForeign, applyFxToBudgetItem } from './tripMoney';

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

  it('keeps booked amounts when fx changes and flips the non-quote side otherwise', () => {
    const booked = {
      status: 'booked',
      quote_in: 'trip',
      amount: 155628,
      amount_cny: 6692,
      unit_amount: 155628,
      unit_amount_cny: 6692,
    };
    expect(applyFxToBudgetItem(booked, 0.05, 'JPY', 'CNY').amount_cny).toBe(6692);

    const pendingTrip = { ...booked, status: 'pending' };
    expect(applyFxToBudgetItem(pendingTrip, 0.05, 'JPY', 'CNY').amount_cny).toBe(7781.4);

    const pendingBase = { ...pendingTrip, quote_in: 'base' };
    expect(applyFxToBudgetItem(pendingBase, 0.05, 'JPY', 'CNY').amount).toBe(133840);
  });
});
