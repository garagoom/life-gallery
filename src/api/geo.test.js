import { describe, it, expect } from 'vitest';
import { joinDestination, splitDestination, guessCurrencyFromDestination } from './geo';

describe('geo helpers', () => {
  it('joins and splits cascader paths', () => {
    expect(joinDestination([['日本', '大阪府', '大阪'], ['日本', '京都府', '京都']])).toBe('日本 / 大阪府 / 大阪 · 日本 / 京都府 / 京都');
    expect(splitDestination('日本 / 大阪府 / 大阪 · 日本 / 京都')).toEqual([
      ['日本', '大阪府', '大阪'],
      ['日本', '京都'],
    ]);
  });

  it('guesses currency from destination text', () => {
    const countries = [{ label: '日本', englishName: 'Japan', value: '日本', code: 'JP', currencies: ['JPY'] }];
    expect(guessCurrencyFromDestination('日本 / 大阪', countries)).toBe('JPY');
    expect(guessCurrencyFromDestination('Paris', countries)).toBe('');
  });
});
