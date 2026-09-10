const { hasCjk, simplify, cleanText, uniqueParts } = require('./geoZh.cjs');

describe('geoZh', () => {
  it('simplifies cjk names and ignores empty amap placeholders', () => {
    expect(hasCjk('足立区')).toBe(true);
    expect(hasCjk('Adachi Ku')).toBe(false);
    expect(simplify('東京')).toBe('东京');
    expect(simplify('愛知')).toBe('爱知');
    expect(cleanText('[]')).toBe('');
    expect(cleanText(['大阪府'])).toBe('大阪府');
    expect(uniqueParts(['日本', '日本', '大阪府', ''])).toEqual(['日本', '大阪府']);
  });
});
