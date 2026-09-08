const { describe, it, expect } = require('vitest');
const { buildDaysFromRange } = require('./tripDays.cjs');

describe('buildDaysFromRange', () => {
  it('builds one row per calendar day', () => {
    const days = buildDaysFromRange('2026-09-25', '2026-10-02');
    expect(days).toHaveLength(8);
    expect(days[0]).toEqual(expect.objectContaining({ day_index: 1, date: '2026-09-25' }));
    expect(days[7]).toEqual(expect.objectContaining({ day_index: 8, date: '2026-10-02' }));
  });

  it('returns empty when the range is invalid', () => {
    expect(buildDaysFromRange('2026-10-02', '2026-09-25')).toEqual([]);
    expect(buildDaysFromRange('', '2026-09-25')).toEqual([]);
  });
});
