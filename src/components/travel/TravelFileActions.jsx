import { useRef, useState } from 'react';
import { Button, Dropdown, message } from 'antd';
import { DownloadOutlined, ImportOutlined, ExportOutlined, FolderOutlined } from '@ant-design/icons';
import useIsMobile from '../../hooks/useIsMobile';
import { createTrip, saveTripDays, getTrip } from '../../api/trips';
import {
  createBudget, saveBudgetItems, getBudget,
  createBudgetExpense, setBudgetMain,
} from '../../api/budgets';
import { downloadPlanTemplate, parsePlanExcel, downloadPlanExcel } from '../../utils/travelExcel';
import { buildPlanHtml, safeFilename } from '../../utils/travelIO';
import { downloadPdfFromHtml } from '../../utils/travelPdf';

export async function resolvePlan({ tripId, budgetId }) {
  if (tripId) {
    const trip = await getTrip(tripId);
    const budget = trip.budget?.id ? await getBudget(trip.budget.id, { include_optional: 1 }) : null;
    return { trip, budget };
  }
  if (budgetId) {
    const budget = await getBudget(budgetId, { include_optional: 1 });
    const trip = budget.trip?.id ? await getTrip(budget.trip.id) : null;
    if (!trip) throw new Error('这份预算还没有关联出游计划');
    return { trip, budget };
  }
  throw new Error('缺少出游计划');
}

async function applyPlanImport(file) {
  const { trip: tripPayload, budget: budgetPayload } = await parsePlanExcel(file);
  const created = await createTrip({
    title: tripPayload.title,
    destination: tripPayload.destination,
    start_date: tripPayload.start_date,
    end_date: tripPayload.end_date,
    status: tripPayload.status,
    party_size: tripPayload.party_size,
    summary: tripPayload.summary,
  });
  const trip = await saveTripDays(created.id, tripPayload.days);
  if (!budgetPayload) return trip;

  let budget = await createBudget({
    title: budgetPayload.title || `${trip.title} 预算`,
    trip_id: trip.id,
    party_size: trip.party_size,
    trip_currency: budgetPayload.trip_currency,
    base_currency: budgetPayload.base_currency,
    fx_rate: budgetPayload.fx_rate,
    fx_date: budgetPayload.fx_date,
    note: budgetPayload.note,
  });
  budget = await saveBudgetItems(budget.id, budgetPayload.items, true);
  for (const expense of budgetPayload.expenses || []) {
    const linked = (budget.items || []).find((item) => item.title === expense.budget_item_title);
    budget = await createBudgetExpense(budget.id, {
      title: expense.title,
      category: expense.category,
      amount: expense.amount,
      spent_on: expense.spent_on,
      budget_item_id: linked?.id || null,
      note: expense.note,
    });
  }
  if (budgetPayload.is_main) {
    await setBudgetMain(budget.id, true);
  }
  return getTrip(trip.id);
}

export async function exportPlan({ tripId, budgetId }, format) {
  const { trip, budget } = await resolvePlan({ tripId, budgetId });
  const name = trip.title || '出游计划';
  if (format === 'xlsx') {
    await downloadPlanExcel(trip, budget, safeFilename(name, 'xlsx'));
    return;
  }
  await downloadPdfFromHtml(buildPlanHtml(trip, budget), safeFilename(name, 'pdf'));
}

export default function TravelFileActions({
  mode = 'export',
  tripId,
  budgetId,
  onImported,
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const mobile = useIsMobile();

  const handleTemplate = async () => {
    try {
      await downloadPlanTemplate();
    } catch (error) {
      message.error(error.message || '下载模板失败');
    }
  };

  const runImport = async (file) => {
    setBusy(true);
    try {
      const trip = await applyPlanImport(file);
      message.success('已导入一份出游计划');
      onImported?.(trip);
    } catch (error) {
      message.error(error.message || '导入失败');
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async (format) => {
    setBusy(true);
    try {
      await exportPlan({ tripId, budgetId }, format);
    } catch (error) {
      message.error(error.message || '导出失败');
    } finally {
      setBusy(false);
    }
  };

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      hidden
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) runImport(file);
      }}
    />
  );

  if (mode === 'import') {
    if (mobile) {
    return (
      <>
        <Dropdown
          menu={{
            items: [
              { key: 'template', label: '下载模板' },
              { key: 'import', label: '导入 Excel' },
            ],
            onClick: ({ key }) => {
              if (key === 'template') handleTemplate();
              else inputRef.current?.click();
            },
          }}
        >
          <Button icon={<FolderOutlined />} loading={busy}>文件</Button>
        </Dropdown>
        {fileInput}
      </>
    );
    }
    return (
      <span>
        <Button icon={<DownloadOutlined />} onClick={handleTemplate} loading={busy} style={{ marginRight: 8 }}>下载模板</Button>
        <Button icon={<ImportOutlined />} onClick={() => inputRef.current?.click()} loading={busy}>导入</Button>
        {fileInput}
      </span>
    );
  }

  const exportMenu = {
    items: [
      { key: 'xlsx', label: '导出 Excel' },
      { key: 'pdf', label: '导出 PDF' },
    ],
    onClick: ({ key }) => handleExport(key),
  };

  return (
    <Dropdown menu={exportMenu}>
      <Button
        type="link"
        icon={<ExportOutlined />}
        loading={busy}
        aria-label="导出"
      />
    </Dropdown>
  );
}
