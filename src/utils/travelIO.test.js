import { describe, it, expect } from 'vitest';
import {
  parseTripStatus,
  parseBudgetStatus,
  parseCategory,
  parseCurrency,
  parseYesNo,
  parseDate,
  parseNumber,
  tripStatusLabel,
  budgetStatusLabel,
  categoryLabel,
  rowsToObjects,
  parseTripPayload,
  parseBudgetPayload,
  parsePlanFromSheets,
  buildTripMarkdown,
  buildBudgetMarkdown,
  buildPlanHtml,
  safeFilename,
  escapeHtml,
} from './travelIO';

describe('travelIO labels and codes', () => {
  it('maps trip status labels and codes', () => {
    expect(parseTripStatus('待出发')).toBe('upcoming');
    expect(parseTripStatus('planning')).toBe('planning');
    expect(parseTripStatus('')).toBe('planning');
    expect(tripStatusLabel('completed')).toBe('已结束');
  });

  it('maps budget status and expense categories', () => {
    expect(parseBudgetStatus('已订')).toBe('booked');
    expect(parseBudgetStatus('estimated')).toBe('estimated');
    expect(budgetStatusLabel('pending')).toBe('待购');
    expect(parseCategory('机票')).toBe('flight');
    expect(parseCategory('unknown')).toBe('misc');
    expect(categoryLabel('lodging')).toBe('住宿');
  });

  it('parses currency codes and chinese aliases', () => {
    expect(parseCurrency('JPY')).toBe('JPY');
    expect(parseCurrency('日元')).toBe('JPY');
    expect(parseCurrency('')).toBe('CNY');
  });

  it('parses yes/no, dates and numbers', () => {
    expect(parseYesNo('是')).toBe(true);
    expect(parseYesNo('否')).toBe(false);
    expect(parseDate('2026-09-25')).toBe('2026-09-25');
    expect(parseDate('45960')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parseNumber('1,556.28', 0)).toBe(1556.28);
    expect(parseNumber('', 1)).toBe(1);
  });
});

describe('travelIO payload parsing', () => {
  it('strips required markers from headers', () => {
    const rows = rowsToObjects([
      ['标题*', '目的地'],
      ['关西游', '大阪'],
    ]);
    expect(rows[0]).toEqual({ 标题: '关西游', 目的地: '大阪' });
  });

  it('parses a trip workbook payload', () => {
    const trip = parseTripPayload(
      {
        标题: '日本关西 8 日游',
        目的地: '大阪 / 京都',
        开始日期: '2026-09-25',
        结束日期: '2026-10-02',
        状态: '待出发',
        人数: '2',
        行程备注: '交通卡',
      },
      [
        { DAY: 1, 日期: '2026-09-25', 主题: '落地', 住宿: '大阪日航', 备注: 'Rapi:t' },
        { DAY: '', 日期: '', 主题: '', 住宿: '', 备注: '' },
      ]
    );
    expect(trip).toMatchObject({
      title: '日本关西 8 日游',
      destination: '大阪 / 京都',
      start_date: '2026-09-25',
      end_date: '2026-10-02',
      status: 'upcoming',
      party_size: 2,
      summary: '交通卡',
    });
    expect(trip.days).toHaveLength(1);
    expect(trip.days[0]).toMatchObject({
      day_index: 1,
      date: '2026-09-25',
      title: '落地',
      lodging: '大阪日航',
    });
  });

  it('parses a budget workbook payload and links expenses by title', () => {
    const budget = parseBudgetPayload(
      {
        标题: '关西预算',
        关联出游标题: '日本关西 8 日游',
        人数: 2,
        出行币: '日元',
        本币: 'CNY',
        汇率: 0.043,
        汇率日期: '2026-09-07',
        备注: 'ICOCA',
        主线: '是',
      },
      [
        { 类别: '机票', 项目: '往返机票', 数量: 1, 单价: 155628, 小计: 155628, 状态: '已订', 可选: '否', 备注: '' },
        { 类别: '景点', 项目: '岚山', 数量: 2, 单价: 500, 小计: 1000, 状态: '待购', 可选: '是', 备注: '可选' },
      ],
      [
        { 日期: '2026-09-07', 项目: '往返机票', 类别: '', 金额: 155628, 对照预算项目: '往返机票', 备注: '已订入账' },
      ]
    );
    expect(budget).toMatchObject({
      title: '关西预算',
      trip_title: '日本关西 8 日游',
      trip_currency: 'JPY',
      base_currency: 'CNY',
      fx_rate: 0.043,
      is_main: true,
    });
    expect(budget.items).toHaveLength(2);
    expect(budget.items[1]).toMatchObject({ title: '岚山', optional: true, status: 'pending' });
    expect(budget.expenses[0]).toMatchObject({
      title: '往返机票',
      budget_item_title: '往返机票',
      amount: 155628,
    });
  });

  it('parses a combined plan from named sheets', () => {
    const plan = parsePlanFromSheets({
      出游信息: [{ 标题: '关西游', 目的地: '大阪', 开始日期: '2026-09-25', 结束日期: '2026-10-02', 状态: '待出发', 人数: 2 }],
      日程: [{ DAY: 1, 日期: '2026-09-25', 主题: '落地', 住宿: '日航', 备注: '' }],
      预算信息: [{ 出行币: 'JPY', 本币: 'CNY', 汇率: 0.043, 主线: '否' }],
      预算明细: [{ 类别: '机票', 项目: '机票', 数量: 1, 单价: 1, 小计: 1, 状态: '已订', 可选: '否' }],
    });
    expect(plan.trip.title).toBe('关西游');
    expect(plan.budget.title).toBe('关西游 预算');
    expect(plan.budget.party_size).toBe(2);
    expect(plan.budget.items).toHaveLength(1);
  });
});

