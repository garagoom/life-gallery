import dayjs from 'dayjs';
import { foreignToBase } from './tripMoney';

export const TRIP_STATUS_MAP = [
  ['planning', '筹划中'],
  ['upcoming', '待出发'],
  ['ongoing', '进行中'],
  ['completed', '已结束'],
  ['cancelled', '已取消'],
];

export const BUDGET_STATUS_MAP = [
  ['booked', '已订'],
  ['pending', '待购'],
  ['estimated', '估算'],
];

export const CATEGORY_MAP = [
  ['flight', '机票'],
  ['lodging', '住宿'],
  ['transport', '交通'],
  ['tickets', '门票'],
  ['attraction', '景点'],
  ['experience', '体验'],
  ['food', '餐饮'],
  ['shopping', '购物'],
  ['misc', '杂费'],
];

export const CURRENCY_CODES = ['CNY', 'JPY', 'USD', 'EUR', 'KRW', 'HKD', 'THB'];

export const TRIP_META_HEADERS = ['标题', '目的地', '开始日期', '结束日期', '状态', '人数', '行程备注'];
export const TRIP_DAY_HEADERS = ['DAY', '日期', '主题', '住宿', '备注'];
export const BUDGET_META_HEADERS = ['出行币', '本币', '汇率', '汇率日期', '备注', '主线'];
export const BUDGET_ITEM_HEADERS = ['类别', '项目', '金额', '本币金额', '状态', '可选', '主币', '备注'];
export const EXPENSE_HEADERS = ['日期', '项目', '类别', '金额', '本币金额', '对照预算项目', '备注'];

export function normHeader(value) {
  return String(value || '')
    .replace(/\*+$/g, '')
    .replace(/[(（][^)）]*[)）]\s*$/g, '')
    .replace(/\s+/g, '')
    .trim();
}

export function cellText(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) return dayjs(value).format('YYYY-MM-DD');
  if (typeof value === 'object') {
    if (value.richText) return value.richText.map((part) => part.text || '').join('');
    if (value.text) return String(value.text);
    if (value.result != null) return cellText(value.result);
    if (value.hyperlink) return String(value.text || value.hyperlink);
  }
  return String(value).trim();
}

export function parseDate(value) {
  const text = cellText(value);
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
      return dayjs('1899-12-30').add(serial, 'day').format('YYYY-MM-DD');
    }
  }
  const parsed = dayjs(text);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
}

export function parseNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = cellText(value).replace(/,/g, '');
  if (!text) return fallback;
  const n = Number(text);
  return Number.isFinite(n) ? n : fallback;
}

