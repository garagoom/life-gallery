import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Button, Form, Input, InputNumber, Select, Space, Switch, DatePicker, message, ConfigProvider, Checkbox,
} from 'antd';
import {
  ArrowLeftOutlined, PlusOutlined, DeleteOutlined, SaveOutlined, EditOutlined, EyeOutlined,
  ReloadOutlined, AccountBookOutlined,
} from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import { getShoppingList, updateShoppingList, saveShoppingItems } from '../../api/shopping';
import { getFxRate } from '../../api/fx';
import { formatMoney, foreignToBase, baseToForeign, isQuoteBase, applyFxToShoppingItem, sumSelectedShopping } from '../../utils/tripMoney';
import useIsMobile from '../../hooks/useIsMobile';
import ListTable from '../ListTable';
import CurrencySelect from './CurrencySelect';
import styles from './travel.module.css';

let rowSeed = 0;
function nextKey(prefix) {
  rowSeed += 1;
  return `${prefix}-${Date.now()}-${rowSeed}`;
}

function Stat({ label, value, hint }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      {hint ? <div className={styles.statHint}>{hint}</div> : null}
    </div>
  );
}

export default function ShoppingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const preview = searchParams.get('mode') !== 'edit';
  const mobile = useIsMobile();
  const [form] = Form.useForm();
  const [list, setList] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingItems, setSavingItems] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const lastItemFx = useRef({ fxRate: null, baseCurrency: null, tripCurrency: null });
  const tripCurrency = Form.useWatch('trip_currency', form) || list?.trip_currency || 'CNY';
  const baseCurrency = Form.useWatch('base_currency', form) || list?.base_currency || 'CNY';
  const fxRate = Form.useWatch('fx_rate', form) ?? list?.fx_rate ?? 1;
  const baseLabel = baseCurrency === 'CNY' ? '人民币' : baseCurrency;

  const applyList = useCallback((data) => {
    lastItemFx.current = {
      fxRate: data.fx_rate,
      baseCurrency: data.base_currency,
      tripCurrency: data.trip_currency,
    };
    setList(data);
    form.setFieldsValue({
      title: data.title,
      trip_currency: data.trip_currency,
      base_currency: data.base_currency,
      fx_rate: data.fx_rate,
      fx_date: data.fx_date ? dayjs(data.fx_date) : null,
      note: data.note,
    });
    setItems((data.items || []).map((item) => ({
      ...item,
      _key: `item-${item.id}`,
      quote_in: item.quote_in === 'base' ? 'base' : 'trip',
    })));
    setSelectedKeys((prev) => {
      const allowed = new Set((data.items || []).map((item) => `item-${item.id}`));
      return new Set([...prev].filter((key) => allowed.has(key)));
    });
  }, [form]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      applyList(await getShoppingList(id));
    } catch (error) {
      message.error(error.message || '加载购物清单失败');
    } finally {
      setLoading(false);
    }
  }, [id, applyList]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const last = lastItemFx.current;
    if (last.fxRate === fxRate && last.baseCurrency === baseCurrency && last.tripCurrency === tripCurrency) {
      return;
    }
    lastItemFx.current = { fxRate, baseCurrency, tripCurrency };
    setItems((prev) => prev.map((item) => applyFxToShoppingItem(item, fxRate, tripCurrency, baseCurrency)));
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

  const budgetItemOptions = useMemo(
    () => (list?.budget?.items || []).map((item) => ({ value: item.id, label: item.title })),
    [list],
  );
  const budgetItemPlaceholder = list?.budget
    ? (budgetItemOptions.length ? '选择购物预算项' : '预算里还没有购物类别')
    : '请先创建预算';
  const selectedSum = useMemo(
    () => sumSelectedShopping(items, selectedKeys, tripCurrency, baseCurrency),
    [items, selectedKeys, tripCurrency, baseCurrency],
  );

  const toggleSelect = (key, checked) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const toggleSelectAll = (checked) => {
    setSelectedKeys(checked ? new Set(items.map((item) => item._key)) : new Set());
  };

  const patchItem = (key, field, value) => {
    setItems((prev) => prev.map((item) => {
      if (item._key !== key) return item;
      const next = { ...item, [field]: value };
      const locked = !!next.bought;
      const quoteBase = isQuoteBase(next.quote_in);
      const toCny = (amount) => foreignToBase(amount, fxRate, baseCurrency);
      const toForeign = (amount) => baseToForeign(amount, fxRate, tripCurrency);
      if (field === 'quote_in' && !locked) {
        if (quoteBase) next.amount = toForeign(Number(next.amount_cny) || 0);
        else next.amount_cny = toCny(Number(next.amount) || 0);
      }
      if (field === 'amount' && !locked) next.amount_cny = toCny(Number(value) || 0);
      if (field === 'amount_cny' && !locked) next.amount = toForeign(Number(value) || 0);
      return next;
    }));
  };

  const handleSaveMeta = async () => {
    setSavingMeta(true);
    try {
      const values = await form.validateFields();
      applyList(await updateShoppingList(id, {
        title: values.title,
        trip_currency: values.trip_currency,
        base_currency: values.base_currency,
        fx_rate: values.fx_rate,
        fx_date: values.fx_date ? values.fx_date.format('YYYY-MM-DD') : null,
        note: values.note,
      }));
      message.success('基础信息已保存');
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.message || '保存失败');
    } finally {
      setSavingMeta(false);
    }
  };

  const persistItems = async (nextItems, successText = '清单已保存') => {
    const named = nextItems.filter((item) => String(item.title || '').trim());
    const boughtWithoutBudget = named.some((item) => item.bought && !item.budget_item_id);
    if (boughtWithoutBudget) {
      message.warning('打开已买前请先关联购物类别的预算项');
      return false;
    }
    setSavingItems(true);
    try {
      const payload = named.map((item, index) => ({
        id: item.id,
        title: String(item.title || '').trim(),
        place: item.place || '',
        quote_in: item.quote_in === 'base' ? 'base' : 'trip',
        amount: Number(item.amount) || 0,
        amount_cny: Number(item.amount_cny) || 0,
        budget_item_id: item.budget_item_id || null,
        bought: item.bought ? 1 : 0,
        note: item.note || '',
        sort_order: index,
      }));
      applyList(await saveShoppingItems(id, payload, {
        trip_currency: form.getFieldValue('trip_currency'),
        base_currency: form.getFieldValue('base_currency'),
        fx_rate: form.getFieldValue('fx_rate'),
        fx_date: form.getFieldValue('fx_date') ? form.getFieldValue('fx_date').format('YYYY-MM-DD') : null,
      }));
      message.success(successText);
      return true;
    } catch (error) {
      message.error(error.message || '保存失败');
      return false;
    } finally {
      setSavingItems(false);
    }
  };

  const handleBought = async (key, checked) => {
    const current = items.find((item) => item._key === key);
    if (!current) return;
    if (!String(current.title || '').trim()) {
      message.warning('请先填写商品名称');
      return;
    }
    if (checked && !current.budget_item_id) {
      message.warning('请先关联购物类别的预算项');
      return;
    }
    const nextItems = items.map((item) => (item._key === key ? { ...item, bought: checked } : item));
    setItems(nextItems);
    const ok = await persistItems(nextItems, checked ? '已计入关联预算项' : '已从关联预算项扣回');
    if (!ok) setItems(items);
  };

  const removeRow = async (key) => {
    const removed = items.find((item) => item._key === key);
    const nextItems = items.filter((item) => item._key !== key);
    setItems(nextItems);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    if (removed?.id) await persistItems(nextItems, '已删除');
  };

  const addRow = () => {
    setItems((prev) => [...prev, {
      _key: nextKey('item'),
      title: '',
      place: '',
      quote_in: 'trip',
      amount: 0,
      amount_cny: 0,
      budget_item_id: null,
      bought: false,
      note: '',
    }]);
  };

  const columns = [
    {
      title: '商品',
      dataIndex: 'title',
      render: (value, record) => (
        <Input readOnly={preview} value={value} onChange={(e) => patchItem(record._key, 'title', e.target.value)} placeholder="药妆 / 手信" />
      ),
    },
    {
      title: '在哪看到',
      dataIndex: 'place',
      width: 140,
      render: (value, record) => (
        <Input readOnly={preview} value={value} onChange={(e) => patchItem(record._key, 'place', e.target.value)} placeholder="心斋桥 / 药妆店" />
      ),
    },
    {
      title: '主币',
      dataIndex: 'quote_in',
      width: 96,
      render: (value, record) => (
        <Switch
          disabled={preview || record.bought}
          checked={isQuoteBase(value)}
          checkedChildren="本币"
          unCheckedChildren="出行币"
          onChange={(checked) => patchItem(record._key, 'quote_in', checked ? 'base' : 'trip')}
        />
      ),
    },
    {
      title: `金额 (${tripCurrency})`,
      dataIndex: 'amount',
      width: 130,
      render: (value, record) => (
        <InputNumber readOnly={preview || record.bought} controls={!preview} min={0} value={value} onChange={(next) => patchItem(record._key, 'amount', next)} style={{ width: '100%' }} />
      ),
    },
    {
      title: `金额 (${baseLabel})`,
      dataIndex: 'amount_cny',
      width: 130,
      render: (value, record) => (
        <InputNumber readOnly={preview || record.bought} controls={!preview} min={0} value={value} onChange={(next) => patchItem(record._key, 'amount_cny', next)} style={{ width: '100%' }} />
      ),
    },
    {
      title: '关联预算项',
      dataIndex: 'budget_item_id',
      width: 180,
      render: (value, record) => (
        <Select
          allowClear
          disabled={preview}
          value={value || undefined}
          options={budgetItemOptions}
          placeholder={budgetItemPlaceholder}
          onChange={(next) => patchItem(record._key, 'budget_item_id', next || null)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '已买',
      dataIndex: 'bought',
      width: 72,
      render: (value, record) => (
        <Switch
          disabled={preview}
          checked={!!value}
          onChange={(checked) => handleBought(record._key, checked)}
        />
      ),
    },
    !preview && {
      title: '',
      width: 56,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Button type="link" danger icon={<DeleteOutlined />} onClick={() => removeRow(record._key)} />
      ),
    },
  ].filter(Boolean);

  const stats = list?.stats || {};

  return (
    <ConfigProvider locale={zhCN}>
      <div className={`${styles.container} ${preview ? styles.preview : ''}`.trim()}>
        <div className={styles.header}>
          <div>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/travel/shopping')}>返回列表</Button>
            <h2 className={styles.title}>{list?.title || '购物清单'}</h2>
            <p className={styles.sub}>
              {[list?.trip?.title, list?.trip?.destination].filter(Boolean).join(' · ') || '记下想买的东西，最后一天再勾已买'}
            </p>
          </div>
          <Space wrap className={styles.headerActions}>
            {list?.budget?.id ? (
              <Button icon={<AccountBookOutlined />} onClick={() => navigate(`/travel/budget/${list.budget.id}`)}>
                {mobile ? null : '查看预算'}
              </Button>
            ) : null}
            {preview ? (
              <Button type="primary" icon={<EditOutlined />} onClick={() => setSearchParams({ mode: 'edit' })}>编辑</Button>
            ) : (
              <Button icon={<EyeOutlined />} onClick={() => setSearchParams({})}>预览</Button>
            )}
          </Space>
        </div>

        <div className={styles.stats}>
          <Stat label="想买" value={stats.want_count || 0} />
          <Stat label="已买" value={stats.bought_count || 0} />
          <Stat label={`想买合计 (${tripCurrency})`} value={formatMoney(stats.want_total, tripCurrency)} hint={`${formatMoney(stats.want_total_cny, baseCurrency)} ${baseLabel}`} />
          <Stat label={`已买合计 (${tripCurrency})`} value={formatMoney(stats.bought_total, tripCurrency)} hint={`${formatMoney(stats.bought_total_cny, baseCurrency)} ${baseLabel}`} />
          <Stat
            label={`勾选合计${selectedSum.count ? ` · ${selectedSum.count} 件` : ''}`}
            value={`${formatMoney(selectedSum.amountCny, baseCurrency)} ${baseLabel}`}
            hint={`${formatMoney(selectedSum.amount, tripCurrency)} ${tripCurrency}`}
          />
        </div>

        <div className={styles.scroll}>
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
                <Form.Item name="fx_rate" label={`1 ${tripCurrency} = ? ${baseCurrency}`} rules={[{ required: true, message: '请填写汇率' }]}>
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
                <Input.TextArea readOnly={preview} rows={2} placeholder="最后一天再集中买" />
              </Form.Item>
            </Form>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>想买的商品</h3>
              <div className={styles.tableActions}>
                <Checkbox
                  checked={items.length > 0 && selectedSum.count === items.length}
                  indeterminate={selectedSum.count > 0 && selectedSum.count < items.length}
                  onChange={(event) => toggleSelectAll(event.target.checked)}
                  disabled={!items.length}
                >
                  全选
                </Checkbox>
                {!preview && (
                  <>
                    <Button icon={<PlusOutlined />} onClick={addRow}>加一行</Button>
                    <Button type="primary" icon={<SaveOutlined />} loading={savingItems} onClick={() => persistItems(items)}>保存清单</Button>
                  </>
                )}
              </div>
            </div>
            {mobile ? (
              <div className={styles.cardList} style={{ overflow: 'visible', flex: 'none' }}>
                {items.map((record) => (
                  <div className={styles.itemCard} key={record._key}>
                    <div className={styles.cardHead}>
                      <label className={styles.selectLabel}>
                        <Checkbox
                          checked={selectedKeys.has(record._key)}
                          onChange={(event) => toggleSelect(record._key, event.target.checked)}
                        />
                        <strong>{record.title || '未命名商品'}</strong>
                      </label>
                      <Switch disabled={preview} checked={!!record.bought} checkedChildren="已买" unCheckedChildren="想买" onChange={(checked) => handleBought(record._key, checked)} />
                    </div>
                    <div className={styles.fieldGrid}>
                      <div className={styles.fullField}>
                        <div className={styles.fieldLabel}>商品</div>
                        <Input readOnly={preview} value={record.title} onChange={(e) => patchItem(record._key, 'title', e.target.value)} />
                      </div>
                      <div>
                        <div className={styles.fieldLabel}>在哪看到</div>
                        <Input readOnly={preview} value={record.place} onChange={(e) => patchItem(record._key, 'place', e.target.value)} />
                      </div>
                      <div>
                        <div className={styles.fieldLabel}>关联预算项</div>
                        <Select allowClear disabled={preview} value={record.budget_item_id || undefined} options={budgetItemOptions} placeholder={budgetItemPlaceholder} onChange={(next) => patchItem(record._key, 'budget_item_id', next || null)} style={{ width: '100%' }} />
                      </div>
                      <div>
                        <div className={styles.fieldLabel}>金额 ({tripCurrency})</div>
                        <InputNumber readOnly={preview || record.bought} controls={!preview} min={0} value={record.amount} onChange={(next) => patchItem(record._key, 'amount', next)} style={{ width: '100%' }} />
                      </div>
                      <div>
                        <div className={styles.fieldLabel}>金额 ({baseLabel})</div>
                        <InputNumber readOnly={preview || record.bought} controls={!preview} min={0} value={record.amount_cny} onChange={(next) => patchItem(record._key, 'amount_cny', next)} style={{ width: '100%' }} />
                      </div>
                    </div>
                    {!preview && (
                      <div className={styles.cardActions}>
                        <Button type="link" danger icon={<DeleteOutlined />} onClick={() => removeRow(record._key)}>删除</Button>
                      </div>
                    )}
                  </div>
                ))}
                {!items.length ? <div className={styles.cardMeta}>还没有商品，先加一行记下看到的东西</div> : null}
              </div>
            ) : (
              <ListTable
                columns={columns}
                dataSource={items}
                rowKey="_key"
                pagination={false}
                loading={loading}
                scroll={{ x: 1100 }}
                rowSelection={{
                  selectedRowKeys: [...selectedKeys],
                  onChange: (keys) => setSelectedKeys(new Set(keys)),
                }}
              />
            )}
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}
