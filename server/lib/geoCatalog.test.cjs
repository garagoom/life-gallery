const {
  isCountryCode,
  isStateCode,
  pickLocalizedName,
  translationMap,
  mapCountries,
  mapPlaces,
} = require('./geoCatalog.cjs');

describe('geoCatalog', () => {
  it('validates country and state codes', () => {
    expect(isCountryCode('JP')).toBe(true);
    expect(isCountryCode('jp')).toBe(true);
    expect(isCountryCode('../')).toBe(false);
    expect(isStateCode('13')).toBe(true);
    expect(isStateCode('CA')).toBe(true);
    expect(isStateCode('../etc')).toBe(false);
  });

  it('prefers chinese country names and pins common destinations first', () => {
    const rows = mapCountries(
      [
        { iso2: 'US', name: 'United States', native: 'United States', currency: 'USD' },
        { iso2: 'JP', name: 'Japan', native: '日本', currency: 'JPY' },
        { iso2: 'FR', name: 'France', native: 'France', currency: 'EUR' },
      ],
      translationMap([
        { iso2: 'US', name: 'United States', translations: { 'zh-CN': '美国' } },
        { iso2: 'JP', name: 'Japan', translations: { 'zh-CN': '日本' } },
      ])
    );
    expect(rows[0]).toMatchObject({ code: 'JP', label: '日本', englishName: 'Japan', currencies: ['JPY'] });
    expect(rows.map((item) => item.code)).toEqual(['JP', 'US', 'FR']);
  });

  it('maps states and cities with native names when translations are missing', () => {
    expect(pickLocalizedName({ name: 'Aichi', native: '愛知', translations: {} })).toBe('愛知');
    expect(mapPlaces([{ name: 'Osaka', iso2: '27', native: '大阪' }], { isLeaf: false })).toEqual([
      { label: '大阪', value: '大阪', iso2: '27', isLeaf: false },
    ]);
  });
});
