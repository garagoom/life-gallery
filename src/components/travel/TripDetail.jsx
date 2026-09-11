import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Button, Form, Input, InputNumber, Select, Space, DatePicker, message, ConfigProvider, Modal,
} from 'antd';
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined, SaveOutlined, EditOutlined, EyeOutlined, AccountBookOutlined, ReloadOutlined, CalculatorOutlined } from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import { getTrip, updateTrip, saveTripDays } from '../../api/trips';
import { createBudget } from '../../api/budgets';
import { createShoppingList, getShoppingLists } from '../../api/shopping';
import { getCountries, guessCurrencyFromDestination } from '../../api/geo';
import { getFxRate } from '../../api/fx';
import { useDict } from '../../contexts/DictContext';
import useIsMobile from '../../hooks/useIsMobile';
import ListTable from '../ListTable';
import TravelFileActions from './TravelFileActions';
import DestinationCascader from './DestinationCascader';
import CurrencySelect from './CurrencySelect';
import TripTodayBanner from './TripTodayBanner';
import styles from './travel.module.css';

let rowSeed = 0;
function nextKey(prefix) {
  rowSeed += 1;
  return `${prefix}-${Date.now()}-${rowSeed}`;
}

function buildDaysFromRange(start, end) {
  if (!start || !end) return [];
  const days = [];
  let cursor = start.startOf('day');
  const last = end.startOf('day');
  let index = 0;
  while (cursor.isBefore(last) || cursor.isSame(last, 'day')) {
    days.push({
      _key: `day-${cursor.format('YYYY-MM-DD')}`,
      day_index: index + 1,
      date: cursor.format('YYYY-MM-DD'),
      title: '',
      lodging: '',
      notes: '',
      sort_order: index,
    });
    cursor = cursor.add(1, 'day');
    index += 1;
    if (index > 366) break;
  }
  return days;
}

