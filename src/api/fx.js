import { request, API_BASE } from './client';

export const FALLBACK_CURRENCIES = [
  { value: 'CNY', label: '人民币 CNY' },
  { value: 'JPY', label: '日元 JPY' },
  { value: 'USD', label: '美元 USD' },
  { value: 'EUR', label: '欧元 EUR' },
  { value: 'KRW', label: '韩元 KRW' },
  { value: 'HKD', label: '港币 HKD' },
  { value: 'THB', label: '泰铢 THB' },
];

let currencyCache = null;

export async function getCurrencies() {
  if (currencyCache) return currencyCache;
  try {
    const result = await request(`${API_BASE}/fx/currencies`);
    currencyCache = result.data?.length ? result.data : FALLBACK_CURRENCIES;
    return currencyCache;
  } catch {
    return FALLBACK_CURRENCIES;
  }
}

export async function getFxRate(from, to, date) {
  const source = String(from || 'CNY').toUpperCase();
  const target = String(to || 'CNY').toUpperCase();
  if (source === target) {
    return { rate: 1, date: date || new Date().toISOString().slice(0, 10) };
  }
  const params = new URLSearchParams({ from: source, to: target });
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) params.set('date', date);
  const result = await request(`${API_BASE}/fx/rate?${params.toString()}`);
  return result.data;
}
