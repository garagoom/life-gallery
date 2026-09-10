const {
  isCountryCode,
  chineseCountryName,
  mapCountries,
  formatAmapTip,
  formatGeoname,
  searchLocalCountries,
} = require('./geoCatalog.cjs');

describe('geoCatalog', () => {
  it('uses chinese country names and pins common destinations first', () => {
    const rows = mapCountries([
      { iso2: 'US', currency: 'USD' },
      { iso2: 'JP', currency: 'JPY' },
      { iso2: 'FR', currency: 'EUR' },
      { iso2: 'TW', currency: 'TWD' },
    ]);
    expect(chineseCountryName('JP')).toBe('日本');
    expect(rows[0]).toMatchObject({ code: 'JP', label: '日本', englishName: 'Japan', currencies: ['JPY'] });
    expect(rows.find((item) => item.code === 'TW').label).toBe('台湾');
    expect(rows.map((item) => item.code)).toEqual(['JP', 'US', 'FR', 'TW']);
    expect(isCountryCode('../')).toBe(false);
  });

  it('formats amap and geonames hits as chinese paths', () => {
    expect(formatAmapTip({
      name: '大阪市',
      district: '日本大阪府',
      address: '日本',
    })).toEqual({
      label: '日本 / 大阪府 / 大阪市',
      value: '日本 / 大阪府 / 大阪市',
    });
    expect(formatGeoname({
      name: '巴黎',
      countryName: '法国',
      adminName1: '法兰西岛',
      countryCode: 'FR',
    })).toMatchObject({
      label: '法国 / 法兰西岛 / 巴黎',
      value: '法国 / 法兰西岛 / 巴黎',
      code: 'FR',
    });
  });

  it('searches local chinese country names', () => {
    const countries = mapCountries([{ iso2: 'JP', currency: 'JPY' }, { iso2: 'FR', currency: 'EUR' }]);
    expect(searchLocalCountries('日本', countries)[0].label).toBe('日本');
    expect(searchLocalCountries('france', countries)[0].code).toBe('FR');
  });
});
