import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { parsePlanExcel } from './travelExcel';

function createWorkbook() {
  const impl = ExcelJS?.Workbook ? ExcelJS : ExcelJS?.default;
  return new impl.Workbook();
}

async function toFile(wb, name) {
  const buffer = await wb.xlsx.writeBuffer();
  return new File([buffer], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('travelExcel plan workbook', () => {
  it('parses one combined trip and budget file', async () => {
    const wb = createWorkbook();
    const trip = wb.addWorksheet('出游信息');
    trip.addRow(['标题*', '目的地', '开始日期', '结束日期', '状态', '人数', '行程备注']);
    trip.addRow(['关西游', '大阪', '2026-09-25', '2026-10-02', '待出发', 2, '备注']);
    const days = wb.addWorksheet('日程');
    days.addRow(['DAY', '日期', '主题', '住宿', '备注']);
    days.addRow([1, '2026-09-25', '落地', '日航', 'Rapi:t']);
    const budget = wb.addWorksheet('预算信息');
    budget.addRow(['出行币', '本币', '汇率', '汇率日期', '备注', '主线']);
    budget.addRow(['JPY', 'CNY', 0.043, '2026-09-07', 'ICOCA', '是']);
    const items = wb.addWorksheet('预算明细');
    items.addRow(['类别', '项目*', '数量', '单价', '小计', '状态', '可选', '备注']);
    items.addRow(['机票', '往返机票', 1, 155628, 155628, '已订', '否', '']);
    const expenses = wb.addWorksheet('实际记账');
    expenses.addRow(['日期', '项目*', '类别', '金额', '对照预算项目', '备注']);
    expenses.addRow(['2026-09-07', '往返机票', '机票', 155628, '往返机票', '已订']);

    const parsed = await parsePlanExcel(await toFile(wb, 'plan.xlsx'));
    expect(parsed.trip.title).toBe('关西游');
    expect(parsed.trip.status).toBe('upcoming');
    expect(parsed.trip.days[0].title).toBe('落地');
    expect(parsed.budget.trip_currency).toBe('JPY');
    expect(parsed.budget.is_main).toBe(true);
    expect(parsed.budget.items[0]).toMatchObject({ category: 'flight', amount: 155628 });
    expect(parsed.budget.expenses[0].budget_item_title).toBe('往返机票');
  });

  it('imports trip-only files without creating a budget payload', async () => {
    const wb = createWorkbook();
    const trip = wb.addWorksheet('出游信息');
    trip.addRow(['标题*', '目的地', '开始日期', '结束日期', '状态', '人数', '行程备注']);
    trip.addRow(['关西游', '大阪', '2026-09-25', '2026-10-02', '待出发', 2, '']);
    wb.addWorksheet('日程').addRow(['DAY', '日期', '主题', '住宿', '备注']);
    const parsed = await parsePlanExcel(await toFile(wb, 'trip-only.xlsx'));
    expect(parsed.trip.title).toBe('关西游');
    expect(parsed.budget).toBeNull();
  });
});
