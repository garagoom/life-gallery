const isoCountries = require('i18n-iso-countries');
const { uniqueParts, cleanText } = require('./geoZh.cjs');

isoCountries.registerLocale(require('i18n-iso-countries/langs/zh.json'));
isoCountries.registerLocale(require('i18n-iso-countries/langs/en.json'));

const PREFERRED = ['CN', 'JP', 'KR', 'TH', 'SG', 'MY', 'VN', 'US', 'GB', 'FR', 'IT', 'ES', 'AU', 'NZ', 'HK', 'TW', 'MO'];
const LABEL_OVERRIDES = {
  TW: '台湾',
};

function isCountryCode(value) {
  return /^[A-Z]{2}$/.test(String(value || '').toUpperCase()) && String(value).length === 2;
}

function chineseCountryName(code) {
  const iso2 = String(code || '').toUpperCase();
  return LABEL_OVERRIDES[iso2] || isoCountries.getName(iso2, 'zh') || isoCountries.getName(iso2, 'en') || iso2;
}

function englishCountryName(code) {
  const iso2 = String(code || '').toUpperCase();
  return isoCountries.getName(iso2, 'en') || iso2;
}

function mapCountries(rows = []) {
  const mapped = rows.map((country) => {
    const code = String(country?.iso2 || country?.code || '').toUpperCase();
    if (!isCountryCode(code)) return null;
    const label = chineseCountryName(code);
    return {
      label,
      value: label,
      code,
      englishName: englishCountryName(code),
      isLeaf: true,
      currencies: country?.currency ? [String(country.currency).toUpperCase()] : [],
    };
  }).filter(Boolean);

  mapped.sort((a, b) => {
    const ai = PREFERRED.indexOf(a.code);
    const bi = PREFERRED.indexOf(b.code);
    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
    return a.label.localeCompare(b.label, 'zh');
  });
  return mapped;
}

function pathToOption(parts, extra = {}) {
  const labels = uniqueParts(parts);
  if (!labels.length) return null;
  const value = labels.join(' / ');
  return {
    label: value,
    value,
    ...extra,
  };
}

function formatAmapTip(tip = {}) {
  const name = cleanText(tip.name);
  const district = cleanText(tip.district);
  const address = cleanText(tip.address);
  const parts = [];
  if (district) {
    const countryHint = address.length <= 4 ? address : '';
    if (countryHint && district.startsWith(countryHint)) {
      parts.push(countryHint, district.slice(countryHint.length), name);
    } else if (countryHint && !district.includes(countryHint)) {
      parts.push(countryHint, district, name);
    } else {
      parts.push(district, name);
    }
  } else {
    parts.push(address, name);
  }
  return pathToOption(parts);
}

function formatGeoname(row = {}) {
  return pathToOption([
    row.countryName,
    row.adminName1,
    row.adminName2,
    row.toponymName === row.name ? row.name : row.name,
  ], {
    code: String(row.countryCode || '').toUpperCase(),
  });
}

function searchLocalCountries(query, countries = []) {
  const q = cleanText(query).toLowerCase();
  if (!q) return [];
  return countries.filter((item) => (
    String(item.label || '').toLowerCase().includes(q)
    || String(item.englishName || '').toLowerCase().includes(q)
    || String(item.code || '').toLowerCase() === q
  )).slice(0, 12);
}

module.exports = {
  PREFERRED,
  isCountryCode,
  chineseCountryName,
  englishCountryName,
  mapCountries,
  pathToOption,
  formatAmapTip,
  formatGeoname,
  searchLocalCountries,
};
