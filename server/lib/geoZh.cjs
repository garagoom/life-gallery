const OpenCC = require('opencc-js');

const toSimplified = OpenCC.Converter({ from: 't', to: 'cn' });
const CJK_RE = /[\u3400-\u9fff]/;

function hasCjk(text) {
  return CJK_RE.test(String(text || ''));
}

function simplify(text) {
  const value = String(text || '').trim();
  if (!value) return '';
  return hasCjk(value) ? toSimplified(value) : value;
}

function cleanText(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return cleanText(value[0]);
  const text = String(value).trim();
  if (!text || text === '[]') return '';
  return simplify(text);
}

function uniqueParts(parts = []) {
  const seen = new Set();
  const rows = [];
  for (const part of parts) {
    const value = cleanText(part);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    rows.push(value);
  }
  return rows;
}

module.exports = {
  hasCjk,
  simplify,
  cleanText,
  uniqueParts,
};