export default function TripDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const preview = searchParams.get('mode') !== 'edit';
  const mobile = useIsMobile();
  const { getDict } = useDict();
  const [form] = Form.useForm();
  const [budgetForm] = Form.useForm();
  const [trip, setTrip] = useState(null);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingDays, setSavingDays] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [creatingBudget, setCreatingBudget] = useState(false);
  const skipBudgetFx = useRef(true);
  const tripCurrency = Form.useWatch('trip_currency', budgetForm);
  const baseCurrency = Form.useWatch('base_currency', budgetForm);
  const watchedStatus = Form.useWatch('status', form);
  const tripStatus = watchedStatus || trip?.status;

  const refreshBudgetFx = async (from = tripCurrency, to = baseCurrency) => {
    const source = from || budgetForm.getFieldValue('trip_currency') || 'CNY';
    const target = to || budgetForm.getFieldValue('base_currency') || 'CNY';
    if (source === target) {
      budgetForm.setFieldsValue({ fx_rate: 1 });
      return;
    }
    try {
      const quote = await getFxRate(source, target);
      budgetForm.setFieldsValue({
        fx_rate: quote.rate,
        fx_date: quote.date ? dayjs(quote.date) : dayjs(),
      });
    } catch (error) {
      message.error(error.message || '获取汇率失败');
    }
  };

  useEffect(() => {
    if (!budgetOpen) return;
    if (skipBudgetFx.current) {
      skipBudgetFx.current = false;
      return;
    }
    refreshBudgetFx(tripCurrency, baseCurrency);
  }, [tripCurrency, baseCurrency, budgetOpen]);

  const applyTrip = useCallback((data) => {
    setTrip(data);
    form.setFieldsValue({
      title: data.title,
      destination: data.destination,
      dateRange: data.start_date && data.end_date ? [dayjs(data.start_date), dayjs(data.end_date)] : null,
      status: data.status,
      party_size: data.party_size,
      summary: data.summary,
    });
    setDays((data.days || []).map((day) => ({ ...day, _key: `day-${day.id}` })));
  }, [form]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTrip(id);
      applyTrip(data);
    } catch (error) {
      message.error(error.message || '加载出游计划失败');
    } finally {
      setLoading(false);
    }
  }, [id, applyTrip]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveMeta = async () => {
    setSavingMeta(true);
    try {
      const values = await form.validateFields();
      const data = await updateTrip(id, {
        title: values.title,
        destination: values.destination,
        start_date: values.dateRange?.[0]?.format('YYYY-MM-DD') || null,
        end_date: values.dateRange?.[1]?.format('YYYY-MM-DD') || null,
        status: values.status,
        party_size: values.party_size,
        summary: values.summary,
      });
      applyTrip(data);
      message.success('基础信息已保存');
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.message || '保存失败');
    } finally {
      setSavingMeta(false);
    }
  };

  const handleGenerateDays = () => {
    const range = form.getFieldValue('dateRange');
    if (!range?.[0] || !range?.[1]) {
      message.warning('请先填写出游日期');
      return;
    }
    setDays(buildDaysFromRange(range[0], range[1]));
  };

  const handleSaveDays = async () => {
    setSavingDays(true);
    try {
      const payload = days.map((day, index) => ({
        id: day.id,
        day_index: index + 1,
        date: day.date || null,
        title: day.title || '',
        lodging: day.lodging || '',
        notes: day.notes || '',
        sort_order: index,
      }));
      const data = await saveTripDays(id, payload);
      applyTrip(data);
      message.success('日程已保存');
    } catch (error) {
      message.error(error.message || '保存日程失败');
    } finally {
      setSavingDays(false);
    }
  };

  const openBudgetCreate = async () => {
    budgetForm.resetFields();
    let nextTripCurrency = 'CNY';
    try {
      const countries = await getCountries();
      nextTripCurrency = guessCurrencyFromDestination(trip?.destination, countries) || 'CNY';
    } catch { /* keep CNY */ }
    const nextBaseCurrency = 'CNY';
    let fxRate = nextTripCurrency === nextBaseCurrency ? 1 : undefined;
    let fxDate = dayjs();
    if (nextTripCurrency !== nextBaseCurrency) {
      try {
        const quote = await getFxRate(nextTripCurrency, nextBaseCurrency);
        fxRate = quote.rate;
        if (quote.date) fxDate = dayjs(quote.date);
      } catch { /* keep empty for manual input */ }
    }
    skipBudgetFx.current = true;
    budgetForm.setFieldsValue({
      title: `${trip?.title || '出游'} 预算`,
      base_currency: nextBaseCurrency,
      trip_currency: nextTripCurrency,
      fx_rate: fxRate,
      fx_date: fxDate,
    });
    setBudgetOpen(true);
  };

  const handleCreateBudget = async () => {
    if (creatingBudget) return;
    setCreatingBudget(true);
    try {
      const values = await budgetForm.validateFields();
      const created = await createBudget({
        title: values.title,
        trip_id: Number(id),
        party_size: trip?.party_size || 1,
        base_currency: values.base_currency,
        trip_currency: values.trip_currency,
        fx_rate: values.fx_rate,
        fx_date: values.fx_date ? values.fx_date.format('YYYY-MM-DD') : null,
        note: values.note,
      });
      message.success('预算已创建');
      setBudgetOpen(false);
      navigate(`/travel/budget/${created.id}?mode=edit`);
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.message || '创建预算失败');
    } finally {
      setCreatingBudget(false);
    }
  };

  const openShopping = async () => {
    if (!trip?.budget?.id) {
      message.warning('请先创建预算，才能把已买商品加到预算项里');
      return;
    }
    try {
      const result = await getShoppingLists({ trip_id: id, pageSize: 1 });
      const existing = result.data?.[0];
      if (existing) {
        navigate(`/travel/shopping/${existing.id}`);
        return;
      }
      const created = await createShoppingList({ trip_id: Number(id) });
      navigate(`/travel/shopping/${created.id}?mode=edit`);
    } catch (error) {
      message.error(error.message || '打开购物清单失败');
    }
  };

  const patchDay = (key, field, value) => {
    setDays((prev) => prev.map((day) => (day._key === key ? { ...day, [field]: value } : day)));
  };

  const dayColumns = [
    {
      title: 'DAY',
      width: 72,
      render: (_, __, index) => index + 1,
    },
    {
      title: '日期',
      dataIndex: 'date',
      width: 150,
      render: (value, record) => (
        <DatePicker
          value={value ? dayjs(value) : null}
          onChange={(date) => patchDay(record._key, 'date', date ? date.format('YYYY-MM-DD') : '')}
          style={{ width: '100%' }}
          inputReadOnly={preview}
          open={preview ? false : undefined}
          allowClear={!preview}
          disabled={preview}
        />
      ),
    },
    {
      title: '主题',
      dataIndex: 'title',
      render: (value, record) => (
        <Input readOnly={preview} value={value} onChange={(e) => patchDay(record._key, 'title', e.target.value)} placeholder="例如：环球影城 USJ" />
      ),
    },
    {
      title: '住宿',
      dataIndex: 'lodging',
      width: 180,
      render: (value, record) => (
        <Input readOnly={preview} value={value} onChange={(e) => patchDay(record._key, 'lodging', e.target.value)} placeholder="酒店" />
      ),
    },
    {
      title: '备注',
      dataIndex: 'notes',
      render: (value, record) => (
        <Input.TextArea
          readOnly={preview}
          autoSize={{ minRows: 1, maxRows: 4 }}
          value={value}
          onChange={(e) => patchDay(record._key, 'notes', e.target.value)}
          placeholder="路线 / 换乘 / 注意点"
        />
      ),
    },
    !preview && {
      title: '',
      width: 56,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Button type="link" danger icon={<DeleteOutlined />} onClick={() => setDays((prev) => prev.filter((day) => day._key !== record._key))} />
      ),
    },
  ].filter(Boolean);

  return (
    <ConfigProvider locale={zhCN}>
      <div className={`${styles.container} ${preview ? styles.preview : ''}`.trim()}>
        <div className={styles.header}>
          <div>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/travel/trips')}>返回列表</Button>
            <h2 className={styles.title}>{trip?.title || '出游详情'}</h2>
            <p className={styles.sub}>
              {[trip?.destination, trip?.start_date && trip?.end_date ? `${trip.start_date} ~ ${trip.end_date}` : null]
                .filter(Boolean)
                .join(' · ') || '完善日期和逐日行程'}
            </p>
          </div>
          <Space wrap className={styles.headerActions}>
            {trip?.id ? <TravelFileActions mode="export" tripId={trip.id} /> : null}
            {trip?.budget?.id ? (
              <Button icon={<AccountBookOutlined />} onClick={() => navigate(`/travel/budget/${trip.budget.id}`)}>
                {mobile ? null : '查看预算'}
              </Button>
            ) : (
              <Button icon={<AccountBookOutlined />} onClick={openBudgetCreate}>
                {mobile ? null : '创建预算'}
              </Button>
            )}
            <Button icon={<CalculatorOutlined />} onClick={openShopping}>
              {mobile ? null : '购物清单'}
            </Button>
            {preview ? (
              <Button type="primary" icon={<EditOutlined />} onClick={() => setSearchParams({ mode: 'edit' })}>编辑</Button>
            ) : (
              <Button icon={<EyeOutlined />} onClick={() => setSearchParams({})}>预览</Button>
            )}
          </Space>
        </div>

        {tripStatus === 'ongoing' ? (
          <TripTodayBanner days={days} startDate={trip?.start_date} />
        ) : null}

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
                <Form.Item name="destination" label="目的地">
                  <DestinationCascader disabled={preview} />
                </Form.Item>
                <Form.Item name="dateRange" label="日期">
                  <DatePicker.RangePicker disabled={preview} inputReadOnly={preview || mobile} allowClear={!preview} style={{ width: mobile ? '100%' : undefined }} />
                </Form.Item>
                <Form.Item name="status" label="状态">
                  <Select disabled={preview} open={preview ? false : undefined} style={{ width: 140 }} options={getDict('trip_status').map((item) => ({ value: item.value, label: item.label }))} />
                </Form.Item>
                <Form.Item name="party_size" label="人数">
                  <InputNumber readOnly={preview} controls={!preview} min={1} />
                </Form.Item>
              </Space>
              <Form.Item name="summary" label="行程备注">
                <Input.TextArea readOnly={preview} rows={4} placeholder="贴士、避坑、交通卡方案" />
              </Form.Item>
            </Form>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>日程总览</h3>
              {!preview && (
                <div className={styles.tableActions}>
                  <Button onClick={handleGenerateDays}>按日期生成</Button>
                  <Button icon={<PlusOutlined />} onClick={() => setDays((prev) => [...prev, {
                    _key: nextKey('day'),
                    day_index: prev.length + 1,
                    date: '',
                    title: '',
                    lodging: '',
                    notes: '',
                    sort_order: prev.length,
                  }])}>加一天</Button>
                  <Button type="primary" icon={<SaveOutlined />} loading={savingDays} onClick={handleSaveDays}>保存日程</Button>
                </div>
              )}
            </div>
            {mobile ? (
              <div className={styles.cardList} style={{ overflow: 'visible', flex: 'none' }}>
                {days.map((record, index) => (
                  <div className={styles.dayCard} key={record._key}>
                    <div className={styles.cardHead}>
                      <strong>DAY {index + 1}</strong>
                      {!preview && (
                        <Button type="link" danger icon={<DeleteOutlined />} onClick={() => setDays((prev) => prev.filter((day) => day._key !== record._key))} />
                      )}
                    </div>
                    <div className={styles.fieldGrid}>
                      <div>
                        <div className={styles.fieldLabel}>日期</div>
                        <DatePicker
                          value={record.date ? dayjs(record.date) : null}
                          onChange={(date) => patchDay(record._key, 'date', date ? date.format('YYYY-MM-DD') : '')}
                          style={{ width: '100%' }}
                          inputReadOnly={preview || mobile}
                          open={preview ? false : undefined}
                          allowClear={!preview}
                          disabled={preview}
                        />
                      </div>
                      <div>
                        <div className={styles.fieldLabel}>住宿</div>
                        <Input readOnly={preview} value={record.lodging} onChange={(e) => patchDay(record._key, 'lodging', e.target.value)} placeholder="酒店" />
                      </div>
                      <div className={styles.fullField}>
                        <div className={styles.fieldLabel}>主题</div>
                        <Input readOnly={preview} value={record.title} onChange={(e) => patchDay(record._key, 'title', e.target.value)} placeholder="例如：环球影城 USJ" />
                      </div>
                      <div className={styles.fullField}>
                        <div className={styles.fieldLabel}>备注</div>
                        <Input.TextArea
                          readOnly={preview}
                          autoSize={{ minRows: 2, maxRows: 6 }}
                          value={record.notes}
                          onChange={(e) => patchDay(record._key, 'notes', e.target.value)}
                          placeholder="路线 / 换乘 / 注意点"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {!days.length ? <div className={styles.cardMeta}>还没有日程，可按日期生成或加一天</div> : null}
              </div>
            ) : (
              <ListTable
                columns={dayColumns}
                dataSource={days}
                rowKey="_key"
                pagination={false}
                loading={loading}
                scroll={{ x: 900 }}
              />
            )}
          </div>
        </div>

        <Modal
          title="为这次出游创建预算"
          open={budgetOpen}
          onOk={handleCreateBudget}
          onCancel={() => setBudgetOpen(false)}
          confirmLoading={creatingBudget}
          okText="创建"
          cancelText="取消"
          width={mobile ? 'calc(100vw - 24px)' : 520}
        >
          <Form form={budgetForm} layout="vertical" className={styles.formStack} style={{ marginTop: 16 }}>
            <Form.Item name="title" label="标题" rules={[{ required: true, message: '请填写标题' }]}>
              <Input />
            </Form.Item>
            <Space size={16} style={{ display: 'flex' }} wrap>
              <Form.Item name="trip_currency" label="出行币">
                <CurrencySelect />
              </Form.Item>
              <Form.Item name="base_currency" label="本币">
                <CurrencySelect />
              </Form.Item>
              <Form.Item name="fx_rate" label={`1 ${tripCurrency || '出行币'} = ? ${baseCurrency || '本币'}`} rules={[{ required: true, message: '请填写汇率' }]}>
                <InputNumber min={0} step={0.0001} style={{ width: mobile ? '100%' : 140 }} disabled={tripCurrency === baseCurrency} placeholder="可自动获取" />
              </Form.Item>
              <Button onClick={() => refreshBudgetFx()} icon={<ReloadOutlined />}>获取汇率</Button>
              <Form.Item name="fx_date" label="汇率日期">
                <DatePicker inputReadOnly={mobile} />
              </Form.Item>
            </Space>
            <Form.Item name="note" label="备注">
              <Input.TextArea rows={3} />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </ConfigProvider>
  );
}
