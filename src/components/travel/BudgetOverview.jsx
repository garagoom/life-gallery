import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Form, Input, Select, DatePicker, Space, Switch, message, ConfigProvider, Popconfirm, Pagination, Spin,
} from 'antd';
import {
  ReloadOutlined, SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined,
} from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import { getBudgets, deleteBudget, setBudgetMain } from '../../api/budgets';
import { useDict } from '../../contexts/DictContext';
import { formatMoney, remainingClass } from '../../utils/tripMoney';
import useIsMobile from '../../hooks/useIsMobile';
import ListTable from '../ListTable';
import styles from './travel.module.css';

export default function BudgetOverview() {
  const navigate = useNavigate();
  const mobile = useIsMobile();
  const { getDict, getLabel, getColor } = useDict();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ totals: {}, data: [], pagination: { page: 1, pageSize: 10, total: 0 } });
  const [includeOptional, setIncludeOptional] = useState(false);
  const [filters, setFilters] = useState({});
  const [deletingId, setDeletingId] = useState(null);

  const load = async (page = 1, pageSize = 10, params = filters, optional = includeOptional) => {
    setLoading(true);
    try {
      const result = await getBudgets({ page, pageSize, ...params, include_optional: optional ? 1 : 0 });
      setData({
        totals: result.totals || {},
        data: result.data || [],
        pagination: result.pagination,
      });
    } catch (error) {
      message.error(error.message || '加载预算失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSearch = (values) => {
    const params = {};
    if (values.title) params.title = values.title;
    if (values.status) params.status = values.status;
    if (values.dateRange?.[0]) params.dateFrom = values.dateRange[0].format('YYYY-MM-DD');
    if (values.dateRange?.[1]) params.dateTo = values.dateRange[1].format('YYYY-MM-DD');
    setFilters(params);
    load(1, data.pagination.pageSize, params);
  };

  const handleMain = async (record, checked) => {
    try {
      await setBudgetMain(record.id, checked);
      message.success(checked ? '已设为主线' : '已取消主线');
      load(data.pagination.page, data.pagination.pageSize);
    } catch (error) {
      message.error(error.message || '设置主线失败');
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteBudget(id);
      message.success('删除成功');
      load(data.pagination.page, data.pagination.pageSize);
    } catch (error) {
      message.error(error.message || '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  const totals = data.totals || {};

  const budgetActions = (record) => (
    <Space>
      <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/travel/budget/${record.id}`)} />
      <Button type="link" icon={<EditOutlined />} onClick={() => navigate(`/travel/budget/${record.id}?mode=edit`)} />
      <Popconfirm
        title="确定删除这份预算？明细和记账会一并删除。"
        onConfirm={() => handleDelete(record.id)}
        okText="确定"
        cancelText="取消"
        okButtonProps={{ loading: deletingId === record.id }}
      >
        <Button type="link" danger icon={<DeleteOutlined />} />
      </Popconfirm>
    </Space>
  );

  const columns = [
    { title: '预算', dataIndex: 'title', ellipsis: true },
    {
      title: '主线',
      dataIndex: 'is_main',
      width: 72,
      render: (value, record) => (
        <Switch
          checked={!!value}
          onChange={(checked) => handleMain(record, checked)}
        />
      ),
    },
    {
      title: '关联出游',
      width: 180,
      ellipsis: true,
      render: (_, record) => (
        record.trip?.id ? (
          <Button
            type="link"
            style={{ padding: 0, height: 'auto' }}
            onClick={() => navigate(`/travel/trips/${record.trip.id}`)}
          >
            {record.trip.title}
          </Button>
        ) : '未关联'
      ),
    },
    {
      title: '日期',
      width: 200,
      render: (_, record) => [record.trip?.start_date, record.trip?.end_date].filter(Boolean).join(' ~ ') || '-',
    },
    {
      title: '状态',
      width: 88,
      render: (_, record) => {
        const value = record.trip?.status;
        if (!value) return '-';
        const colorMap = { blue: '#1677ff', orange: '#fa8c16', green: '#52c41a', red: '#ff4d4f' };
        const color = getColor('trip_status', value);
        return <span style={{ color: colorMap[color] || undefined }}>{getLabel('trip_status', value)}</span>;
      },
    },
    {
      title: '计划',
      width: 120,
      render: (_, record) => `¥${formatMoney(record.summary_stats?.planned_total_cny, 'CNY')}`,
    },
    {
      title: '已订',
      width: 110,
      render: (_, record) => `¥${formatMoney(record.summary_stats?.booked_total_cny, 'CNY')}`,
    },
    {
      title: '已花',
      width: 110,
      render: (_, record) => `¥${formatMoney(record.summary_stats?.spent_total_cny, 'CNY')}`,
    },
    {
      title: '剩余',
      width: 110,
      render: (_, record) => (
        <span className={`${styles.statValue} ${remainingClass(record.summary_stats?.remaining_cny) === 'over' ? styles.over : ''}`} style={{ fontSize: 14 }}>
          ¥{formatMoney(record.summary_stats?.remaining_cny, 'CNY')}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      align: 'center',
      render: (_, record) => budgetActions(record),
    },
  ];

  return (
    <ConfigProvider locale={zhCN}>
      <div className={`${styles.container} ${styles.listPage}`}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>预算总览</h2>
            <p className={styles.sub}>查看各次出游的开销；新建请从出游计划进入</p>
          </div>
          <Space wrap className={styles.headerActions}>
            <Switch
              checked={includeOptional}
              onChange={(checked) => {
                setIncludeOptional(checked);
                load(1, data.pagination.pageSize, filters, checked);
              }}
              checkedChildren="含可选"
              unCheckedChildren="不含可选"
            />
          </Space>
        </div>

        <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>计划合计</div>
              <div className={styles.statValue}>¥{formatMoney(totals.planned_cny, 'CNY')}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>已订</div>
              <div className={styles.statValue}>¥{formatMoney(totals.booked_cny, 'CNY')}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>待购 / 估算</div>
              <div className={styles.statValue}>¥{formatMoney(totals.pending_cny, 'CNY')}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>已支出</div>
              <div className={styles.statValue}>¥{formatMoney(totals.spent_cny, 'CNY')}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>剩余</div>
              <div className={`${styles.statValue} ${remainingClass(totals.remaining_cny) === 'over' ? styles.over : ''}`}>¥{formatMoney(totals.remaining_cny, 'CNY')}</div>
            </div>
          </div>

          <div className={styles.searchBar}>
            <Form form={form} layout="inline" onFinish={handleSearch} style={{ flexWrap: 'wrap', gap: 8 }}>
              <Form.Item name="title" style={{ marginBottom: 0 }}>
                <Input placeholder="搜索预算标题" allowClear style={{ width: mobile ? '100%' : 160 }} />
              </Form.Item>
              <Form.Item name="status" style={{ marginBottom: 0 }}>
                <Select
                  allowClear
                  placeholder="出游状态"
                  style={{ width: mobile ? '100%' : 140 }}
                  options={getDict('trip_status').map((item) => ({ value: item.value, label: item.label }))}
                />
              </Form.Item>
              <Form.Item name="dateRange" style={{ marginBottom: 0 }}>
                <DatePicker.RangePicker inputReadOnly={mobile} style={{ width: mobile ? '100%' : undefined }} />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Space>
                  <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>筛选</Button>
                  <Button icon={<ReloadOutlined />} onClick={() => { form.resetFields(); setFilters({}); load(1, data.pagination.pageSize, {}); }}>重置</Button>
                </Space>
              </Form.Item>
            </Form>
          </div>

          {mobile ? (
            <Spin spinning={loading}>
              <div className={styles.cardList}>
                {(data.data || []).map((record) => (
                  <div className={styles.card} key={record.id} onClick={() => navigate(`/travel/budget/${record.id}`)}>
                    <div className={styles.cardHead}>
                      <h3 className={styles.cardTitle}>{record.title}</h3>
                      <div onClick={(event) => event.stopPropagation()}>
                        <Switch
                          checked={!!record.is_main}
                          onChange={(checked) => handleMain(record, checked)}
                        />
                      </div>
                    </div>
                    <div className={styles.cardMeta}>
                      {record.trip?.id ? (
                        <Button
                          type="link"
                          style={{ padding: 0, height: 'auto' }}
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/travel/trips/${record.trip.id}`);
                          }}
                        >
                          {record.trip.title}
                        </Button>
                      ) : '未关联出游'}
                      {record.trip?.start_date ? ` · ${[record.trip.start_date, record.trip.end_date].filter(Boolean).join(' ~ ')}` : ''}
                    </div>
                    <div className={styles.cardMoney}>
                      <div className={styles.cardMoneyItem}>
                        <div className={styles.cardMoneyLabel}>计划</div>
                        <div className={styles.cardMoneyValue}>¥{formatMoney(record.summary_stats?.planned_total_cny, 'CNY')}</div>
                      </div>
                      <div className={styles.cardMoneyItem}>
                        <div className={styles.cardMoneyLabel}>已花</div>
                        <div className={styles.cardMoneyValue}>¥{formatMoney(record.summary_stats?.spent_total_cny, 'CNY')}</div>
                      </div>
                      <div className={styles.cardMoneyItem}>
                        <div className={styles.cardMoneyLabel}>剩余</div>
                        <div className={`${styles.cardMoneyValue} ${remainingClass(record.summary_stats?.remaining_cny) === 'over' ? styles.over : ''}`}>
                          ¥{formatMoney(record.summary_stats?.remaining_cny, 'CNY')}
                        </div>
                      </div>
                    </div>
                    <div className={styles.cardActions} onClick={(event) => event.stopPropagation()}>
                      {budgetActions(record)}
                    </div>
                  </div>
                ))}
                {!loading && !(data.data || []).length ? <div className={styles.cardMeta}>暂无预算</div> : null}
              </div>
              <Pagination
                className={styles.mobilePager}
                current={data.pagination.page}
                pageSize={data.pagination.pageSize}
                total={data.pagination.total}
                simple
                onChange={(page, pageSize) => load(page, pageSize)}
              />
            </Spin>
          ) : (
          <div className={styles.tableWrap}>
            <ListTable
              columns={columns}
              dataSource={data.data || []}
              loading={loading}
              pagination={{
                current: data.pagination.page,
                pageSize: data.pagination.pageSize,
                total: data.pagination.total,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 份预算`,
              }}
              onChange={(pager) => load(pager.current, pager.pageSize)}
              scroll={{ x: 1200, y: 'calc(100vh - 360px)' }}
            />
          </div>
          )}
      </div>
    </ConfigProvider>
  );
}
