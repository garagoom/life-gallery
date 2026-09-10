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

function safeFx(fxRate) {
  const rate = Number(fxRate);
  return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

function toBaseMinor(foreignMinor, tripCurrency, baseCurrency, fxRate) {
  const foreignMajor = toMajor(foreignMinor, tripCurrency);
  return toMinor(foreignMajor * safeFx(fxRate), baseCurrency);
}

function fromTripMinor(tripMinor, trip) {
  const tripCurrency = trip.trip_currency || 'CNY';
  const baseCurrency = trip.base_currency || 'CNY';
  return {
    tripMinor: Number(tripMinor) || 0,
    baseMinor: toBaseMinor(tripMinor, tripCurrency, baseCurrency, trip.fx_rate),
  };
}

function fromBaseMinor(baseMinor, trip) {
  const tripCurrency = trip.trip_currency || 'CNY';
  const baseCurrency = trip.base_currency || 'CNY';
  const baseMajor = toMajor(baseMinor, baseCurrency);
  return {
    tripMinor: toMinor(baseMajor / safeFx(trip.fx_rate), tripCurrency),
    baseMinor: Number(baseMinor) || 0,
  };
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

function normalizeQuoteIn(value) {
  return value === 'base' ? 'base' : 'trip';
}

function hasStoredBase(value) {
  return value != null && value !== '';
}

function resolveQuotedMoney({ quoteIn, tripMinor, baseMinor, locked }, trip) {
  if (locked && hasStoredBase(baseMinor)) {
    return {
      tripMinor: Number(tripMinor) || 0,
      baseMinor: Number(baseMinor) || 0,
    };
  }
  if (normalizeQuoteIn(quoteIn) === 'base' && hasStoredBase(baseMinor)) {
    return fromBaseMinor(baseMinor, trip);
  }
  return fromTripMinor(tripMinor, trip);
}

function resolveItemMoney(item, trip) {
  return resolveQuotedMoney({
    quoteIn: item.quote_in,
    tripMinor: item.amount,
    baseMinor: item.amount_base,
    locked: item.status === 'booked',
  }, trip);
}

function resolveItemUnitMoney(item, trip) {
  return resolveQuotedMoney({
    quoteIn: item.quote_in,
    tripMinor: item.unit_amount,
    baseMinor: item.unit_amount_base,
    locked: item.status === 'booked',
  }, trip);
}

function resolveExpenseMoney(expense, trip) {
  return resolveQuotedMoney({
    quoteIn: 'trip',
    tripMinor: expense.amount,
    baseMinor: expense.amount_base,
    locked: true,
  }, trip);
}

function itemInSummary(item, includeOptional) {
  if (includeOptional) return true;
  return Number(item.optional) !== 1;
}

function summarizeTrip(trip, items = [], expenses = [], { includeOptional = false } = {}) {
  const tripCurrency = trip.trip_currency || 'CNY';
  const baseCurrency = trip.base_currency || 'CNY';
  const partySize = Math.max(1, Number(trip.party_size) || 1);

  let plannedTrip = 0;
  let plannedBase = 0;
  let bookedTrip = 0;
  let bookedBase = 0;
  let pendingTrip = 0;
  let pendingBase = 0;
  const byCategory = {};

  for (const item of items) {
    if (!itemInSummary(item, includeOptional)) continue;
    const money = resolveItemMoney(item, trip);
    plannedTrip += money.tripMinor;
    plannedBase += money.baseMinor;
    if (item.status === 'booked') {
      bookedTrip += money.tripMinor;
      bookedBase += money.baseMinor;
    } else {
      pendingTrip += money.tripMinor;
      pendingBase += money.baseMinor;
    }

    const key = item.category || 'misc';
    if (!byCategory[key]) {
      byCategory[key] = { category: key, planned_trip: 0, planned_base: 0, spent_trip: 0, spent_base: 0 };
    }
    byCategory[key].planned_trip += money.tripMinor;
    byCategory[key].planned_base += money.baseMinor;
  }

  let spentTrip = 0;
  let spentBase = 0;
  for (const expense of expenses) {
    const money = resolveExpenseMoney(expense, trip);
    spentTrip += money.tripMinor;
    spentBase += money.baseMinor;
    const key = expense.category || 'misc';
    if (!byCategory[key]) {
      byCategory[key] = { category: key, planned_trip: 0, planned_base: 0, spent_trip: 0, spent_base: 0 };
    }
    byCategory[key].spent_trip += money.tripMinor;
    byCategory[key].spent_base += money.baseMinor;
  }

  const toPair = (tripMinor, baseMinor) => ({
    amount: toMajor(tripMinor, tripCurrency),
    amount_cny: toMajor(baseMinor, baseCurrency),
  });

  const planned = toPair(plannedTrip, plannedBase);
  const booked = toPair(bookedTrip, bookedBase);
  const pending = toPair(pendingTrip, pendingBase);
  const spent = toPair(spentTrip, spentBase);
  const remaining = toPair(plannedTrip - spentTrip, plannedBase - spentBase);

  const categoryRows = Object.values(byCategory).map((row) => {
    const plannedPair = toPair(row.planned_trip, row.planned_base);
    const spentPair = toPair(row.spent_trip, row.spent_base);
    return {
      category: row.category,
      planned: plannedPair.amount,
      planned_cny: plannedPair.amount_cny,
      spent: spentPair.amount,
      spent_cny: spentPair.amount_cny,
      share: plannedTrip > 0 ? row.planned_trip / plannedTrip : 0,
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
  const money = resolveItemMoney(row, trip);
  const unit = resolveItemUnitMoney(row, trip);
  return {
    ...row,
    quote_in: normalizeQuoteIn(row.quote_in),
    qty: Number(row.qty) || 0,
    optional: Number(row.optional) === 1,
    unit_amount: toMajor(unit.tripMinor, currency),
    amount: toMajor(money.tripMinor, currency),
    unit_amount_cny: toMajor(unit.baseMinor, baseCurrency),
    amount_cny: toMajor(money.baseMinor, baseCurrency),
  };
}

function presentExpense(row, trip) {
  const currency = trip.trip_currency || 'CNY';
  const baseCurrency = trip.base_currency || 'CNY';
  const money = resolveExpenseMoney(row, trip);
  return {
    ...row,
    amount: toMajor(money.tripMinor, currency),
    amount_cny: toMajor(money.baseMinor, baseCurrency),
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

function persistBudgetItemMoney(item, trip) {
  const quoteIn = normalizeQuoteIn(item.quote_in);
  const locked = item.status === 'booked';
  const qty = Number(item.qty);
  const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
  const tripCurrency = trip.trip_currency || 'CNY';
  const baseCurrency = trip.base_currency || 'CNY';
  const hasAmount = item.amount != null && item.amount !== '';
  const hasAmountCny = item.amount_cny != null && item.amount_cny !== '';
  const unitTrip = toMinor(item.unit_amount, tripCurrency);
  const hasUnitBase = item.unit_amount_cny != null && item.unit_amount_cny !== '';
  const unitBase = hasUnitBase ? toMinor(item.unit_amount_cny, baseCurrency) : fromTripMinor(unitTrip, trip).baseMinor;

  let amountTrip;
  let amountBase;
  if (locked) {
    amountTrip = hasAmount ? toMinor(item.amount, tripCurrency) : Math.round(safeQty * unitTrip);
    amountBase = hasAmountCny ? toMinor(item.amount_cny, baseCurrency) : fromTripMinor(amountTrip, trip).baseMinor;
  } else if (quoteIn === 'base') {
    const baseMinor = hasAmountCny
      ? toMinor(item.amount_cny, baseCurrency)
      : Math.round(safeQty * unitBase);
    const pair = fromBaseMinor(baseMinor, trip);
    amountTrip = pair.tripMinor;
    amountBase = pair.baseMinor;
  } else if (hasAmount) {
    const pair = fromTripMinor(toMinor(item.amount, tripCurrency), trip);
    amountTrip = pair.tripMinor;
    amountBase = pair.baseMinor;
  } else {
    amountTrip = Math.round(safeQty * unitTrip);
    amountBase = fromTripMinor(amountTrip, trip).baseMinor;
  }

  return {
    quoteIn,
    safeQty: 1,
    unitTrip: amountTrip,
    unitBase: amountBase,
    amountTrip,
    amountBase,
  };
}

function persistExpenseMoney(body, trip) {
  const tripCurrency = trip.trip_currency || 'CNY';
  const baseCurrency = trip.base_currency || 'CNY';
  const hasAmount = body?.amount != null && body.amount !== '';
  const hasCny = body?.amount_cny != null && body.amount_cny !== '';
  if (hasAmount && hasCny) {
    return {
      amountMinor: toMinor(body.amount, tripCurrency),
      amountBaseMinor: toMinor(body.amount_cny, baseCurrency),
    };
  }
  if (hasCny) {
    const pair = fromBaseMinor(toMinor(body.amount_cny, baseCurrency), trip);
    return { amountMinor: pair.tripMinor, amountBaseMinor: pair.baseMinor };
  }
  const amountMinor = toMinor(body?.amount, tripCurrency);
  return {
    amountMinor,
    amountBaseMinor: toBaseMinor(amountMinor, tripCurrency, baseCurrency, trip.fx_rate),
  };
}

module.exports = {
  currencyScale,
  toMinor,
  toMajor,
  toBaseMinor,
  fromTripMinor,
  fromBaseMinor,
  roundMajor,
  parseIncludeOptional,
  normalizeQuoteIn,
  resolveItemMoney,
  resolveItemUnitMoney,
  resolveExpenseMoney,
  summarizeTrip,
  presentBudgetItem,
  presentExpense,
  resolveBudgetAmount,
  persistBudgetItemMoney,
  persistExpenseMoney,
};
