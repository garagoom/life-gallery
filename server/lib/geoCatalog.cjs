const PREFERRED = ['CN', 'JP', 'KR', 'TH', 'SG', 'MY', 'VN', 'US', 'GB', 'FR', 'IT', 'ES', 'AU', 'NZ', 'HK', 'TW', 'MO'];

function isCountryCode(value) {
  return /^[A-Z]{2}$/.test(String(value || '').toUpperCase()) && String(value).length === 2;
}

function isStateCode(value) {
  return /^[A-Za-z0-9_-]{1,16}$/.test(String(value || ''));
}

function pickLocalizedName(item) {
  const translations = item?.translations || {};
  return translations['zh-CN'] || translations.zh || translations.cn || item?.native || item?.name || '';
}

function translationMap(rows = []) {
  const map = {};
  for (const row of rows) {
    const code = String(row?.iso2 || '').toUpperCase();
    if (!code) continue;
    map[code] = row.translations?.['zh-CN'] || row.name || '';
  }
  return map;
}

function mapCountries(countries = [], zhNames = {}) {
  const rows = countries.map((country) => {
    const code = String(country?.iso2 || '').toUpperCase();
    const label = zhNames[code] || country?.native || country?.name || code;
    return {
      label,
      value: label,
      code,
      englishName: country?.name || code,
      isLeaf: false,
      currencies: country?.currency ? [String(country.currency).toUpperCase()] : [],
    };
  }).filter((item) => item.code && item.label);
  rows.sort((a, b) => {
    const ai = PREFERRED.indexOf(a.code);
    const bi = PREFERRED.indexOf(b.code);
    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
    return a.label.localeCompare(b.label, 'zh');
  });
  return rows;
}

function mapPlaces(list = [], { isLeaf } = { isLeaf: true }) {
  return (Array.isArray(list) ? list : [])
    .map((item) => {
      const label = pickLocalizedName(item);
      return {
        label,
        value: label,
        iso2: item?.iso2 || '',
        isLeaf: Boolean(isLeaf),
      };
    })
    .filter((item) => item.label);
}

module.exports = {
  PREFERRED,
  isCountryCode,
  isStateCode,
  pickLocalizedName,
  translationMap,
  mapCountries,
  mapPlaces,
};
