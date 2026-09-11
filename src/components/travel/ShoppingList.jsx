import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Button, Form, Input, Select, Space, message, ConfigProvider, Popconfirm, Pagination, Spin, Modal,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined, EyeOutlined,
} from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import { getShoppingLists, createShoppingList, deleteShoppingList } from '../../api/shopping';
import { getTrips } from '../../api/trips';
import { useDict } from '../../contexts/DictContext';
import { formatMoney } from '../../utils/tripMoney';
import useIsMobile from '../../hooks/useIsMobile';
import ListTable from '../ListTable';
import styles from './travel.module.css';

export default function ShoppingList() {
  const navigate = useNavigate();
  const location = useLocation();
  const mobile = useIsMobile();
  const { getLabel, getColor } = useDict();
  const [searchForm] = Form.useForm();
  const [createForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({});
  const [deletingId, setDeletingId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tripOptions, setTripOptions] = useState([]);
  const paginationRef = useRef(pagination);
  const filtersRef = useRef(filters);
  paginationRef.current = pagination;
  filtersRef.current = filters;

  const load = useCallback(async (page = 1, pageSize = 10, params = filtersRef.current) => {
    setLoading(true);
    try {
      const result = await getShoppingLists({ page, pageSize, ...params });
      setRows(result.data || []);
      setPagination(result.pagination || { page, pageSize, total: 0 });
    } catch (error) {
      message.error(error.message || '加载购物清单失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback((page, pageSize) => {
    const pager = paginationRef.current;
    return load(page ?? pager.page, pageSize ?? pager.pageSize, filtersRef.current);
  }, [load]);

  useEffect(() => {
    reload();
  }, [location.key, reload]);

  const handleSearch = (values) => {
    const params = {};
    if (values.title) params.title = values.title;
    setFilters(params);
    load(1, pagination.pageSize, params);
  };

  const openCreate = async () => {
    createForm.resetFields();
    try {
      const result = await getTrips({ page: 1, pageSize: 100 });
      setTripOptions((result.data || []).map((trip) => ({
        value: trip.id,
        label: trip.budget?.id ? trip.title : `${trip.title}（还没有预算）`,
        disabled: !trip.budget?.id,
      })));
    } catch (error) {
      message.error(error.message || '加载出游计划失败');
    }
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const values = await createForm.validateFields();
      const created = await createShoppingList({
        trip_id: values.trip_id,
        title: values.title,
      });
      setCreateOpen(false);
      navigate(`/travel/shopping/${created.id}?mode=edit`);
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.message || '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteShoppingList(id);
      message.success('删除成功');
      const remaining = rows.filter((row) => row.id !== id);
      const nextPage = remaining.length === 0 && pagination.page > 1 ? pagination.page - 1 : pagination.page;
      await reload(nextPage);
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

  const actions = (record) => (
    <Space>
      <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/travel/shopping/${record.id}`)} />
      <Button type="link" icon={<EditOutlined />} onClick={() => navigate(`/travel/shopping/${record.id}?mode=edit`)} />
      <Popconfirm
        title="确定删除这份清单？已买金额会从关联预算项里扣回。"
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
    { title: '清单', dataIndex: 'title', ellipsis: true },
    {
      title: '出游',
      width: 180,
      ellipsis: true,
      render: (_, record) => record.trip?.title || '-',
    },
    {
      title: '状态',
      width: 88,
      render: (_, record) => {
        const value = record.trip?.status;
        if (!value) return '-';
        return <span style={{ color: statusColor(value) }}>{getLabel('trip_status', value)}</span>;
      },
    },
    {
      title: '想买 / 已买',
      width: 110,
      render: (_, record) => `${record.stats?.want_count || 0} / ${record.stats?.bought_count || 0}`,
    },
    {
      title: '已买合计',
      width: 130,
      render: (_, record) => `¥${formatMoney(record.stats?.bought_total_cny, 'CNY')}`,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      align: 'center',
      render: (_, record) => actions(record),
    },
  ];

  return (
    <ConfigProvider locale={zhCN}>
      <div className={`${styles.container} ${styles.listPage}`}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>购物清单</h2>
            <p className={styles.sub}>路上看到想买的先记下来，最后一天打开已买，金额会加到关联的预算项</p>
          </div>
          <Space wrap className={styles.headerActions}>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建清单</Button>
          </Space>
        </div>

        <div className={styles.searchBar}>
          <Form form={searchForm} layout="inline" onFinish={handleSearch} style={{ flexWrap: 'wrap', gap: 8 }}>
            <Form.Item name="title" style={{ marginBottom: 0 }}>
              <Input placeholder="搜索清单标题" allowClear style={{ width: mobile ? '100%' : 200 }} />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>筛选</Button>
                <Button icon={<ReloadOutlined />} onClick={() => { searchForm.resetFields(); setFilters({}); load(1, pagination.pageSize, {}); }}>重置</Button>
              </Space>
            </Form.Item>
          </Form>
        </div>

        {mobile ? (
          <Spin spinning={loading}>
            <div className={styles.cardList}>
              {rows.map((record) => (
                <div className={styles.card} key={record.id} onClick={() => navigate(`/travel/shopping/${record.id}`)}>
                  <h3 className={styles.cardTitle}>{record.title}</h3>
                  <div className={styles.cardMeta}>
                    {record.trip?.title || '未关联出游'}
                    {record.trip?.status ? ` · ${getLabel('trip_status', record.trip.status)}` : ''}
                  </div>
                  <div className={styles.cardMoney}>
                    <div className={styles.cardMoneyItem}>
                      <div className={styles.cardMoneyLabel}>想买</div>
                      <div className={styles.cardMoneyValue}>{record.stats?.want_count || 0}</div>
                    </div>
                    <div className={styles.cardMoneyItem}>
                      <div className={styles.cardMoneyLabel}>已买</div>
                      <div className={styles.cardMoneyValue}>{record.stats?.bought_count || 0}</div>
                    </div>
                    <div className={styles.cardMoneyItem}>
                      <div className={styles.cardMoneyLabel}>已买合计</div>
                      <div className={styles.cardMoneyValue}>¥{formatMoney(record.stats?.bought_total_cny, 'CNY')}</div>
                    </div>
                  </div>
                  <div className={styles.cardActions} onClick={(event) => event.stopPropagation()}>
                    {actions(record)}
                  </div>
                </div>
              ))}
              {!loading && !rows.length ? <div className={styles.cardMeta}>还没有购物清单</div> : null}
            </div>
            <Pagination
              className={styles.mobilePager}
              current={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              simple
              onChange={(page, pageSize) => load(page, pageSize)}
            />
          </Spin>
        ) : (
          <div className={styles.tableWrap}>
            <ListTable
              columns={columns}
              dataSource={rows}
              loading={loading}
              pagination={{
                current: pagination.page,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 份清单`,
              }}
              onChange={(pager) => load(pager.current, pager.pageSize)}
              scroll={{ x: 900, y: 'calc(100vh - 280px)' }}
            />
          </div>
        )}

        <Modal
          title="新建购物清单"
          open={createOpen}
          onOk={handleCreate}
          onCancel={() => setCreateOpen(false)}
          confirmLoading={creating}
          okText="创建"
          cancelText="取消"
        >
          <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item name="trip_id" label="出游计划" rules={[{ required: true, message: '请选择出游计划' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="选择已有预算的出游"
                options={tripOptions}
              />
            </Form.Item>
            <Form.Item name="title" label="标题">
              <Input placeholder="可留空，默认用出游名称" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </ConfigProvider>
  );
}
