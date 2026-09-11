const {
  gaussianScore,
  scoreHourSample,
  scoreEventWindow,
  buildGlowForecast,
  scoreLevel,
} = require('./glowScore.cjs');

describe('gaussianScore', () => {
  it('peaks near the target', () => {
    expect(gaussianScore(45, 45, 28)).toBe(100);
    expect(gaussianScore(10, 45, 28)).toBeLessThan(gaussianScore(40, 45, 28));
  });
});

describe('scoreHourSample', () => {
  it('scores ideal high cloud better than overcast low cloud', () => {
    const good = scoreHourSample({
      cloudHigh: 50,
      cloudMid: 30,
      cloudLow: 5,
      cloudTotal: 45,
      visibility: 20000,
      humidity: 55,
      precipProb: 5,
      precip: 0,
    });
    const bad = scoreHourSample({
      cloudHigh: 5,
      cloudMid: 10,
      cloudLow: 90,
      cloudTotal: 95,
      visibility: 2000,
      humidity: 95,
      precipProb: 80,
      precip: 3,
    });
    expect(good.score).toBeGreaterThan(bad.score);
    expect(good.score).toBeGreaterThanOrEqual(55);
    expect(bad.score).toBeLessThan(40);
  });
});

describe('scoreLevel', () => {
  it('maps score bands', () => {
    expect(scoreLevel(80).key).toBe('great');
    expect(scoreLevel(60).key).toBe('good');
    expect(scoreLevel(40).key).toBe('fair');
    expect(scoreLevel(10).key).toBe('poor');
  });
});

describe('scoreEventWindow', () => {
  it('picks the best hour near the event', () => {
    const event = new Date('2026-09-11T18:00:00+08:00');
    const samples = [
      {
        time: '2026-09-11T16:00:00+08:00',
        cloudHigh: 10, cloudMid: 10, cloudLow: 80, cloudTotal: 80,
        visibility: 5000, humidity: 80, precipProb: 40, precip: 0,
      },
      {
        time: '2026-09-11T18:00:00+08:00',
        cloudHigh: 55, cloudMid: 25, cloudLow: 5, cloudTotal: 40,
        visibility: 22000, humidity: 50, precipProb: 0, precip: 0,
      },
    ];
    const result = scoreEventWindow(samples, event, 1);
    expect(result.sampleAt).toBe('2026-09-11T18:00:00+08:00');
    expect(result.score).toBeGreaterThan(50);
  });
});

describe('buildGlowForecast', () => {
  it('builds evening and morning windows from forecast payload', () => {
    const forecast = {
      latitude: 31.23,
      longitude: 121.47,
      timezone: 'Asia/Shanghai',
      hourly: {
        time: [
          '2026-09-11T17:00:00',
          '2026-09-11T18:00:00',
          '2026-09-12T05:00:00',
          '2026-09-12T06:00:00',
        ],
        cloud_cover: [40, 45, 35, 40],
        cloud_cover_low: [5, 8, 10, 12],
        cloud_cover_mid: [20, 25, 20, 22],
        cloud_cover_high: [40, 50, 45, 40],
        visibility: [18000, 20000, 19000, 21000],
        relative_humidity_2m: [55, 50, 60, 58],
        precipitation_probability: [0, 0, 5, 0],
        precipitation: [0, 0, 0, 0],
      },
      daily: {
        sunrise: ['2026-09-11T05:40:00', '2026-09-12T05:41:00'],
        sunset: ['2026-09-11T18:05:00', '2026-09-12T18:04:00'],
      },
    };

    const now = new Date('2026-09-11T12:00:00+08:00');
    const data = buildGlowForecast(forecast, now);
    expect(data.evening.label).toBe('今晚晚霞');
    expect(data.morning.label).toBe('明早朝霞');
    expect(data.evening.past).toBe(false);
    expect(data.evening.sunAt).toBeTruthy();
    expect(data.morning.sunAt).toBeTruthy();
    expect(data.evening.score).toBeGreaterThan(0);
    expect(data.morning.score).toBeGreaterThan(0);
  });
});
