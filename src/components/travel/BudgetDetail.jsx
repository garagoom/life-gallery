import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Button, Form, Input, InputNumber, Select, Space, Switch, DatePicker, Modal, Popconfirm, message, Progress, ConfigProvider,
} from 'antd';
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined, SaveOutlined, EditOutlined, EyeOutlined, CalendarOutlined, ReloadOutlined } from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import {
  getBudget, updateBudget, saveBudgetItems,
  createBudgetExpense, updateBudgetExpense, deleteBudgetExpense,
} from '../../api/budgets';
import { getFxRate } from '../../api/fx';
import { useDict } from '../../contexts/DictContext';
import { formatMoney, remainingClass, foreignToBase, baseToForeign, isQuoteBase, applyFxToBudgetItem } from '../../utils/tripMoney';
import useIsMobile from '../../hooks/useIsMobile';
import ListTable from '../ListTable';
import CurrencySelect from './CurrencySelect';
import styles from './travel.module.css';

let rowSeed = 0;
function nextKey(prefix) {
  rowSeed += 1;
  return `${prefix}-${Date.now()}-${rowSeed}`;
}

function Stat({ label, value, hint, tone }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={`${styles.statValue} ${tone === 'over' ? styles.over : ''}`.trim()}>{value}</div>
      {hint ? <div className={styles.statHint}>{hint}</div> : null}
    </div>
  );
}

function moneyHint(amount, currency) {
  return `${formatMoney(amount, currency)} ${currency}`;
}

function findMissingBudgetItems(budgetRows, expenses) {
  const linked = new Set((expenses || []).map((item) => Number(item.budget_item_id)).filter(Boolean));
  const titles = new Set((expenses || []).map((item) => String(item.title || '').trim()).filter(Boolean));
  return (budgetRows || []).filter((item) => {
    const title = String(item.title || '').trim();
    if (!title) return false;
    if (item.status !== 'booked') return false;
    if (item.id && linked.has(Number(item.id))) return false;
    if (titles.has(title)) return false;
    return true;
  });
}

