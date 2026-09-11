/** 高斯型得分：peak 附近最高，sigma 控制宽容度 */
function gaussianScore(value, peak, sigma, min = 0, max = 100) {
  const v = Number(value);
  if (!Number.isFinite(v)) return 0;
  const clamped = Math.min(max, Math.max(min, v));
  const z = (clamped - peak) / Math.max(sigma, 1e-6);
  return Math.round(100 * Math.exp(-0.5 * z * z));
}

/** 单调：值越大越好（线性映射到 0–100） */
function risingScore(value, low, high) {
  const v = Number(value);
  if (!Number.isFinite(v)) return 0;
  if (v <= low) return 0;
  if (v >= high) return 100;
  return Math.round(((v - low) / (high - low)) * 100);
}

/** 单调：值越大越差 */
function fallingScore(value, low, high) {
  return 100 - risingScore(value, low, high);
}

function scoreLevel(score) {
  const s = Math.round(Number(score) || 0);
  if (s >= 75) return { key: 'great', label: '大烧', color: 'magenta' };
  if (s >= 55) return { key: 'good', label: '不错', color: 'orange' };
  if (s >= 35) return { key: 'fair', label: '可看', color: 'gold' };
  return { key: 'poor', label: '冷门', color: 'default' };
}

/**
 * 对单一小时样本打分（各因子 0–100，再加权）
 * @param {{ cloudHigh?: number, cloudMid?: number, cloudLow?: number, cloudTotal?: number, visibility?: number, humidity?: number, precipProb?: number, precip?: number }} sample
 */
function scoreHourSample(sample = {}) {
  const high = Number(sample.cloudHigh);
  const mid = Number(sample.cloudMid);
  const low = Number(sample.cloudLow);
  const total = Number(sample.cloudTotal);
  const visibility = Number(sample.visibility); // meters
  const humidity = Number(sample.humidity);
  const precipProb = Number(sample.precipProb);
  const precip = Number(sample.precip);

  const factors = {
    highCloud: gaussianScore(high, 45, 28),
    midCloud: gaussianScore(mid, 35, 25),
    lowCloud: fallingScore(low, 10, 70),
    totalCloud: gaussianScore(total, 40, 30),
    visibility: risingScore(visibility, 4000, 25000),
    humidity: gaussianScore(humidity, 55, 22),
    precip: Math.min(
      fallingScore(precipProb, 10, 70),
      precip > 0.2 ? fallingScore(precip, 0.1, 2) : 100,
    ),
  };

  const score = Math.round(
    factors.highCloud * 0.28
    + factors.midCloud * 0.18
    + factors.lowCloud * 0.18
    + factors.totalCloud * 0.12
    + factors.visibility * 0.12
    + factors.humidity * 0.07
    + factors.precip * 0.05,
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    factors,
  };
}

function parseIso(ts) {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 在 eventTime 前后 windowHours 内，取小时样本中得分最高者
 */
function scoreEventWindow(hourlySamples, eventTime, windowHours = 1) {
  const event = eventTime instanceof Date ? eventTime : parseIso(eventTime);
  if (!event || !Array.isArray(hourlySamples) || !hourlySamples.length) {
    return {
      score: 0,
      level: scoreLevel(0),
      factors: {},
      sampleAt: null,
      start: null,
      end: null,
    };
  }

  const halfMs = windowHours * 60 * 60 * 1000;
  const start = new Date(event.getTime() - halfMs);
  const end = new Date(event.getTime() + halfMs);

  let best = null;
  for (const sample of hourlySamples) {
    const t = parseIso(sample.time);
    if (!t || t < start || t > end) continue;
    const scored = scoreHourSample(sample);
    if (!best || scored.score > best.score) {
      best = { ...scored, sampleAt: sample.time };
    }
  }

  if (!best) {
    // 窗口内无点时，取最接近 event 的一小时
    let nearest = null;
    let nearestDist = Infinity;
    for (const sample of hourlySamples) {
      const t = parseIso(sample.time);
      if (!t) continue;
      const dist = Math.abs(t.getTime() - event.getTime());
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = sample;
      }
    }
    if (nearest) {
      const scored = scoreHourSample(nearest);
      best = { ...scored, sampleAt: nearest.time };
    }
  }

  const score = best?.score ?? 0;
  return {
    score,
    level: scoreLevel(score),
    factors: best?.factors || {},
    sampleAt: best?.sampleAt || null,
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function buildHourlySamples(hourly = {}) {
  const times = hourly.time || [];
  return times.map((time, i) => ({
    time,
    cloudHigh: hourly.cloud_cover_high?.[i],
    cloudMid: hourly.cloud_cover_mid?.[i],
    cloudLow: hourly.cloud_cover_low?.[i],
    cloudTotal: hourly.cloud_cover?.[i],
    visibility: hourly.visibility?.[i],
    humidity: hourly.relative_humidity_2m?.[i],
    precipProb: hourly.precipitation_probability?.[i],
    precip: hourly.precipitation?.[i],
  }));
}

/**
 * 从 Open-Meteo forecast JSON 生成今晚晚霞 + 明早朝霞
 * @param {object} forecast Open-Meteo response
 * @param {Date} [now]
 */
function buildGlowForecast(forecast, now = new Date()) {
  const samples = buildHourlySamples(forecast.hourly || {});
  const daily = forecast.daily || {};
  const sunrises = daily.sunrise || [];
  const sunsets = daily.sunset || [];

  const todaySunset = sunsets[0] ? parseIso(sunsets[0]) : null;
  // forecast_days=2：index 0 今天，index 1 明天
  const tomorrowSunrise = sunrises[1] ? parseIso(sunrises[1]) : (sunrises[0] ? parseIso(sunrises[0]) : null);

  const eveningBase = scoreEventWindow(samples, todaySunset, 1);
  const morningBase = scoreEventWindow(samples, tomorrowSunrise, 1);

  const eveningEnd = eveningBase.end ? parseIso(eveningBase.end) : null;
  const eveningPast = !!(eveningEnd && now.getTime() > eveningEnd.getTime());

  return {
    timezone: forecast.timezone || null,
    latitude: forecast.latitude,
    longitude: forecast.longitude,
    evening: {
      kind: 'evening',
      label: '今晚晚霞',
      sunAt: todaySunset ? todaySunset.toISOString() : null,
      past: eveningPast,
      ...eveningBase,
    },
    morning: {
      kind: 'morning',
      label: '明早朝霞',
      sunAt: tomorrowSunrise ? tomorrowSunrise.toISOString() : null,
      past: false,
      ...morningBase,
    },
  };
}

module.exports = {
  gaussianScore,
  risingScore,
  fallingScore,
  scoreLevel,
  scoreHourSample,
  scoreEventWindow,
  buildHourlySamples,
  buildGlowForecast,
};
