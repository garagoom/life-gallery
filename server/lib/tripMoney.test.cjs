const { describe, it, expect } = require('vitest');
const { toMinor, toMajor, toBaseMinor, summarizeTrip, resolveBudgetAmount, presentBudgetItem, presentExpense, persistBudgetItemMoney, persistExpenseMoney } = require('./tripMoney.cjs');

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

  it('keeps booked and expense base amounts when the fx rate changes', () => {
    const trip = { trip_currency: 'JPY', base_currency: 'CNY', fx_rate: 0.05, party_size: 2 };
    const items = [{
      category: 'flight',
      amount: 155628,
      amount_base: 669200,
      status: 'booked',
      optional: 0,
    }];
    const expenses = [{
      category: 'flight',
      amount: 155628,
      amount_base: 669200,
    }];
    const stats = summarizeTrip(trip, items, expenses);
    expect(stats.booked_total).toBe(155628);
    expect(stats.booked_total_cny).toBe(6692);
    expect(stats.spent_total_cny).toBe(6692);
    expect(presentBudgetItem(items[0], trip).amount_cny).toBe(6692);
    expect(presentExpense(expenses[0], trip).amount_cny).toBe(6692);
  });

  it('uses base currency as the source when quote_in is base', () => {
    const trip = { trip_currency: 'JPY', base_currency: 'CNY', fx_rate: 0.043, party_size: 1 };
    const item = {
      quote_in: 'base',
      amount: 1,
      amount_base: 669200,
      unit_amount: 1,
      unit_amount_base: 669200,
      status: 'pending',
      optional: 0,
    };
    const presented = presentBudgetItem(item, trip);
    expect(presented.amount_cny).toBe(6692);
    expect(presented.amount).toBe(155628);
    const persisted = persistBudgetItemMoney({
      quote_in: 'base',
      status: 'pending',
      qty: 1,
      unit_amount: 1,
      unit_amount_cny: 6692,
      amount_cny: 6692,
    }, trip);
    expect(persisted.amountBase).toBe(669200);
    expect(persisted.amountTrip).toBe(155628);
  });

  it('keeps booked submitted amounts instead of reconverting at the new fx rate', () => {
    const trip = { trip_currency: 'JPY', base_currency: 'CNY', fx_rate: 0.05 };
    const persisted = persistBudgetItemMoney({
      quote_in: 'trip',
      status: 'booked',
      qty: 1,
      unit_amount: 155628,
      unit_amount_cny: 6692,
      amount: 155628,
      amount_cny: 6692,
    }, trip);
    expect(persisted.amountTrip).toBe(155628);
    expect(persisted.amountBase).toBe(669200);
  });

  it('freezes expense trip and base amounts when both are provided', () => {
    const trip = { trip_currency: 'JPY', base_currency: 'CNY', fx_rate: 0.05 };
    const persisted = persistExpenseMoney({ amount: 155628, amount_cny: 6692 }, trip);
    expect(persisted.amountMinor).toBe(155628);
    expect(persisted.amountBaseMinor).toBe(669200);
  });
});
