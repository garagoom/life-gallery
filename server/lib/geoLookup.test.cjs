const { hasCjk, simplify, normalizePlaceQuery, pickChineseFromPhoton } = require('./geoLookup.cjs');

describe('geoLookup', () => {
  it('simplifies cjk names and strips english admin suffixes', () => {
    expect(hasCjk('足立区')).toBe(true);
    expect(hasCjk('Adachi Ku')).toBe(false);
    expect(simplify('東京')).toBe('东京');
    expect(simplify('愛知')).toBe('爱知');
    expect(normalizePlaceQuery('Adachi Ku')).toBe('Adachi');
    expect(normalizePlaceQuery('Akishima-shi')).toBe('Akishima');
  });

  it('prefers chinese place names from photon features', () => {
    const label = pickChineseFromPhoton([
      { properties: { osm_key: 'shop', type: 'house', name: 'Re.Ra.Ku', district: '足立区', city: '東京都' } },
      { properties: { osm_key: 'place', type: 'district', name: '朝阳区', city: '北京市' } },
    ]);
    expect(label).toBe('朝阳区');
    expect(pickChineseFromPhoton([
      { properties: { osm_key: 'shop', type: 'house', name: 'Re.Ra.Ku', district: '足立区', city: '東京都' } },
    ])).toBe('足立区');
  });
});
