const { currencyLabel, mapCurrencies, parseFrankfurterRate } = require('./fxCatalog.cjs');

describe('fxCatalog', () => {
  it('labels currencies in chinese when possible', () => {
    expect(currencyLabel('JPY', 'Japanese yen')).toBe('日元 JPY');
    expect(currencyLabel('AAA', 'Unknown')).toBe('Unknown AAA');
  });

  it('maps currency records to select options', () => {
    const options = mapCurrencies([
      { code: 'JPY', name: 'Japanese yen' },
      { code: 'CNY', name: 'Yuan Renminbi' },
    ]);
    expect(options).toEqual(expect.arrayContaining([
      { value: 'JPY', label: '日元 JPY' },
      { value: 'CNY', label: '人民币 CNY' },
    ]));
  });

  it('reads a frankfurter quote', () => {
    expect(parseFrankfurterRate({ rates: { CNY: 0.048 } }, 'CNY')).toBe(0.048);
    expect(parseFrankfurterRate({ rates: {} }, 'CNY')).toBeNull();
  });
});
