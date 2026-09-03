const METERING_MODE_LABELS = {
  0: '未知',
  1: '平均测光',
  2: '中央重点测光',
  3: '点测光',
  4: '多点测光',
  5: '评价测光',
  6: '局部测光',
  255: '其他',
};

const WHITE_BALANCE_LABELS = {
  0: '自动',
  1: '手动',
};

function isChineseLabel(value) {
  return typeof value === 'string' && /[\u4e00-\u9fff]/.test(value);
}

export function formatMeteringMode(value) {
  if (value == null || value === '') return '';
  if (isChineseLabel(value)) return value;
  const num = Number(value);
  if (Number.isFinite(num) && METERING_MODE_LABELS[num] != null) {
    return METERING_MODE_LABELS[num];
  }
  return String(value);
}

export function formatWhiteBalance(value) {
  if (value == null || value === '') return '';
  if (isChineseLabel(value)) return value;
  const num = Number(value);
  if (Number.isFinite(num) && WHITE_BALANCE_LABELS[num] != null) {
    return WHITE_BALANCE_LABELS[num];
  }
  return String(value);
}

export function formatExposureBias(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string' && /EV/i.test(value)) return value;

  let num;
  if (typeof value === 'object' && value.numerator != null && value.denominator) {
    num = value.numerator / value.denominator;
  } else {
    num = Number(value);
  }
  if (!Number.isFinite(num)) return String(value);
  if (Math.abs(num) < 0.01) return '0 EV';

  const thirds = Math.round(num * 3);
  if (Math.abs(num * 3 - thirds) < 0.08) {
    const sign = thirds > 0 ? '+' : '-';
    const abs = Math.abs(thirds);
    if (abs % 3 === 0) return `${sign}${abs / 3} EV`;
    return `${sign}${abs}/3 EV`;
  }

  const rounded = Math.round(num * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${String(rounded)} EV`;
}