describe('travelIO export helpers', () => {
  it('builds markdown for a trip', () => {
    const markdown = buildTripMarkdown({
      title: '关西游',
      destination: '大阪',
      start_date: '2026-09-25',
      end_date: '2026-10-02',
      status: 'upcoming',
      party_size: 2,
      summary: '交通卡',
      days: [{ day_index: 1, date: '2026-09-25', title: '落地', lodging: '日航', notes: 'Rapi:t' }],
    });
    expect(markdown).toContain('# 关西游');
    expect(markdown).toContain('待出发');
    expect(markdown).toContain('### DAY 1 2026-09-25 落地');
    expect(markdown).toContain('Rapi:t');
  });

  it('builds markdown for a budget', () => {
    const markdown = buildBudgetMarkdown({
      title: '关西预算',
      trip: { title: '关西游' },
      trip_currency: 'JPY',
      base_currency: 'CNY',
      fx_rate: 0.043,
      party_size: 2,
      items: [{ category: 'flight', title: '机票', qty: 1, unit_amount: 1, amount: 1, status: 'booked', optional: false }],
      expenses: [{ spent_on: '2026-09-07', title: '机票', category: 'flight', amount: 1 }],
    });
    expect(markdown).toContain('# 关西预算');
    expect(markdown).toContain('| 机票 | 机票 |');
    expect(markdown).toContain('已订');
  });

  it('sanitizes filenames and html', () => {
    expect(safeFilename('关西/游:计划', 'xlsx')).toBe('关西_游_计划.xlsx');
    expect(escapeHtml('<b>x</b>')).toBe('&lt;b&gt;x&lt;/b&gt;');
  });

  it('builds a combined plan html document', () => {
    const html = buildPlanHtml(
      { title: '关西游', destination: '大阪', start_date: '2026-09-25', end_date: '2026-10-02', status: 'upcoming', party_size: 2, days: [{ day_index: 1, date: '2026-09-25', title: '落地', lodging: '日航' }] },
      { trip_currency: 'JPY', base_currency: 'CNY', fx_rate: 0.043, summary_stats: { planned_total_cny: 100, remaining_cny: 20 }, items: [{ category: 'flight', title: '机票', qty: 1, amount: 1, status: 'booked' }], expenses: [] }
    );
    expect(html).toContain('plan-doc');
    expect(html).toContain('关西游');
    expect(html).toContain('DAY 1');
    expect(html).toContain('预算总览');
  });
});
