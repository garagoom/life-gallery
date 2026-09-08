const { describe, it, expect } = require('vitest');
const { toMinor, toMajor, toBaseMinor, summarizeTrip, resolveBudgetAmount } = require('./tripMoney.cjs');

describe('tripMoney', () => {
  it('stores yen as whole units and yuan as fen', () => {
    expect(toMinor(155628, 'JPY')).toBe(155628);
    expect(toMinor(6692.00, 'CNY')).toBe(669200);
    expect(toMajor(669200, 'CNY')).toBe(6692);
  });

  it('converts JPY to CNY fen using the trip fx rate', () => {
    const yen = toMinor(155628, 'JPY');
    const fen = toBaseMinor(yen, 'JPY', 'CNY', 0.043);
    expect(toMajor(fen, 'CNY')).toBe(6692);
  });

  it('excludes optional budget lines from the main total', () => {
    const trip = { trip_currency: 'JPY', base_currency: 'CNY', fx_rate: 0.043, party_size: 2 };
    const items = [
      { category: 'flight', amount: 155628, status: 'booked', optional: 0 },
      { category: 'attraction', amount: 1000, status: 'pending', optional: 1 },
    ];
    const main = summarizeTrip(trip, items, []);
    expect(main.planned_total).toBe(155628);
    expect(main.booked_total).toBe(155628);
    expect(main.per_person_cny).toBe(3346);

    const withOptional = summarizeTrip(trip, items, [], { includeOptional: true });
    expect(withOptional.planned_total).toBe(156628);
  });

  it('computes amount from qty and unit price when amount is omitted', () => {
    const resolved = resolveBudgetAmount({ qty: 2, unit_amount: 9800 }, 'JPY');
    expect(resolved.amountMinor).toBe(19600);
  });
});
