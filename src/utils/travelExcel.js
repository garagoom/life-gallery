import ExcelJS from 'exceljs';
import {
  TRIP_META_HEADERS,
  TRIP_DAY_HEADERS,
  BUDGET_META_HEADERS,
  BUDGET_ITEM_HEADERS,
  EXPENSE_HEADERS,
  TRIP_STATUS_MAP,
  BUDGET_STATUS_MAP,
  CATEGORY_MAP,
  CURRENCY_CODES,
  cellText,
  rowsToObjects,
  parsePlanFromSheets,
  tripStatusLabel,
  budgetStatusLabel,
  categoryLabel,
  quoteInLabel,
  withCurrencyHeaders,
  resolveBaseMajor,
} from './travelIO';

function createWorkbook() {
  const impl = ExcelJS?.Workbook ? ExcelJS : ExcelJS?.default;
  if (!impl?.Workbook) throw new Error('ExcelJS 未能正确加载');
  return new impl.Workbook();
}

function downloadBuffer(buffer, filename, mime) {
  const blob = new Blob([buffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function styleHeader(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5C4D3C' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
}

function addSheet(wb, name, headers, rows, widths, lists = {}) {
  const sheet = wb.addWorksheet(name);
  sheet.addRow(headers);
  styleHeader(sheet.getRow(1));
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  headers.forEach((header, index) => {
    sheet.getColumn(index + 1).width = widths[index] || 16;
  });
  rows.forEach((row) => sheet.addRow(row));
  Object.entries(lists).forEach(([col, options]) => {
    sheet.dataValidations.add(`${col}2:${col}200`, {
      type: 'list',
      allowBlank: true,
      formulae: [`"${options.join(',')}"`],
      showErrorMessage: true,
      error: '请使用下拉选项中的值',
    });
  });
  return sheet;
}

function addGuideSheet(wb, lines) {
  const sheet = wb.addWorksheet('说明');
  sheet.getColumn(1).width = 78;
  lines.forEach((line, index) => {
    const row = sheet.addRow([line]);
    if (index === 0) row.font = { bold: true, size: 14 };
  });
}

function sheetToMatrix(sheet) {
  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = [];
    const last = Math.max(row.cellCount, 1);
    for (let i = 1; i <= last; i += 1) {
      const cell = row.getCell(i);
      values.push(cell.value instanceof Date ? cell.value : cellText(cell.value));
    }
    rows.push(values);
  });
  return rows;
}

const SAMPLE_TRIP = {
  title: '日本关西 8 日游',
  destination: '大阪 / 京都 / 神户',
  start_date: '2026-09-25',
  end_date: '2026-10-02',
  status: 'upcoming',
  party_size: 2,
  summary: '交通卡、避坑等备注。此行为示例，请替换成你的计划。',
  days: [
    { day_index: 1, date: '2026-09-25', title: '大阪落地 → 心斋桥', lodging: '大阪日航酒店', notes: '南海 Rapi:t 到难波' },
    { day_index: 2, date: '2026-09-26', title: '大阪市区', lodging: '大阪日航酒店', notes: '' },
  ],
};

const SAMPLE_BUDGET = {
  trip_currency: 'JPY',
  base_currency: 'CNY',
  fx_rate: 0.043,
  fx_date: '2026-09-07',
  note: 'ICOCA 等备注',
  is_main: false,
  items: [
    { category: 'flight', title: '往返机票（双人）', amount: 155628, amount_cny: 6692, quote_in: 'base', status: 'booked', optional: false, note: '' },
    { category: 'lodging', title: '大阪日航 + 京都酒店', amount: 125023, amount_cny: 5375.99, quote_in: 'trip', status: 'booked', optional: false, note: '' },
    { category: 'attraction', title: '岚山', amount: 1000, amount_cny: 43, quote_in: 'trip', status: 'pending', optional: true, note: '可选' },
  ],
  expenses: [
    { spent_on: '2026-09-07', title: '往返机票（双人）', category: 'flight', amount: 155628, amount_cny: 6692, note: '已订入账', budget_item_title: '往返机票（双人）' },
  ],
};

function fillPlanWorkbook(wb, trip, budget, { isTemplate = false } = {}) {
  addGuideSheet(wb, isTemplate ? [
    '出游计划模板（一份文件 = 一次出游）',
    '把本文件交给智能体：请规划这一次出行的日程和开销，填入各 Sheet，不要一次写多份计划。',
    '填好后回到网站「出游计划」列表导入，再在系统里微调即可。',
    '1. 请勿修改表头。带 * 的列为必填。「出游信息」「预算信息」都只填一行。',
    '2. 「日程」按出行顺序一行一天；DAY 可留空，导入时按行序生成。',
    `3. 出游状态：${TRIP_STATUS_MAP.map(([, label]) => label).join('、')}`,
    `4. 出行币 / 本币请填代码：${CURRENCY_CODES.join('、')}`,
    `5. 明细类别：${CATEGORY_MAP.map(([, label]) => label).join('、')}；状态：${BUDGET_STATUS_MAP.map(([, label]) => label).join('、')}`,
    '6. 金额请同时填写出行币和本币（人民币）两列。机票等按人民币买的，主币选「本币」。可选、主线填「是」或「否」。',
    '7. 日期用 YYYY-MM-DD。当前灰色示例请全部替换成真实计划。',
  ] : [
    '出游计划导出',
    `标题：${trip?.title || ''}`,
    '本文件结构与导入模板相同，可作为备份或交给智能体继续改。若再导入，会作为一份新的出游计划。',
  ]);

  addSheet(wb, '出游信息', TRIP_META_HEADERS.map((h, i) => (i === 0 ? `${h}*` : h)), [[
    trip?.title || '',
    trip?.destination || '',
    trip?.start_date || '',
    trip?.end_date || '',
    tripStatusLabel(trip?.status),
    trip?.party_size || 1,
    trip?.summary || '',
  ]], [22, 22, 14, 14, 12, 8, 40], { E: TRIP_STATUS_MAP.map(([, label]) => label) });

  addSheet(wb, '日程', TRIP_DAY_HEADERS, (trip?.days || []).map((day, index) => [
    day.day_index || index + 1,
    day.date || '',
    day.title || '',
    day.lodging || '',
    day.notes || '',
  ]), [8, 14, 28, 18, 40]);

  addSheet(wb, '预算信息', BUDGET_META_HEADERS, budget ? [[
    budget.trip_currency || 'CNY',
    budget.base_currency || 'CNY',
    budget.fx_rate ?? 1,
    budget.fx_date || '',
    budget.note || '',
    budget.is_main ? '是' : '否',
  ]] : [], [10, 10, 10, 14, 28, 8], {
    A: CURRENCY_CODES,
    B: CURRENCY_CODES,
    F: ['是', '否'],
  });

  const tripCurrency = budget?.trip_currency || 'CNY';
  const baseCurrency = budget?.base_currency || 'CNY';
  const fxRate = budget?.fx_rate ?? 1;

  addSheet(wb, '预算明细', withCurrencyHeaders(BUDGET_ITEM_HEADERS, tripCurrency, baseCurrency).map((h, i) => (i === 1 ? `${h}*` : h)), (budget?.items || budget?.budget_items || []).map((item) => [
    categoryLabel(item.category),
    item.title || '',
    item.amount ?? 0,
    resolveBaseMajor(item.amount, item.amount_cny, fxRate, baseCurrency),
    budgetStatusLabel(item.status),
    item.optional ? '是' : '否',
    quoteInLabel(item.quote_in),
    item.note || '',
  ]), [10, 28, 16, 16, 10, 8, 10, 24], {
    A: CATEGORY_MAP.map(([, label]) => label),
    E: BUDGET_STATUS_MAP.map(([, label]) => label),
    F: ['是', '否'],
    G: ['出行币', '本币'],
  });

  addSheet(wb, '实际记账', withCurrencyHeaders(EXPENSE_HEADERS, tripCurrency, baseCurrency).map((h, i) => (i === 1 ? `${h}*` : h)), (budget?.expenses || []).map((item) => [
    item.spent_on || '',
    item.title || '',
    item.category ? categoryLabel(item.category) : '',
    item.amount ?? 0,
    resolveBaseMajor(item.amount, item.amount_cny, fxRate, baseCurrency),
    item.budget_item_title || (budget?.items || []).find((row) => row.id === item.budget_item_id)?.title || '',
    item.note || '',
  ]), [14, 28, 10, 14, 16, 24, 24], {
    C: CATEGORY_MAP.map(([, label]) => label),
  });
}

export async function downloadPlanTemplate() {
  const wb = createWorkbook();
  wb.creator = 'Life Gallery';
  fillPlanWorkbook(wb, SAMPLE_TRIP, SAMPLE_BUDGET, { isTemplate: true });
  const buf = await wb.xlsx.writeBuffer();
  downloadBuffer(buf, '出游计划模板.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export async function parseWorkbookFile(file) {
  const wb = createWorkbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const sheets = {};
  wb.eachSheet((sheet) => {
    sheets[sheet.name] = rowsToObjects(sheetToMatrix(sheet));
  });
  return sheets;
}

export async function parsePlanExcel(file) {
  return parsePlanFromSheets(await parseWorkbookFile(file));
}

export async function downloadPlanExcel(trip, budget, filename) {
  const wb = createWorkbook();
  wb.creator = 'Life Gallery';
  fillPlanWorkbook(wb, trip, budget);
  const buf = await wb.xlsx.writeBuffer();
  downloadBuffer(buf, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
