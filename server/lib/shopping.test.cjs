const {
  nextBudgetSync,
  applyBudgetDelta,
  isBought,
  isShoppingCategory,
} = require('./shopping.cjs');

describe('shopping budget sync', () => {
  it('adds the current amount when an item is first marked bought', () => {
    const sync = nextBudgetSync(null, {
      bought: true,
      budgetItemId: 8,
      amountTrip: 8000,
      amountBase: 400,
    });
    expect(sync.ops).toEqual([{ budgetItemId: 8, deltaTrip: 8000, deltaBase: 400 }]);
    expect(sync.appliedAmount).toBe(8000);
  });

  it('only applies the difference when a bought price changes', () => {
    const sync = nextBudgetSync({
      bought: 1,
      budget_item_id: 8,
      applied_amount: 8000,
      applied_amount_base: 400,
    }, {
      bought: true,
      budgetItemId: 8,
      amountTrip: 9800,
      amountBase: 490,
    });
    expect(sync.ops).toEqual([{ budgetItemId: 8, deltaTrip: 1800, deltaBase: 90 }]);
  });

  it('subtracts the applied amount when bought is turned off', () => {
    const sync = nextBudgetSync({
      bought: 1,
      budget_item_id: 8,
      applied_amount: 8000,
      applied_amount_base: 400,
    }, {
      bought: false,
      budgetItemId: 8,
      amountTrip: 8000,
      amountBase: 400,
    });
    expect(sync.ops).toEqual([{ budgetItemId: 8, deltaTrip: -8000, deltaBase: -400 }]);
    expect(sync.appliedAmount).toBe(0);
  });

  it('moves the applied amount when the linked budget item changes', () => {
    const sync = nextBudgetSync({
      bought: 1,
      budget_item_id: 8,
      applied_amount: 8000,
      applied_amount_base: 400,
    }, {
      bought: true,
      budgetItemId: 9,
      amountTrip: 8000,
      amountBase: 400,
    });
    expect(sync.ops).toEqual([
      { budgetItemId: 8, deltaTrip: -8000, deltaBase: -400 },
      { budgetItemId: 9, deltaTrip: 8000, deltaBase: 400 },
    ]);
  });

  it('clamps budget item amounts at zero', () => {
    expect(applyBudgetDelta({ amount: 100, amount_base: 10 }, -180, -40)).toEqual({
      amount: 0,
      amountBase: 0,
    });
  });

  it('treats 1 as bought', () => {
    expect(isBought(1)).toBe(true);
    expect(isBought(0)).toBe(false);
  });

  it('only accepts shopping-category budget lines', () => {
    expect(isShoppingCategory('shopping')).toBe(true);
    expect(isShoppingCategory('flight')).toBe(false);
    expect(isShoppingCategory('')).toBe(false);
  });
});
