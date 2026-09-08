const ZH_NAMES = {
  CNY: '人民币', JPY: '日元', USD: '美元', EUR: '欧元', KRW: '韩元', HKD: '港币',
  THB: '泰铢', GBP: '英镑', AUD: '澳元', CAD: '加元', SGD: '新加坡元', TWD: '新台币',
  MYR: '马来西亚林吉特', VND: '越南盾', IDR: '印尼盾', PHP: '菲律宾比索', INR: '印度卢比',
  CHF: '瑞士法郎', NZD: '新西兰元', MOP: '澳门元',
};

function currencyLabel(code, englishName = '') {
  const zh = ZH_NAMES[code];
  if (zh) return `${zh} ${code}`;
  if (englishName) return `${englishName} ${code}`;
  return code;
}

function mapCurrencies(list = []) {
  return (Array.isArray(list) ? list : [])
    .map((item) => {
      const code = String(item?.code || '').toUpperCase();
      if (!code) return null;
      return { value: code, label: currencyLabel(code, item.name || '') };
    })
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label, 'zh'));
}

function parseFrankfurterRate(payload, to) {
  const rate = payload?.rates?.[to];
  return Number.isFinite(Number(rate)) ? Number(rate) : null;
}

function isCurrencyCode(value) {
  return /^[A-Z]{3}$/.test(String(value || '').toUpperCase());
}

module.exports = {
  ZH_NAMES,
  currencyLabel,
  mapCurrencies,
  parseFrankfurterRate,
  isCurrencyCode,
};
