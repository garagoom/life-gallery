const ZERO_DECIMAL = new Set(['JPY', 'KRW']);

function currencyScale(code) {
  return ZERO_DECIMAL.has(String(code || '').toUpperCase()) ? 1 : 100;
}

function toMinor(major, currency) {
  const n = Number(major);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * currencyScale(currency));
}

function toMajor(minor, currency) {
  return Number(minor || 0) / currencyScale(currency);
}

function toBaseMinor(foreignMinor, tripCurrency, baseCurrency, fxRate) {
  const rate = Number(fxRate);
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
  const foreignMajor = toMajor(foreignMinor, tripCurrency);
  return toMinor(foreignMajor * safeRate, baseCurrency);
}

function roundMajor(value, currency) {
  const scale = currencyScale(currency);
  return Math.round(Number(value || 0) * scale) / scale;
}

function parseIncludeOptional(value) {
  if (value === true || value === 1) return true;
  const text = String(value || '').toLowerCase();
  return text === '1' || text === 'true' || text === 'yes';
}

function itemInSummary(item, includeOptional) {
  if (includeOptional) return true;
  return Number(item.optional) !== 1;
}

function summarizeTrip(trip, items = [], expenses = [], { includeOptional = false } = {}) {
  const tripCurrency = trip.trip_currency || 'CNY';
  const baseCurrency = trip.base_currency || 'CNY';
  const fxRate = trip.fx_rate == null ? 1 : Number(trip.fx_rate);
  const partySize = Math.max(1, Number(trip.party_size) || 1);

  let plannedMinor = 0;
  let bookedMinor = 0;
  let pendingMinor = 0;
  const byCategory = {};

  for (const item of items) {
    if (!itemInSummary(item, includeOptional)) continue;
    const amount = Number(item.amount) || 0;
    plannedMinor += amount;
    if (item.status === 'booked') bookedMinor += amount;
    else pendingMinor += amount;

    const key = item.category || 'misc';
    if (!byCategory[key]) {
      byCategory[key] = { category: key, planned_minor: 0, spent_minor: 0 };
    }
    byCategory[key].planned_minor += amount;
  }

  let spentMinor = 0;
  for (const expense of expenses) {
    const amount = Number(expense.amount) || 0;
    spentMinor += amount;
    const key = expense.category || 'misc';
    if (!byCategory[key]) {
      byCategory[key] = { category: key, planned_minor: 0, spent_minor: 0 };
    }
    byCategory[key].spent_minor += amount;
  }

  const toPair = (minor) => ({
    amount: toMajor(minor, tripCurrency),
    amount_cny: toMajor(toBaseMinor(minor, tripCurrency, baseCurrency, fxRate), baseCurrency),
  });

  const planned = toPair(plannedMinor);
  const booked = toPair(bookedMinor);
  const pending = toPair(pendingMinor);
  const spent = toPair(spentMinor);
  const remainingMinor = plannedMinor - spentMinor;
  const remaining = toPair(remainingMinor);

  const categoryRows = Object.values(byCategory).map((row) => {
    const plannedPair = toPair(row.planned_minor);
    const spentPair = toPair(row.spent_minor);
    return {
      category: row.category,
      planned: plannedPair.amount,
      planned_cny: plannedPair.amount_cny,
      spent: spentPair.amount,
      spent_cny: spentPair.amount_cny,
      share: plannedMinor > 0 ? row.planned_minor / plannedMinor : 0,
    };
  });

  return {
    include_optional: includeOptional,
    planned_total: planned.amount,
    planned_total_cny: planned.amount_cny,
    booked_total: booked.amount,
    booked_total_cny: booked.amount_cny,
    pending_total: pending.amount,
    pending_total_cny: pending.amount_cny,
    spent_total: spent.amount,
    spent_total_cny: spent.amount_cny,
    remaining: remaining.amount,
    remaining_cny: remaining.amount_cny,
    per_person: roundMajor(planned.amount / partySize, tripCurrency),
    per_person_cny: roundMajor(planned.amount_cny / partySize, baseCurrency),
    by_category: categoryRows,
  };
}

function presentBudgetItem(row, trip) {
  const currency = trip.trip_currency || 'CNY';
  const baseCurrency = trip.base_currency || 'CNY';
  const fxRate = trip.fx_rate == null ? 1 : Number(trip.fx_rate);
  const amountCny = toMajor(toBaseMinor(row.amount, currency, baseCurrency, fxRate), baseCurrency);
  const unitCny = toMajor(toBaseMinor(row.unit_amount, currency, baseCurrency, fxRate), baseCurrency);
  return {
    ...row,
    qty: Number(row.qty) || 0,
    optional: Number(row.optional) === 1,
    unit_amount: toMajor(row.unit_amount, currency),
    amount: toMajor(row.amount, currency),
    unit_amount_cny: unitCny,
    amount_cny: amountCny,
  };
}

function presentExpense(row, trip) {
  const currency = trip.trip_currency || 'CNY';
  const baseCurrency = trip.base_currency || 'CNY';
  const fxRate = trip.fx_rate == null ? 1 : Number(trip.fx_rate);
  return {
    ...row,
    amount: toMajor(row.amount, currency),
    amount_cny: toMajor(toBaseMinor(row.amount, currency, baseCurrency, fxRate), baseCurrency),
  };
}

function resolveBudgetAmount({ qty, unit_amount, amount }, currency) {
  const unitMinor = toMinor(unit_amount, currency);
  if (amount != null && amount !== '') {
    return { unitMinor, amountMinor: toMinor(amount, currency) };
  }
  const safeQty = Number(qty);
  const multiplier = Number.isFinite(safeQty) && safeQty > 0 ? safeQty : 1;
  return { unitMinor, amountMinor: Math.round(multiplier * unitMinor) };
}

module.exports = {
  currencyScale,
  toMinor,
  toMajor,
  toBaseMinor,
  roundMajor,
  parseIncludeOptional,
  summarizeTrip,
  presentBudgetItem,
  presentExpense,
  resolveBudgetAmount,
};
