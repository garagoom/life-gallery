const { formatPlace, listPresetPlaces, searchGlowPlaces } = require('./glowPlaces.cjs');

describe('glowPlaces', () => {
  it('lists preset places with coordinates', () => {
    const rows = listPresetPlaces();
    expect(rows.length).toBeGreaterThan(5);
    expect(rows[0]).toMatchObject({ label: '上海' });
    expect(Number.isFinite(rows[0].lat)).toBe(true);
    expect(Number.isFinite(rows[0].lng)).toBe(true);
  });

  it('formats open-meteo geocode hits', () => {
    expect(formatPlace({
      name: '大阪',
      latitude: 34.6937,
      longitude: 135.5023,
      country: '日本',
      admin1: '大阪府',
    })).toMatchObject({
      label: '日本 / 大阪府 / 大阪',
      lat: 34.6937,
      lng: 135.5023,
    });
  });

  it('returns presets when query is empty', async () => {
    const rows = await searchGlowPlaces('');
    expect(rows.some((item) => item.label === '上海')).toBe(true);
  });
});
