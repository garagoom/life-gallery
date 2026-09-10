const { todayInShanghai, nextAutoTripStatus } = require('./tripStatus.cjs');

describe('tripStatus', () => {
  it('uses Asia/Shanghai calendar dates', () => {
    expect(todayInShanghai(new Date('2026-09-10T15:59:00Z'))).toBe('2026-09-10');
    expect(todayInShanghai(new Date('2026-09-10T16:00:00Z'))).toBe('2026-09-11');
  });

  it('promotes upcoming trips to ongoing while today is in range', () => {
    const trip = { status: 'upcoming', start_date: '2026-09-08', end_date: '2026-09-12' };
    expect(nextAutoTripStatus(trip, '2026-09-10')).toBe('ongoing');
    expect(nextAutoTripStatus(trip, '2026-09-08')).toBe('ongoing');
    expect(nextAutoTripStatus(trip, '2026-09-12')).toBe('ongoing');
    expect(nextAutoTripStatus(trip, '2026-09-07')).toBe('upcoming');
  });

  it('completes ongoing trips after the end date', () => {
    const trip = { status: 'ongoing', start_date: '2026-09-08', end_date: '2026-09-12' };
    expect(nextAutoTripStatus(trip, '2026-09-12')).toBe('ongoing');
    expect(nextAutoTripStatus(trip, '2026-09-13')).toBe('completed');
  });

  it('completes upcoming trips that already ended', () => {
    const trip = { status: 'upcoming', start_date: '2026-09-01', end_date: '2026-09-05' };
    expect(nextAutoTripStatus(trip, '2026-09-10')).toBe('completed');
  });

  it('cancels planning trips once the start date arrives', () => {
    const dates = { start_date: '2026-09-08', end_date: '2026-09-12' };
    expect(nextAutoTripStatus({ ...dates, status: 'planning' }, '2026-09-07')).toBe('planning');
    expect(nextAutoTripStatus({ ...dates, status: 'planning' }, '2026-09-08')).toBe('cancelled');
    expect(nextAutoTripStatus({ ...dates, status: 'planning' }, '2026-09-10')).toBe('cancelled');
  });

  it('leaves cancelled and completed trips unchanged', () => {
    const dates = { start_date: '2026-09-08', end_date: '2026-09-12' };
    expect(nextAutoTripStatus({ ...dates, status: 'cancelled' }, '2026-09-10')).toBe('cancelled');
    expect(nextAutoTripStatus({ ...dates, status: 'completed' }, '2026-09-13')).toBe('completed');
  });
});