function parseOptionalNumber(value) {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = cellText(value).replace(/,/g, '');
  if (!text) return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

export function parseYesNo(value) {
  const text = cellText(value).toLowerCase();
  return text === '是' || text === '1' || text === 'true' || text === 'yes' || text === 'y';
}

function lookupCode(map, value, fallback) {
  const text = cellText(value);
  if (!text) return fallback;
  const hit = map.find(([code, label]) => code === text || label === text);
  return hit ? hit[0] : fallback;
}

function lookupLabel(map, value, fallback = '') {
  const hit = map.find(([code]) => code === value);
  return hit ? hit[1] : (value || fallback);
}

export function parseTripStatus(value) {
  return lookupCode(TRIP_STATUS_MAP, value, 'planning');
}

export function parseBudgetStatus(value) {
  return lookupCode(BUDGET_STATUS_MAP, value, 'pending');
}

export function parseCategory(value) {
  return lookupCode(CATEGORY_MAP, value, 'misc');
}

export function parseCurrency(value, fallback = 'CNY') {
  const text = cellText(value).toUpperCase();
  if (CURRENCY_CODES.includes(text)) return text;
  const aliases = { 人民币: 'CNY', 日元: 'JPY', 美元: 'USD', 欧元: 'EUR', 韩元: 'KRW', 港币: 'HKD', 泰铢: 'THB' };
  return aliases[cellText(value)] || fallback;
}

export function parseQuoteIn(value) {
  const text = cellText(value).toLowerCase();
  if (text === 'base' || text === '本币' || text === '人民币') return 'base';
  return 'trip';
}

export function quoteInLabel(value) {
  return value === 'base' ? '本币' : '出行币';
}

export function currencyDisplayName(code) {
  const aliases = {
    CNY: '人民币',
    JPY: '日元',
    USD: '美元',
    EUR: '欧元',
    KRW: '韩元',
    HKD: '港币',
    THB: '泰铢',
  };
  const normalized = String(code || 'CNY').toUpperCase();
  return aliases[normalized] || normalized;
}

export function moneyColumnHeader(label, currency) {
  return `${label}(${currencyDisplayName(currency)})`;
}

export function withCurrencyHeaders(headers, tripCurrency, baseCurrency) {
  const tripCols = new Set(['单价', '小计', '金额']);
  const baseCols = new Set(['本币单价', '本币小计', '本币金额']);
  return headers.map((header) => {
    if (tripCols.has(header)) return moneyColumnHeader(header, tripCurrency);
    if (baseCols.has(header)) return moneyColumnHeader(header, baseCurrency);
    return header;
  });
}

export function resolveBaseMajor(tripAmount, baseAmount, fxRate, baseCurrency) {
  if (baseAmount != null && baseAmount !== '') return Number(baseAmount);
  return foreignToBase(tripAmount, fxRate, baseCurrency);
}

export function tripStatusLabel(value) {
  return lookupLabel(TRIP_STATUS_MAP, value, value);
}

export function budgetStatusLabel(value) {
  return lookupLabel(BUDGET_STATUS_MAP, value, value);
}

export function categoryLabel(value) {
  return lookupLabel(CATEGORY_MAP, value, value);
}

export function rowsToObjects(rows) {
  if (!rows?.length) return [];
  const headers = (rows[0] || []).map(normHeader);
  return rows.slice(1).map((row) => {
    const item = {};
    headers.forEach((key, index) => {
      if (key) item[key] = row[index];
    });
    return item;
  });
}

export function parseTripPayload(metaRow = {}, dayRows = []) {
  const title = cellText(metaRow['标题']);
  const days = dayRows
    .map((row, index) => ({
      day_index: parseNumber(row['DAY'], index + 1),
      date: parseDate(row['日期']),
      title: cellText(row['主题']),
      lodging: cellText(row['住宿']),
      notes: cellText(row['备注']),
      sort_order: index,
    }))
    .filter((day) => day.date || day.title || day.lodging || day.notes);

  return {
    title,
    destination: cellText(metaRow['目的地']),
    start_date: parseDate(metaRow['开始日期']) || null,
    end_date: parseDate(metaRow['结束日期']) || null,
    status: parseTripStatus(metaRow['状态']),
    party_size: Math.max(1, Math.round(parseNumber(metaRow['人数'], 1))),
    summary: cellText(metaRow['行程备注']),
    days,
  };
}

export function parseBudgetPayload(metaRow = {}, itemRows = [], expenseRows = []) {
  const title = cellText(metaRow['标题']);
  const items = itemRows
    .map((row, index) => {
      const qty = parseNumber(row['数量'], 1);
      const unitAmount = parseNumber(row['单价'], 0);
      const unitAmountCny = parseOptionalNumber(row['本币单价']);
      let amount = parseOptionalNumber(row['金额']);
      if (amount == null) amount = parseNumber(row['小计'], 0);
      if (!amount && unitAmount) amount = qty * unitAmount;
      let amountCny = parseOptionalNumber(row['本币金额']);
      if (amountCny == null) amountCny = parseOptionalNumber(row['本币小计']);
      if (amountCny == null && unitAmountCny != null) amountCny = qty * unitAmountCny;
      return {
        category: parseCategory(row['类别']),
        title: cellText(row['项目']),
        quote_in: parseQuoteIn(row['主币']),
        amount,
        amount_cny: amountCny,
        status: parseBudgetStatus(row['状态']),
        optional: parseYesNo(row['可选']),
        note: cellText(row['备注']),
        sort_order: index,
      };
    })
    .filter((item) => item.title);

  const expenses = expenseRows
    .map((row) => ({
      spent_on: parseDate(row['日期']) || null,
      title: cellText(row['项目']),
      category: cellText(row['类别']) ? parseCategory(row['类别']) : '',
      amount: parseNumber(row['金额'], 0),
      amount_cny: parseOptionalNumber(row['本币金额']),
      budget_item_title: cellText(row['对照预算项目']),
      note: cellText(row['备注']),
    }))
    .filter((item) => item.title);

  return {
    title,
    trip_title: cellText(metaRow['关联出游标题']),
    party_size: Math.max(1, Math.round(parseNumber(metaRow['人数'], 1))),
    trip_currency: parseCurrency(metaRow['出行币'], 'CNY'),
    base_currency: parseCurrency(metaRow['本币'], 'CNY'),
    fx_rate: parseNumber(metaRow['汇率'], 1),
    fx_date: parseDate(metaRow['汇率日期']) || null,
    note: cellText(metaRow['备注']),
    is_main: parseYesNo(metaRow['主线']),
    items,
    expenses,
  };
}

export function parsePlanFromSheets(sheets = {}) {
  const tripMeta = (sheets['出游信息'] || [])[0];
  if (!tripMeta || !cellText(tripMeta['标题'])) {
    throw new Error('「出游信息」缺少标题。一份模板只对应一次出游计划');
  }
  const trip = parseTripPayload(tripMeta, sheets['日程'] || []);
  const budgetMeta = (sheets['预算信息'] || [])[0] || {};
  const itemRows = sheets['预算明细'] || [];
  const expenseRows = sheets['实际记账'] || [];
  const hasBudget = cellText(budgetMeta['出行币'])
    || cellText(budgetMeta['本币'])
    || cellText(budgetMeta['汇率'])
    || itemRows.some((row) => cellText(row['项目']))
    || expenseRows.some((row) => cellText(row['项目']));
  if (!hasBudget) return { trip, budget: null };

  const budget = parseBudgetPayload({
    标题: cellText(budgetMeta['标题']) || `${trip.title} 预算`,
    人数: budgetMeta['人数'] ?? trip.party_size,
    出行币: budgetMeta['出行币'],
    本币: budgetMeta['本币'],
    汇率: budgetMeta['汇率'],
    汇率日期: budgetMeta['汇率日期'],
    备注: budgetMeta['备注'],
    主线: budgetMeta['主线'],
  }, itemRows, expenseRows);
  return { trip, budget };
}

export function buildTripMarkdown(trip, getLabel = tripStatusLabel) {
  const status = typeof getLabel === 'function' ? getLabel(trip.status) : tripStatusLabel(trip.status);
  const dates = [trip.start_date, trip.end_date].filter(Boolean).join(' ~ ');
  const lines = [
    `# ${trip.title || '出游计划'}`,
    '',
    `- 目的地：${trip.destination || '-'}`,
    `- 日期：${dates || '-'}`,
    `- 状态：${status || '-'}`,
    `- 人数：${trip.party_size || 1}`,
    '',
  ];
  if (trip.summary) {
    lines.push('## 行程备注', '', trip.summary, '');
  }
  lines.push('## 日程', '');
  (trip.days || []).forEach((day, index) => {
    lines.push(`### DAY ${day.day_index || index + 1} ${day.date || ''} ${day.title || ''}`.trim());
    if (day.lodging) lines.push(`- 住宿：${day.lodging}`);
    if (day.notes) lines.push('', day.notes);
    lines.push('');
  });
  return `${lines.join('\n').trim()}\n`;
}

export function buildBudgetMarkdown(budget) {
  const tripTitle = budget.trip?.title || budget.trip_title || '未关联';
  const dates = [budget.trip?.start_date, budget.trip?.end_date].filter(Boolean).join(' ~ ');
  const stats = budget.summary_stats || {};
  const tripCur = budget.trip_currency || 'CNY';
  const baseCur = budget.base_currency || 'CNY';
  const tripName = currencyDisplayName(tripCur);
  const baseName = currencyDisplayName(baseCur);
  const fxRate = budget.fx_rate ?? 1;
  const lines = [
    `# ${budget.title || '预算'}`,
    '',
    `- 关联出游：${tripTitle}`,
    dates ? `- 日期：${dates}` : null,
    `- 人数：${budget.party_size || 1}`,
    `- 出行币：${tripCur}`,
    `- 本币：${baseCur}`,
    `- 汇率：${fxRate}`,
    budget.fx_date ? `- 汇率日期：${budget.fx_date}` : null,
    '',
    '## 汇总',
    '',
    `- 计划合计：${stats.planned_total ?? '-'} ${tripName} / ${stats.planned_total_cny ?? '-'} ${baseName}`,
    `- 已订：${stats.booked_total ?? '-'} ${tripName} / ${stats.booked_total_cny ?? '-'} ${baseName}`,
    `- 已支出：${stats.spent_total ?? '-'} ${tripName} / ${stats.spent_total_cny ?? '-'} ${baseName}`,
    `- 剩余：${stats.remaining ?? '-'} ${tripName} / ${stats.remaining_cny ?? '-'} ${baseName}`,
    '',
    '## 预算明细',
    '',
    `| 类别 | 项目 | 金额(${tripName}) | 本币金额(${baseName}) | 状态 | 可选 | 主币 | 备注 |`,
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ].filter((line) => line != null);

  (budget.items || budget.budget_items || []).forEach((item) => {
    const amountBase = resolveBaseMajor(item.amount, item.amount_cny, fxRate, baseCur);
    lines.push(`| ${categoryLabel(item.category)} | ${item.title || ''} | ${item.amount ?? ''} | ${amountBase} | ${budgetStatusLabel(item.status)} | ${item.optional ? '是' : '否'} | ${quoteInLabel(item.quote_in)} | ${item.note || ''} |`);
  });

  lines.push('', '## 实际记账', '', `| 日期 | 项目 | 类别 | 金额(${tripName}) | 本币金额(${baseName}) | 备注 |`, '| --- | --- | --- | --- | --- | --- |');
  (budget.expenses || []).forEach((item) => {
    const amountBase = resolveBaseMajor(item.amount, item.amount_cny, fxRate, baseCur);
    lines.push(`| ${item.spent_on || ''} | ${item.title || ''} | ${item.category ? categoryLabel(item.category) : ''} | ${item.amount ?? ''} | ${amountBase} | ${item.note || ''} |`);
  });

  if (budget.note) {
    lines.push('', '## 备注', '', budget.note);
  }
  return `${lines.join('\n').trim()}\n`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildTripHtml(trip) {
  const days = (trip.days || []).map((day, index) => `
    <tr>
      <td>${escapeHtml(day.day_index || index + 1)}</td>
      <td>${escapeHtml(day.date)}</td>
      <td>${escapeHtml(day.title)}</td>
      <td>${escapeHtml(day.lodging)}</td>
      <td>${escapeHtml(day.notes)}</td>
    </tr>
  `).join('');
  return `
    <div class="export-doc">
      <h1>${escapeHtml(trip.title || '出游计划')}</h1>
      <p>目的地：${escapeHtml(trip.destination || '-')}　日期：${escapeHtml([trip.start_date, trip.end_date].filter(Boolean).join(' ~ ') || '-')}　人数：${escapeHtml(trip.party_size || 1)}　状态：${escapeHtml(tripStatusLabel(trip.status))}</p>
      ${trip.summary ? `<h2>行程备注</h2><pre>${escapeHtml(trip.summary)}</pre>` : ''}
      <h2>日程</h2>
      <table>
        <thead><tr><th>DAY</th><th>日期</th><th>主题</th><th>住宿</th><th>备注</th></tr></thead>
        <tbody>${days}</tbody>
      </table>
    </div>
  `;
}

export function buildBudgetHtml(budget) {
  const tripCur = budget.trip_currency || 'CNY';
  const baseCur = budget.base_currency || 'CNY';
  const fxRate = budget.fx_rate ?? 1;
  const tripName = currencyDisplayName(tripCur);
  const baseName = currencyDisplayName(baseCur);
  const items = (budget.items || budget.budget_items || []).map((item) => `
    <tr>
      <td>${escapeHtml(categoryLabel(item.category))}</td>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml(money(item.amount, tripCur))}</td>
      <td>${escapeHtml(money(resolveBaseMajor(item.amount, item.amount_cny, fxRate, baseCur), baseCur))}</td>
      <td>${escapeHtml(budgetStatusLabel(item.status))}</td>
      <td>${item.optional ? '是' : '否'}</td>
      <td>${escapeHtml(quoteInLabel(item.quote_in))}</td>
      <td>${escapeHtml(item.note)}</td>
    </tr>
  `).join('');
  const expenses = (budget.expenses || []).map((item) => `
    <tr>
      <td>${escapeHtml(item.spent_on)}</td>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml(item.category ? categoryLabel(item.category) : '')}</td>
      <td>${escapeHtml(money(item.amount, tripCur))}</td>
      <td>${escapeHtml(money(resolveBaseMajor(item.amount, item.amount_cny, fxRate, baseCur), baseCur))}</td>
      <td>${escapeHtml(item.note)}</td>
    </tr>
  `).join('');
  const stats = budget.summary_stats || {};
  return `
    <div class="export-doc">
      <h1>${escapeHtml(budget.title || '预算')}</h1>
      <p>关联出游：${escapeHtml(budget.trip?.title || '未关联')}　人数：${escapeHtml(budget.party_size || 1)}　${escapeHtml(tripCur)} → ${escapeHtml(baseCur)}　汇率 ${escapeHtml(fxRate)}</p>
      <p>计划 ${escapeHtml(money(stats.planned_total_cny, baseCur))} ${escapeHtml(baseName)}　已订 ${escapeHtml(money(stats.booked_total_cny, baseCur))} ${escapeHtml(baseName)}　已花 ${escapeHtml(money(stats.spent_total_cny, baseCur))} ${escapeHtml(baseName)}　剩余 ${escapeHtml(money(stats.remaining_cny, baseCur))} ${escapeHtml(baseName)}</p>
      <h2>预算明细</h2>
      <table>
        <thead><tr><th>类别</th><th>项目</th><th>金额(${escapeHtml(tripName)})</th><th>本币金额(${escapeHtml(baseName)})</th><th>状态</th><th>可选</th><th>主币</th><th>备注</th></tr></thead>
        <tbody>${items}</tbody>
      </table>
      <h2>实际记账</h2>
      <table>
        <thead><tr><th>日期</th><th>项目</th><th>类别</th><th>金额(${escapeHtml(tripName)})</th><th>本币金额(${escapeHtml(baseName)})</th><th>备注</th></tr></thead>
        <tbody>${expenses}</tbody>
      </table>
    </div>
  `;
}

export function safeFilename(name, ext) {
  const base = String(name || 'export').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
  return `${base}.${ext}`;
}

function money(amount, currency) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 2,
  });
}

