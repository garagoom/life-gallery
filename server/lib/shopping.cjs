const {
  toMajor,
  persistBudgetItemMoney,
  presentBudgetItem,
  summarizeTrip,
} = require('./tripMoney.cjs');

function isBought(value) {
  return value === true || value === 1 || value === '1';
}

function isShoppingCategory(value) {
  return String(value || '') === 'shopping';
}

function persistShoppingItemMoney(item, list) {
  return persistBudgetItemMoney({
    ...item,
    status: isBought(item.bought) ? 'booked' : 'pending',
  }, list);
}

function presentShoppingItem(row, list) {
  const presented = presentBudgetItem({
    ...row,
    category: 'shopping',
    qty: 1,
    optional: 0,
    unit_amount: row.amount,
    unit_amount_base: row.amount_base,
    status: isBought(row.bought) ? 'booked' : 'pending',
  }, list);
  return {
    id: row.id,
    list_id: row.list_id,
    title: row.title,
    place: row.place || '',
    quote_in: presented.quote_in,
    amount: presented.amount,
    amount_cny: presented.amount_cny,
    budget_item_id: row.budget_item_id || null,
    bought: isBought(row.bought),
    note: row.note || '',
    sort_order: Number(row.sort_order) || 0,
  };
}

function summarizeShopping(list, items = []) {
  const fakeItems = items.map((item) => ({
    ...item,
    category: 'shopping',
    optional: 0,
    status: isBought(item.bought) ? 'booked' : 'pending',
  }));
  const stats = summarizeTrip(list, fakeItems, [], { includeOptional: true });
  const wantCount = items.length;
  const boughtCount = items.filter((item) => isBought(item.bought)).length;
  return {
    want_count: wantCount,
    bought_count: boughtCount,
    want_total: stats.planned_total,
    want_total_cny: stats.planned_total_cny,
    bought_total: stats.booked_total,
    bought_total_cny: stats.booked_total_cny,
    pending_total: stats.pending_total,
    pending_total_cny: stats.pending_total_cny,
  };
}

function nextBudgetSync(existing, { bought, budgetItemId, amountTrip, amountBase }) {
  const wasBought = isBought(existing?.bought);
  const oldItemId = existing?.budget_item_id ? Number(existing.budget_item_id) : null;
  const nextItemId = budgetItemId ? Number(budgetItemId) : null;
  const oldTrip = Number(existing?.applied_amount) || 0;
  const oldBase = Number(existing?.applied_amount_base) || 0;
  const ops = [];

  if (wasBought && oldItemId && (!bought || oldItemId !== nextItemId)) {
    ops.push({ budgetItemId: oldItemId, deltaTrip: -oldTrip, deltaBase: -oldBase });
  }

  if (bought && nextItemId) {
    const sameTarget = wasBought && oldItemId === nextItemId;
    ops.push({
      budgetItemId: nextItemId,
      deltaTrip: amountTrip - (sameTarget ? oldTrip : 0),
      deltaBase: amountBase - (sameTarget ? oldBase : 0),
    });
    return {
      ops,
      appliedAmount: amountTrip,
      appliedAmountBase: amountBase,
    };
  }

  return { ops, appliedAmount: 0, appliedAmountBase: 0 };
}

function applyBudgetDelta(item, deltaTrip, deltaBase) {
  const amount = Math.max(0, (Number(item.amount) || 0) + Number(deltaTrip || 0));
  const amountBase = Math.max(0, (Number(item.amount_base) || 0) + Number(deltaBase || 0));
  return { amount, amountBase };
}

function presentShoppingMoney(minor, currency) {
  return toMajor(minor, currency);
}

module.exports = {
  isBought,
  isShoppingCategory,
  persistShoppingItemMoney,
  presentShoppingItem,
  summarizeShopping,
  nextBudgetSync,
  applyBudgetDelta,
  presentShoppingMoney,
};