export default function BudgetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const preview = searchParams.get('mode') !== 'edit';
  const mobile = useIsMobile();
  const { getDict, getLabel } = useDict();
  const [form] = Form.useForm();
  const [expenseForm] = Form.useForm();
  const [budget, setBudget] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingItems, setSavingItems] = useState(false);
  const [includeOptional, setIncludeOptional] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [savingExpense, setSavingExpense] = useState(false);
  const [missingBudgetItems, setMissingBudgetItems] = useState([]);
  const [askExpenseOpen, setAskExpenseOpen] = useState(false);
  const [addingExpenses, setAddingExpenses] = useState(false);
  const skipFx = useRef(true);
  const lastItemFx = useRef({ fxRate: null, baseCurrency: null, tripCurrency: null });
  const tripCurrency = Form.useWatch('trip_currency', form) || budget?.trip_currency || 'CNY';
  const baseCurrency = Form.useWatch('base_currency', form) || budget?.base_currency || 'CNY';
  const fxRate = Form.useWatch('fx_rate', form) ?? budget?.fx_rate ?? 1;

  const applyBudget = useCallback((data) => {
    skipFx.current = true;
    lastItemFx.current = {
      fxRate: data.fx_rate,
      baseCurrency: data.base_currency,
      tripCurrency: data.trip_currency,
    };
    setBudget(data);
    form.setFieldsValue({
      title: data.title,
      base_currency: data.base_currency,
      trip_currency: data.trip_currency,
      fx_rate: data.fx_rate,
      fx_date: data.fx_date ? dayjs(data.fx_date) : null,
      note: data.note,
    });
    setItems((data.items || []).map((item) => ({
      ...item,
      _key: `item-${item.id}`,
      quote_in: item.quote_in === 'base' ? 'base' : 'trip',
      amount_cny: item.amount_cny ?? foreignToBase(item.amount, data.fx_rate, data.base_currency),
    })));
  }, [form]);

  const load = useCallback(async (optional = includeOptional) => {
    setLoading(true);
    try {
      const data = await getBudget(id, { include_optional: optional ? 1 : 0 });
      applyBudget(data);
    } catch (error) {
      message.error(error.message || '加载预算失败');
    } finally {
      setLoading(false);
    }
  }, [id, includeOptional, applyBudget]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const last = lastItemFx.current;
    if (last.fxRate === fxRate && last.baseCurrency === baseCurrency && last.tripCurrency === tripCurrency) {
      return;
    }
    lastItemFx.current = { fxRate, baseCurrency, tripCurrency };
    setItems((prev) => {
      if (!prev.length) return prev;
      return prev.map((item) => applyFxToBudgetItem(item, fxRate, tripCurrency, baseCurrency));
    });
  }, [fxRate, baseCurrency, tripCurrency]);

  const refreshFx = async (from = tripCurrency, to = baseCurrency) => {
    if (!from || !to) return;
    if (from === to) {
      form.setFieldsValue({ fx_rate: 1 });
      return;
    }
    try {
      const quote = await getFxRate(from, to);
      form.setFieldsValue({
        fx_rate: quote.rate,
        fx_date: quote.date ? dayjs(quote.date) : dayjs(),
      });
    } catch (error) {
      message.error(error.message || '获取汇率失败');
    }
  };

  useEffect(() => {
    if (preview) return;
    if (skipFx.current) {
      skipFx.current = false;
      return;
    }
    refreshFx(tripCurrency, baseCurrency);
  }, [tripCurrency, baseCurrency, preview]);

  const stats = budget?.summary_stats;
  const categoryDict = getDict('expense_category');
  const statusDict = getDict('budget_item_status');

  const categoryOptions = useMemo(
    () => categoryDict.map((item) => ({ value: item.value, label: item.label })),
    [categoryDict]
  );
  const budgetStatusOptions = useMemo(
    () => statusDict.map((item) => ({ value: item.value, label: item.label })),
    [statusDict]
  );

  const handleSaveMeta = async () => {
    setSavingMeta(true);
    try {
      const values = await form.validateFields();
      const data = await updateBudget(id, {
        title: values.title,
        trip_id: budget?.trip_id || null,
        party_size: budget?.party_size || budget?.trip?.party_size || 1,
        base_currency: values.base_currency,
        trip_currency: values.trip_currency,
        fx_rate: values.fx_rate,
        fx_date: values.fx_date ? values.fx_date.format('YYYY-MM-DD') : null,
        note: values.note,
      });
      applyBudget(data);
      message.success('基础信息已保存');
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.message || '保存失败');
    } finally {
      setSavingMeta(false);
    }
  };

  const patchBudget = (key, field, value) => {
    setItems((prev) => prev.map((item) => {
      if (item._key !== key) return item;
      const next = { ...item, [field]: value };
      const locked = next.status === 'booked';
      const quoteBase = isQuoteBase(next.quote_in);
      const toCny = (amount) => foreignToBase(amount, fxRate, baseCurrency);
      const toForeign = (amount) => baseToForeign(amount, fxRate, tripCurrency);

      if (field === 'quote_in' && !locked) {
        if (quoteBase) next.amount = toForeign(Number(next.amount_cny) || 0);
        else next.amount_cny = toCny(Number(next.amount) || 0);
      }
      if (field === 'amount' && !locked) {
        next.amount_cny = toCny(Number(value) || 0);
      }
      if (field === 'amount_cny' && !locked) {
        next.amount = toForeign(Number(value) || 0);
      }
      return next;
    }));
  };

  const askAddMissingExpenses = (saved) => {
    const missing = findMissingBudgetItems(saved?.items, saved?.expenses);
    if (!missing.length) return;
    setMissingBudgetItems(missing);
    setAskExpenseOpen(true);
  };

  const handleSaveItems = async () => {
    const missingTitle = items.some((item) => !String(item.title || '').trim());
    if (missingTitle) {
      message.warning('预算明细需要填写项目名称');
      return;
    }
    setSavingItems(true);
    try {
      const payload = items.map((item, index) => ({
        id: item.id,
        category: item.category || 'misc',
        title: String(item.title || '').trim(),
        quote_in: item.quote_in === 'base' ? 'base' : 'trip',
        amount: Number(item.amount) || 0,
        amount_cny: Number(item.amount_cny) || 0,
        status: item.status || 'pending',
        optional: item.optional ? 1 : 0,
        note: item.note || '',
        sort_order: index,
      }));
      const data = await saveBudgetItems(id, payload, includeOptional);
      applyBudget(data);
      message.success('预算已保存');
      askAddMissingExpenses(data);
    } catch (error) {
      message.error(error.message || '保存预算失败');
    } finally {
      setSavingItems(false);
    }
  };

  const handleAddMissingExpenses = async () => {
    setAddingExpenses(true);
    try {
      const today = dayjs().format('YYYY-MM-DD');
      let latest = budget;
      for (const item of missingBudgetItems) {
        latest = await createBudgetExpense(id, {
          title: item.title,
          category: '',
          amount: item.amount,
          amount_cny: item.amount_cny,
          spent_on: today,
          budget_item_id: item.id,
          note: item.note || '',
        });
      }
      applyBudget(latest);
      setAskExpenseOpen(false);
      setMissingBudgetItems([]);
      message.success(`已添加 ${missingBudgetItems.length} 条记账`);
    } catch (error) {
      message.error(error.message || '添加到记账失败');
    } finally {
      setAddingExpenses(false);
    }
  };

  const openExpense = (record = null) => {
    setEditingExpense(record);
    expenseForm.resetFields();
    if (record) {
      expenseForm.setFieldsValue({
        title: record.title,
        category: record.category || undefined,
        amount: record.amount,
        amount_cny: record.amount_cny ?? foreignToBase(record.amount, fxRate, baseCurrency),
        spent_on: record.spent_on ? dayjs(record.spent_on) : null,
        budget_item_id: record.budget_item_id || undefined,
        note: record.note,
      });
    }
    setExpenseOpen(true);
  };

  const handleSaveExpense = async () => {
    setSavingExpense(true);
    try {
      const values = await expenseForm.validateFields();
      const payload = {
        title: values.title,
        category: values.category,
        amount: values.amount,
        amount_cny: values.amount_cny,
        spent_on: values.spent_on ? values.spent_on.format('YYYY-MM-DD') : null,
        budget_item_id: values.budget_item_id || null,
        note: values.note,
      };
      const data = editingExpense
        ? await updateBudgetExpense(id, editingExpense.id, payload)
        : await createBudgetExpense(id, payload);
      applyBudget(data);
      setExpenseOpen(false);
      message.success(editingExpense ? '记账已更新' : '已记一笔');
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.message || '保存失败');
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    try {
      const data = await deleteBudgetExpense(id, expenseId);
      applyBudget(data);
      message.success('已删除');
    } catch (error) {
      message.error(error.message || '删除失败');
    }
  };

  const budgetColumns = [
    {
      title: '类别',
      dataIndex: 'category',
      width: 120,
      render: (value, record) => (
        <Select
          value={value}
          options={categoryOptions}
          onChange={(next) => patchBudget(record._key, 'category', next)}
          style={{ width: '100%' }}
          disabled={preview}
          open={preview ? false : undefined}
        />
      ),
    },
    {
      title: '项目',
      dataIndex: 'title',
      width: 180,
      render: (value, record) => (
        <Input readOnly={preview} value={value} onChange={(e) => patchBudget(record._key, 'title', e.target.value)} />
      ),
    },
    {
      title: '主币',
      dataIndex: 'quote_in',
      width: 96,
      render: (value, record) => (
        <Switch
          disabled={preview}
          checked={isQuoteBase(value)}
          checkedChildren="本币"
          unCheckedChildren="出行币"
          onChange={(checked) => patchBudget(record._key, 'quote_in', checked ? 'base' : 'trip')}
        />
      ),
    },
    {
      title: `金额 (${tripCurrency})`,
      dataIndex: 'amount',
      width: 130,
      render: (value, record) => (
        <InputNumber readOnly={preview} controls={!preview} min={0} value={value} onChange={(next) => patchBudget(record._key, 'amount', next)} style={{ width: '100%' }} />
      ),
    },
    {
      title: `金额 (${baseCurrency === 'CNY' ? '人民币' : baseCurrency})`,
      dataIndex: 'amount_cny',
      width: 130,
      render: (value, record) => (
        <InputNumber readOnly={preview} controls={!preview} min={0} value={value} onChange={(next) => patchBudget(record._key, 'amount_cny', next)} style={{ width: '100%' }} />
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value, record) => (
        <Select disabled={preview} open={preview ? false : undefined} value={value} options={budgetStatusOptions} onChange={(next) => patchBudget(record._key, 'status', next)} style={{ width: '100%' }} />
      ),
    },
    {
      title: '可选',
      dataIndex: 'optional',
      width: 72,
      render: (value, record) => (
        <Switch disabled={preview} checked={!!value} onChange={(checked) => patchBudget(record._key, 'optional', checked)} />
      ),
    },
    !preview && {
      title: '',
      width: 56,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Button type="link" danger icon={<DeleteOutlined />} onClick={() => setItems((prev) => prev.filter((item) => item._key !== record._key))} />
      ),
    },
  ].filter(Boolean);

  const expenseColumns = [
    { title: '日期', dataIndex: 'spent_on', width: 120, render: (value) => value || '-' },
    { title: '项目', dataIndex: 'title', ellipsis: true },
    {
      title: '类别',
      dataIndex: 'category',
      width: 100,
      render: (value) => value ? getLabel('expense_category', value) : '-',
    },
    {
      title: tripCurrency,
      dataIndex: 'amount',
      width: 110,
      render: (value) => formatMoney(value, tripCurrency),
    },
    {
      title: baseCurrency === 'CNY' ? '人民币' : baseCurrency,
      dataIndex: 'amount_cny',
      width: 110,
      render: (value) => formatMoney(value, baseCurrency),
    },
    { title: '备注', dataIndex: 'note', ellipsis: true },
    !preview && {
      title: '操作',
      width: 110,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => openExpense(record)}>编辑</Button>
          <Popconfirm title="删除这笔消费？" onConfirm={() => handleDeleteExpense(record.id)} okText="确定" cancelText="取消">
            <Button type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ].filter(Boolean);

  return (
    <ConfigProvider locale={zhCN}>
      <div className={`${styles.container} ${preview ? styles.preview : ''}`.trim()}>
        <div className={styles.header}>
          <div>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/travel/budget')}>返回列表</Button>
            <h2 className={styles.title}>{budget?.title || '预算详情'}</h2>
            <p className={styles.sub}>
              {budget?.trip
                ? [budget.trip.title, budget.trip.start_date && budget.trip.end_date ? `${budget.trip.start_date} ~ ${budget.trip.end_date}` : null].filter(Boolean).join(' · ')
                : '未关联出游计划'}
            </p>
          </div>
          <Space wrap className={styles.headerActions}>
            {budget?.trip?.id ? (
              <Button icon={<CalendarOutlined />} onClick={() => navigate(`/travel/trips/${budget.trip.id}`)}>{mobile ? null : '查看出游'}</Button>
            ) : null}
            {preview ? (
              <Button type="primary" icon={<EditOutlined />} onClick={() => setSearchParams({ mode: 'edit' })}>编辑</Button>
            ) : (
              <Button icon={<EyeOutlined />} onClick={() => setSearchParams({})}>预览</Button>
            )}
            <Switch
              checked={includeOptional}
              onChange={setIncludeOptional}
              checkedChildren="含可选"
              unCheckedChildren="不含可选"
            />
          </Space>
        </div>

        <div className={styles.scroll}>
          <div className={styles.stats}>
            <Stat label="计划合计" value={`¥${formatMoney(stats?.planned_total_cny, 'CNY')}`} hint={stats ? moneyHint(stats.planned_total, tripCurrency) : ''} />
            <Stat label="已订" value={`¥${formatMoney(stats?.booked_total_cny, 'CNY')}`} hint={stats ? moneyHint(stats.booked_total, tripCurrency) : ''} />
            <Stat label="待购 / 估算" value={`¥${formatMoney(stats?.pending_total_cny, 'CNY')}`} />
            <Stat label="已支出" value={`¥${formatMoney(stats?.spent_total_cny, 'CNY')}`} />
            <Stat
              label="剩余"
              value={`¥${formatMoney(stats?.remaining_cny, 'CNY')}`}
              tone={remainingClass(stats?.remaining_cny)}
            />
            <Stat label="人均" value={`¥${formatMoney(stats?.per_person_cny, 'CNY')}`} hint={`${budget?.party_size || 1} 人`} />
          </div>

          {(stats?.by_category || []).map((row) => (
            <div className={styles.categoryRow} key={row.category}>
              <div className={styles.categoryName}>{getLabel('expense_category', row.category)}</div>
              <Progress
                percent={Math.round((row.share || 0) * 100)}
                showInfo
                format={() => `¥${formatMoney(row.planned_cny, 'CNY')}`}
              />
            </div>
          ))}

          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>基础信息</h3>
              {!preview && (
                <Button type="primary" icon={<SaveOutlined />} loading={savingMeta} onClick={handleSaveMeta}>保存</Button>
              )}
            </div>
            <Form form={form} layout="vertical" className={styles.formStack}>
              <Form.Item name="title" label="标题" rules={[{ required: true, message: '请填写标题' }]}>
                <Input readOnly={preview} />
              </Form.Item>
              <Space size={16} wrap style={{ display: 'flex' }}>
                <Form.Item name="trip_currency" label="出行币">
                  <CurrencySelect disabled={preview} />
                </Form.Item>
                <Form.Item name="base_currency" label="本币">
                  <CurrencySelect disabled={preview} />
                </Form.Item>
                <Form.Item
                  name="fx_rate"
                  label={`1 ${tripCurrency} = ? ${baseCurrency}`}
                  rules={[{ required: true, message: '请填写汇率' }]}
                >
                  <InputNumber readOnly={preview} controls={!preview} min={0} step={0.0001} disabled={tripCurrency === baseCurrency} placeholder="可自动获取或手动填写" />
                </Form.Item>
                {!preview && (
                  <Form.Item label=" ">
                    <Button icon={<ReloadOutlined />} onClick={() => refreshFx()}>获取汇率</Button>
                  </Form.Item>
                )}
                <Form.Item name="fx_date" label="汇率日期">
                  <DatePicker disabled={preview} inputReadOnly={preview || mobile} allowClear={!preview} style={{ width: mobile ? '100%' : undefined }} />
                </Form.Item>
              </Space>
              <Form.Item name="note" label="备注">
                <Input.TextArea readOnly={preview} rows={3} />
              </Form.Item>
            </Form>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>预算明细</h3>
              {!preview && (
                <div className={styles.tableActions}>
                  <Button icon={<PlusOutlined />} onClick={() => setItems((prev) => [...prev, {
                    _key: nextKey('item'),
                    category: 'misc',
                    title: '',
                    quote_in: 'trip',
                    amount: 0,
                    amount_cny: 0,
                    status: 'pending',
                    optional: false,
                    note: '',
                  }])}>加一行</Button>
                  <Button type="primary" icon={<SaveOutlined />} loading={savingItems} onClick={handleSaveItems}>保存预算</Button>
                </div>
              )}
            </div>
            {mobile ? (
              <div className={styles.cardList} style={{ overflow: 'visible', flex: 'none' }}>
                {items.map((record) => (
                  <div className={styles.itemCard} key={record._key}>
                    <div className={styles.cardHead}>
                      <strong>{record.title || '未命名项目'}</strong>
                      {!preview && (
                        <Button type="link" danger icon={<DeleteOutlined />} onClick={() => setItems((prev) => prev.filter((item) => item._key !== record._key))} />
                      )}
                    </div>
                    <div className={styles.fieldGrid}>
                      <div>
                        <div className={styles.fieldLabel}>类别</div>
                        <Select value={record.category} options={categoryOptions} onChange={(next) => patchBudget(record._key, 'category', next)} style={{ width: '100%' }} disabled={preview} open={preview ? false : undefined} />
                      </div>
                      <div>
                        <div className={styles.fieldLabel}>状态</div>
                        <Select disabled={preview} open={preview ? false : undefined} value={record.status} options={budgetStatusOptions} onChange={(next) => patchBudget(record._key, 'status', next)} style={{ width: '100%' }} />
                      </div>
                      <div className={styles.fullField}>
                        <div className={styles.fieldLabel}>项目</div>
                        <Input readOnly={preview} value={record.title} onChange={(e) => patchBudget(record._key, 'title', e.target.value)} />
                      </div>
                      <div>
                        <div className={styles.fieldLabel}>可选</div>
                        <Switch disabled={preview} checked={!!record.optional} onChange={(checked) => patchBudget(record._key, 'optional', checked)} />
                      </div>
                      <div>
                        <div className={styles.fieldLabel}>主币</div>
                        <Switch
                          disabled={preview}
                          checked={isQuoteBase(record.quote_in)}
                          checkedChildren="本币"
                          unCheckedChildren="出行币"
                          onChange={(checked) => patchBudget(record._key, 'quote_in', checked ? 'base' : 'trip')}
                        />
                      </div>
                      <div>
                        <div className={styles.fieldLabel}>金额 ({tripCurrency})</div>
                        <InputNumber readOnly={preview} controls={!preview} min={0} value={record.amount} onChange={(next) => patchBudget(record._key, 'amount', next)} style={{ width: '100%' }} />
                      </div>
                      <div>
                        <div className={styles.fieldLabel}>金额 ({baseCurrency === 'CNY' ? '人民币' : baseCurrency})</div>
                        <InputNumber readOnly={preview} controls={!preview} min={0} value={record.amount_cny} onChange={(next) => patchBudget(record._key, 'amount_cny', next)} style={{ width: '100%' }} />
                      </div>
                    </div>
                  </div>
                ))}
                {!items.length ? <div className={styles.cardMeta}>还没有预算明细</div> : null}
              </div>
            ) : (
            <ListTable
              columns={budgetColumns}
              dataSource={items}
              rowKey="_key"
              pagination={false}
              loading={loading}
              scroll={{ x: 1100 }}
            />
            )}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>实际记账</h3>
              {!preview && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openExpense()}>记一笔</Button>
              )}
            </div>
            {mobile ? (
              <div className={styles.cardList} style={{ overflow: 'visible', flex: 'none' }}>
                {(budget?.expenses || []).map((record) => (
                  <div className={styles.itemCard} key={record.id}>
                    <div className={styles.cardHead}>
                      <strong>{record.title}</strong>
                      <span className={styles.cardMeta} style={{ marginTop: 0 }}>{record.spent_on || '未填日期'}</span>
                    </div>
                    <div className={styles.cardMeta}>
                      {[record.category ? getLabel('expense_category', record.category) : null, `${formatMoney(record.amount, tripCurrency)} ${tripCurrency}`, `${formatMoney(record.amount_cny, baseCurrency)} ${baseCurrency === 'CNY' ? '人民币' : baseCurrency}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                    {record.note ? <div className={styles.cardMeta}>{record.note}</div> : null}
                    {!preview && (
                      <div className={styles.cardActions}>
                        <Button type="link" onClick={() => openExpense(record)}>编辑</Button>
                        <Popconfirm title="删除这笔消费？" onConfirm={() => handleDeleteExpense(record.id)} okText="确定" cancelText="取消">
                          <Button type="link" danger>删除</Button>
                        </Popconfirm>
                      </div>
                    )}
                  </div>
                ))}
                {!(budget?.expenses || []).length ? <div className={styles.cardMeta}>还没有记账</div> : null}
              </div>
            ) : (
            <ListTable
              columns={expenseColumns}
              dataSource={budget?.expenses || []}
              pagination={false}
              loading={loading}
              scroll={{ x: 800 }}
            />
            )}
          </div>
        </div>

        <Modal
          title={editingExpense ? '编辑消费' : '记一笔'}
          open={expenseOpen}
          onOk={handleSaveExpense}
          onCancel={() => setExpenseOpen(false)}
          confirmLoading={savingExpense}
          okText="保存"
          cancelText="取消"
          width={mobile ? 'calc(100vw - 24px)' : 520}
        >
          <Form form={expenseForm} layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item name="title" label="项目" rules={[{ required: true, message: '请填写项目' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="category" label="类别">
              <Select options={categoryOptions} allowClear />
            </Form.Item>
            <Form.Item name="budget_item_id" label="对照预算">
              <Select
                allowClear
                options={(budget?.items || []).map((item) => ({ value: item.id, label: item.title }))}
              />
            </Form.Item>
            <Form.Item name="amount" label={`金额 (${tripCurrency})`} rules={[{ required: true, message: '请填写金额' }]}>
              <InputNumber
                min={0}
                style={{ width: '100%' }}
                onChange={(value) => {
                  if (editingExpense) return;
                  expenseForm.setFieldValue('amount_cny', foreignToBase(value, fxRate, baseCurrency));
                }}
              />
            </Form.Item>
            <Form.Item name="amount_cny" label={`金额 (${baseCurrency === 'CNY' ? '人民币' : baseCurrency})`}>
              <InputNumber
                min={0}
                style={{ width: '100%' }}
                onChange={(value) => {
                  if (editingExpense) return;
                  expenseForm.setFieldValue('amount', baseToForeign(value, fxRate, tripCurrency));
                }}
              />
            </Form.Item>
            <Form.Item name="spent_on" label="日期">
              <DatePicker style={{ width: '100%' }} inputReadOnly={mobile} />
            </Form.Item>
            <Form.Item name="note" label="备注">
              <Input />
            </Form.Item>
          </Form>
        </Modal>
        <Modal
          title="添加到实际记账？"
          open={askExpenseOpen}
          onOk={handleAddMissingExpenses}
          onCancel={() => { setAskExpenseOpen(false); setMissingBudgetItems([]); }}
          confirmLoading={addingExpenses}
          okText="添加"
          cancelText="暂不添加"
        >
          <p>以下已订项目还没有对应记账，是否加入实际记账？类别留空，日期为今天。</p>
          <ul style={{ paddingLeft: 20, maxHeight: 240, overflow: 'auto' }}>
            {missingBudgetItems.map((item) => (
              <li key={item.id || item.title}>{item.title}</li>
            ))}
          </ul>
        </Modal>
      </div>
    </ConfigProvider>
  );
}