export function buildPlanHtml(trip = {}, budget = null) {
  const dates = [trip.start_date, trip.end_date].filter(Boolean).join('  —  ') || '日期待定';
  const days = trip.days || [];
  const items = budget?.items || budget?.budget_items || [];
  const expenses = budget?.expenses || [];
  const stats = budget?.summary_stats || {};
  const fx = budget?.trip_currency || 'CNY';
  const base = budget?.base_currency || 'CNY';

  const dayCards = days.map((day, index) => `
    <article class="day">
      <div class="day-index">DAY ${escapeHtml(day.day_index || index + 1)}</div>
      <div class="day-body">
        <div class="day-top">
          <h3>${escapeHtml(day.title || '行程安排')}</h3>
          <time>${escapeHtml(day.date || '')}</time>
        </div>
        ${day.lodging ? `<p class="lodging">住宿 · ${escapeHtml(day.lodging)}</p>` : ''}
        ${day.notes ? `<p class="notes">${escapeHtml(day.notes)}</p>` : ''}
      </div>
    </article>
  `).join('');

  const itemRows = items.map((item) => `
    <tr>
      <td>${escapeHtml(categoryLabel(item.category))}</td>
      <td>${escapeHtml(item.title)}</td>
      <td class="num">${escapeHtml(money(item.amount, fx))}</td>
      <td class="num">${escapeHtml(money(resolveBaseMajor(item.amount, item.amount_cny, budget?.fx_rate, base), base))}</td>
      <td>${escapeHtml(budgetStatusLabel(item.status))}</td>
      <td>${item.optional ? '可选' : ''}</td>
    </tr>
  `).join('');

  const expenseRows = expenses.map((item) => `
    <tr>
      <td>${escapeHtml(item.spent_on || '')}</td>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml(item.category ? categoryLabel(item.category) : '')}</td>
      <td class="num">${escapeHtml(money(item.amount, fx))}</td>
      <td class="num">${escapeHtml(money(resolveBaseMajor(item.amount, item.amount_cny, budget?.fx_rate, base), base))}</td>
      <td>${escapeHtml(item.note || '')}</td>
    </tr>
  `).join('');

  const tripName = currencyDisplayName(fx);
  const baseName = currencyDisplayName(base);
  const budgetBlock = budget ? `
    <section class="block">
      <div class="block-head">
        <h2>预算总览</h2>
        <p>${escapeHtml(tripName)} → ${escapeHtml(baseName)}　汇率 ${escapeHtml(budget.fx_rate ?? 1)}${budget.fx_date ? `　${escapeHtml(budget.fx_date)}` : ''}</p>
      </div>
      <div class="stats">
        <div class="stat"><span>计划合计</span><strong>${escapeHtml(money(stats.planned_total_cny, base))} ${escapeHtml(baseName)}</strong><small>${escapeHtml(money(stats.planned_total, fx))} ${escapeHtml(tripName)}</small></div>
        <div class="stat"><span>已订</span><strong>${escapeHtml(money(stats.booked_total_cny, base))} ${escapeHtml(baseName)}</strong><small>${escapeHtml(money(stats.booked_total, fx))} ${escapeHtml(tripName)}</small></div>
        <div class="stat"><span>已支出</span><strong>${escapeHtml(money(stats.spent_total_cny, base))} ${escapeHtml(baseName)}</strong><small>${escapeHtml(money(stats.spent_total, fx))} ${escapeHtml(tripName)}</small></div>
        <div class="stat ${Number(stats.remaining_cny) < 0 ? 'over' : ''}"><span>剩余</span><strong>${escapeHtml(money(stats.remaining_cny, base))} ${escapeHtml(baseName)}</strong><small>${escapeHtml(money(stats.remaining, fx))} ${escapeHtml(tripName)}</small></div>
      </div>
      ${budget.note ? `<p class="note">${escapeHtml(budget.note)}</p>` : ''}
      <h3 class="table-title">预算明细</h3>
      <table>
        <thead><tr><th>类别</th><th>项目</th><th>金额(${escapeHtml(tripName)})</th><th>本币金额(${escapeHtml(baseName)})</th><th>状态</th><th></th></tr></thead>
        <tbody>${itemRows || '<tr><td colspan="6">暂无明细</td></tr>'}</tbody>
      </table>
      <h3 class="table-title">实际记账</h3>
      <table>
        <thead><tr><th>日期</th><th>项目</th><th>类别</th><th>金额(${escapeHtml(tripName)})</th><th>本币金额(${escapeHtml(baseName)})</th><th>备注</th></tr></thead>
        <tbody>${expenseRows || '<tr><td colspan="6">暂无记账</td></tr>'}</tbody>
      </table>
    </section>
  ` : '';

  return `
    <div class="plan-doc">
      <header class="cover">
        <div class="kicker">Life Gallery · 出游计划</div>
        <h1>${escapeHtml(trip.title || '未命名出游')}</h1>
        <div class="chips">
          <span>${escapeHtml(trip.destination || '目的地待定')}</span>
          <span>${escapeHtml(dates)}</span>
          <span>${escapeHtml(tripStatusLabel(trip.status))}</span>
          <span>${escapeHtml(trip.party_size || 1)} 人</span>
        </div>
      </header>
      ${trip.summary ? `<section class="block quote"><h2>行程备注</h2><p>${escapeHtml(trip.summary)}</p></section>` : ''}
      <section class="block">
        <div class="block-head"><h2>逐日行程</h2><p>共 ${days.length} 天</p></div>
        <div class="timeline">${dayCards || '<p class="empty">暂无日程</p>'}</div>
      </section>
      ${budgetBlock}
      <footer>由 Life Gallery 导出 · ${escapeHtml(dayjs().format('YYYY-MM-DD'))}</footer>
    </div>
  `;
}
