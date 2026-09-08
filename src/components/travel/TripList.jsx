import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Button, Modal, Form, Input, InputNumber, Select, Space, Popconfirm, message, DatePicker, ConfigProvider, Pagination, Spin,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import { getTrips, createTrip, deleteTrip } from '../../api/trips';
import { useDict } from '../../contexts/DictContext';
import useIsMobile from '../../hooks/useIsMobile';
import ListTable from '../ListTable';
import TravelFileActions from './TravelFileActions';
import DestinationCascader from './DestinationCascader';
import styles from './travel.module.css';

export default function TripList() {
  const navigate = useNavigate();
  const location = useLocation();
  const mobile = useIsMobile();
  const { getDict, getLabel, getColor } = useDict();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [searchParams, setSearchParams] = useState({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const paginationRef = useRef(pagination);
  const searchRef = useRef(searchParams);
  paginationRef.current = pagination;
  searchRef.current = searchParams;

  const loadTrips = useCallback(async (page = 1, pageSize = 10, search = {}) => {
    setLoading(true);
    try {
      const result = await getTrips({ page, pageSize, ...search });
      setTrips(result.data || []);
      setPagination(result.pagination || { page, pageSize, total: 0, totalPages: 0 });
    } catch (error) {
      message.error(error.message || '加载出游计划失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadTrips = useCallback((page, pageSize, search) => {
    const pager = paginationRef.current;
    return loadTrips(
      page ?? pager.page,
      pageSize ?? pager.pageSize,
      search ?? searchRef.current,
    );
  }, [loadTrips]);

  useEffect(() => {
    reloadTrips();
  }, [location.key, reloadTrips]);

  const handleSearch = (values) => {
    const params = {};
    if (values.title) params.title = values.title;
    if (values.destination) params.destination = values.destination;
    if (values.status) params.status = values.status;
    if (values.dateRange?.[0]) params.dateFrom = values.dateRange[0].format('YYYY-MM-DD');
    if (values.dateRange?.[1]) params.dateTo = values.dateRange[1].format('YYYY-MM-DD');
    setSearchParams(params);
    loadTrips(1, pagination.pageSize, params);
  };

  const handleAdd = () => {
    form.resetFields();
    form.setFieldsValue({
      party_size: 2,
      status: 'planning',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      const created = await createTrip({
        title: values.title,
        destination: values.destination,
        start_date: values.dateRange?.[0]?.format('YYYY-MM-DD') || null,
        end_date: values.dateRange?.[1]?.format('YYYY-MM-DD') || null,
        status: values.status,
        party_size: values.party_size,
        summary: values.summary,
      });
      message.success('创建成功');
      setModalOpen(false);
      await reloadTrips(1);
      navigate(`/travel/trips/${created.id}?mode=edit`);
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteTrip(id);
      message.success('删除成功');
      const pager = paginationRef.current;
      const remaining = trips.filter((trip) => trip.id !== id);
      setTrips(remaining);
      const nextPage = remaining.length === 0 && pager.page > 1 ? pager.page - 1 : pager.page;
      await reloadTrips(nextPage);
    } catch (error) {
      message.error(error.message || '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  const statusColor = (value) => {
    const colorMap = { blue: '#1677ff', orange: '#fa8c16', green: '#52c41a', red: '#ff4d4f' };
    return colorMap[getColor('trip_status', value)] || undefined;
  };

  const tripActions = (record) => (
    <Space>
      <TravelFileActions mode="export" tripId={record.id} />
      <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/travel/trips/${record.id}`)} />
      <Button type="link" icon={<EditOutlined />} onClick={() => navigate(`/travel/trips/${record.id}?mode=edit`)} />
      <Popconfirm
        title="确定删除这次出游？关联预算会取消关联，日程会一并删除。"
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
    { title: '标题', dataIndex: 'title', key: 'title', width: 200, ellipsis: true },
    { title: '目的地', dataIndex: 'destination', key: 'destination', width: 140, ellipsis: true },
    {
      title: '日期',
      key: 'dates',
      width: 200,
      render: (_, record) => [record.start_date, record.end_date].filter(Boolean).join(' ~ ') || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 88,
      render: (value) => {
        return <span style={{ color: statusColor(value) }}>{getLabel('trip_status', value)}</span>;
      },
    },
    { title: '人数', dataIndex: 'party_size', width: 72 },
    {
      title: '关联预算',
      key: 'budget',
      width: 160,
      ellipsis: true,
      render: (_, record) => record.budget?.title || '未关联',
    },
    {
      title: '操作',
      key: 'action',
      width: 168,
      fixed: 'right',
      align: 'center',
      render: (_, record) => tripActions(record),
    },
  ];

  return (
    <ConfigProvider locale={zhCN}>
      <div className={`${styles.container} ${styles.listPage}`}>
        <div className={styles.header}>
          <h2 className={styles.title}>出游计划</h2>
          <Space wrap className={styles.headerActions}>
            <TravelFileActions
              mode="import"
              onImported={(data) => {
                reloadTrips();
                navigate(`/travel/trips/${data.id}`);
              }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>{mobile ? '新建' : '新建出游'}</Button>
          </Space>
        </div>

        <div className={styles.searchBar}>
          <Form form={searchForm} layout="inline" onFinish={handleSearch} style={{ flexWrap: 'wrap', gap: 8 }}>
            <Form.Item name="title" style={{ marginBottom: 0 }}>
              <Input placeholder="搜索标题" style={{ width: mobile ? '100%' : 150 }} allowClear />
            </Form.Item>
            <Form.Item name="destination" style={{ marginBottom: 0 }}>
              <Input placeholder="目的地" style={{ width: mobile ? '100%' : 140 }} allowClear />
            </Form.Item>
            <Form.Item name="status" style={{ marginBottom: 0 }}>
              <Select
                allowClear
                placeholder="状态"
                style={{ width: mobile ? '100%' : 120 }}
                options={getDict('trip_status').map((item) => ({ value: item.value, label: item.label }))}
              />
            </Form.Item>
            <Form.Item name="dateRange" style={{ marginBottom: 0 }}>
              <DatePicker.RangePicker style={{ width: mobile ? '100%' : 240 }} inputReadOnly={mobile} />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>搜索</Button>
                <Button icon={<ReloadOutlined />} onClick={() => {
                  searchForm.resetFields();
                  setSearchParams({});
                  loadTrips(1, pagination.pageSize, {});
                }}>重置</Button>
              </Space>
            </Form.Item>
          </Form>
        </div>

        {mobile ? (
          <Spin spinning={loading}>
            <div className={styles.cardList}>
              {trips.map((record) => (
                <div className={styles.card} key={record.id} onClick={() => navigate(`/travel/trips/${record.id}`)}>
                  <div className={styles.cardHead}>
                    <h3 className={styles.cardTitle}>{record.title}</h3>
                    <span style={{ color: statusColor(record.status), fontSize: 13, flexShrink: 0 }}>
                      {getLabel('trip_status', record.status)}
                    </span>
                  </div>
                  <div className={styles.cardMeta}>
                    {[record.destination, [record.start_date, record.end_date].filter(Boolean).join(' ~ '), `${record.party_size || 1} 人`]
                      .filter(Boolean)
                      .join(' · ') || '未填写目的地和日期'}
                  </div>
                  <div className={styles.cardMeta}>关联预算：{record.budget?.title || '未关联'}</div>
                  <div className={styles.cardActions} onClick={(event) => event.stopPropagation()}>
                    {tripActions(record)}
                  </div>
                </div>
              ))}
              {!loading && !trips.length ? <div className={styles.cardMeta}>暂无出游计划</div> : null}
            </div>
            <Pagination
              className={styles.mobilePager}
              current={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              simple
              onChange={(page, pageSize) => loadTrips(page, pageSize, searchParams)}
            />
          </Spin>
        ) : (
          <div className={styles.tableWrap}>
            <ListTable
              key={trips.map((trip) => `${trip.id}:${trip.updated_at || ''}`).join('|')}
              columns={columns}
              dataSource={trips}
              loading={loading}
              pagination={{
                current: pagination.page,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 次出游`,
              }}
              onChange={(pager) => loadTrips(pager.current, pager.pageSize, searchParams)}
              scroll={{ x: 980, y: 'calc(100vh - 280px)' }}
            />
          </div>
        )}

        <Modal
          title="新建出游"
          open={modalOpen}
          onOk={handleSubmit}
          onCancel={() => setModalOpen(false)}
          confirmLoading={submitting}
          okText="创建"
          cancelText="取消"
          width={mobile ? 'calc(100vw - 24px)' : 520}
        >
          <Form form={form} layout="vertical" className={styles.formStack} style={{ marginTop: 16 }}>
            <Form.Item name="title" label="标题" rules={[{ required: true, message: '请填写标题' }]}>
              <Input placeholder="例如：日本关西 8 日游" />
            </Form.Item>
            <Form.Item name="destination" label="目的地">
              <DestinationCascader />
            </Form.Item>
            <Form.Item name="dateRange" label="日期">
              <DatePicker.RangePicker style={{ width: '100%' }} inputReadOnly={mobile} />
            </Form.Item>
            <Space size={16} style={{ display: 'flex' }} wrap>
              <Form.Item name="party_size" label="人数">
                <InputNumber min={1} style={{ width: mobile ? '100%' : 100 }} />
              </Form.Item>
              <Form.Item name="status" label="状态">
                <Select
                  style={{ width: mobile ? '100%' : 140 }}
                  options={getDict('trip_status').map((item) => ({ value: item.value, label: item.label }))}
                />
              </Form.Item>
            </Space>
            <Form.Item name="summary" label="行程备注">
              <Input.TextArea rows={3} placeholder="交通卡方案、避坑等" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </ConfigProvider>
  );
}
