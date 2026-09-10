const ZERO_DECIMAL = new Set(['JPY', 'KRW']);

export function currencyDigits(code) {
  return ZERO_DECIMAL.has(String(code || '').toUpperCase()) ? 0 : 2;
}

export function roundMoney(amount, currency) {
  const digits = currencyDigits(currency);
  const scale = 10 ** digits;
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * scale) / scale;
}

export function formatMoney(amount, currency = 'CNY') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: currencyDigits(currency),
    maximumFractionDigits: currencyDigits(currency),
  });
}

export function moneyText(amount, currency = 'CNY') {
  return `${formatMoney(amount, currency)} ${currency}`;
}

export function remainingClass(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  if (n < 0) return 'over';
  if (n === 0) return '';
  return 'ok';
}

export function foreignToBase(amount, fxRate, baseCurrency = 'CNY') {
  const rate = Number(fxRate);
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
  return roundMoney((Number(amount) || 0) * safeRate, baseCurrency);
}

export function baseToForeign(amount, fxRate, tripCurrency = 'CNY') {
  const rate = Number(fxRate);
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
  return roundMoney((Number(amount) || 0) / safeRate, tripCurrency);
}

export function isQuoteBase(quoteIn) {
  return quoteIn === 'base';
}

export function applyFxToBudgetItem(item, fxRate, tripCurrency, baseCurrency) {
  if (item.status === 'booked') return item;
  if (isQuoteBase(item.quote_in)) {
    return {
      ...item,
      amount: baseToForeign(item.amount_cny, fxRate, tripCurrency),
    };
  }
  return {
    ...item,
    amount_cny: foreignToBase(item.amount, fxRate, baseCurrency),
  };
}
