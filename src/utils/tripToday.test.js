import { describe, it, expect } from 'vitest';
import {
  formatTripDayDate,
  pickTodayTripDay,
  shortTripDayDate,
  todayInShanghai,
} from './tripToday';

const days = [
  { _key: 'd1', day_index: 1, date: '2026-09-25', title: '落地' },
  { _key: 'd2', day_index: 2, date: '2026-09-26', title: '市区' },
  { _key: 'd3', day_index: 3, date: '2026-09-27', title: 'USJ' },
];

describe('tripToday', () => {
  it('formats Shanghai calendar dates as YYYY-MM-DD', () => {
    expect(todayInShanghai(new Date('2026-09-10T16:30:00+08:00'))).toBe('2026-09-10');
    expect(todayInShanghai(new Date('2026-09-10T00:30:00+08:00'))).toBe('2026-09-10');
  });

  it('picks the itinerary row that matches today', () => {
    expect(pickTodayTripDay(days, '2026-09-26', '2026-09-25')?.title).toBe('市区');
  });

  it('falls back to day index from the start date when a row has no date', () => {
    const undated = [
      { _key: 'd1', day_index: 1, title: '落地' },
      { _key: 'd2', day_index: 2, title: '市区' },
    ];
    expect(pickTodayTripDay(undated, '2026-09-26', '2026-09-25')?.title).toBe('市区');
  });

  it('returns null before the trip starts', () => {
    expect(pickTodayTripDay(days, '2026-09-10', '2026-09-25')).toBeNull();
  });

  it('formats Chinese dates without timezone drift', () => {
    expect(formatTripDayDate('2026-09-26')).toBe('9月26日 周六');
    expect(shortTripDayDate('2026-09-26')).toBe('9/26');
  });
});
