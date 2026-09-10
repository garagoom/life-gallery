import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Space, Popconfirm, Tag, Select, message, Checkbox, Pagination, Spin } from 'antd';
import { CheckOutlined, CloseOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { getReviewPhotos, reviewPhoto, batchReviewPhotos } from '../api/photos';
import { getThumbnailUrl } from '../data/photos';
import { cachePhoto } from '../utils/imageCache';
import { useDict } from '../contexts/DictContext';
import useIsMobile from '../hooks/useIsMobile';
import ListTable from './ListTable';
import styles from './Admin.module.css';

export default function ReviewManage() {
  const navigate = useNavigate();
  const location = useLocation();
  const mobile = useIsMobile();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const { getDict, getLabel, getColor } = useDict();
  const reviewStatuses = getDict('review_status');

  const loadPhotos = async (page = 1, pageSize = 20, filter) => {
    setLoading(true);
    try {
      const params = { page, pageSize };
      if (filter !== undefined) params.review_status = filter;
      const result = await getReviewPhotos(params);
      setPhotos(result.data || []);
      setPagination(result.pagination);
    } catch (err) {
      message.error(err.message || '加载失败');
    }
    setLoading(false);
  };

  useEffect(() => { loadPhotos(1, pagination.pageSize, statusFilter); }, []);

  const handleFilter = (val) => {
    setStatusFilter(val);
    setSelectedRowKeys([]);
    loadPhotos(1, pagination.pageSize, val);
  };

  const handleReset = () => {
    setStatusFilter(undefined);
    setSelectedRowKeys([]);
    loadPhotos(1, pagination.pageSize, undefined);
  };

  const handleView = useCallback((record) => {
    cachePhoto(record.id, record);
    navigate(`/photography/photo/${record.id}`, { state: { background: location } });
  }, [navigate, location]);

  const handleReview = async (id, review_status) => {
    try {
      await reviewPhoto(id, review_status);
      message.success(review_status === 1 ? '审核通过' : '审核失败');
      loadPhotos(pagination.page, pagination.pageSize, statusFilter);
    } catch (err) {
      message.error(err.message || '操作失败');
    }
  };

  const handleBatchReview = async (review_status) => {
    if (selectedRowKeys.length === 0) return;
    setBatchLoading(true);
    try {
      await batchReviewPhotos(selectedRowKeys, review_status);
      message.success(review_status === 1 ? `审核通过 ${selectedRowKeys.length} 张` : `审核失败 ${selectedRowKeys.length} 张`);
      setSelectedRowKeys([]);
      loadPhotos(pagination.page, pagination.pageSize, statusFilter);
    } catch (err) {
      message.error(err.message || '批量操作失败');
    }
    setBatchLoading(false);
  };

  const toggleSelect = (id) => {
    setSelectedRowKeys((keys) => (
      keys.includes(id) ? keys.filter((key) => key !== id) : [...keys, id]
    ));
  };

  const reviewActions = (record) => (
    <Space size="small">
      <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)} />
      {record.review_status !== 1 && (
        <Popconfirm title="确认审核通过？" onConfirm={() => handleReview(record.id, 1)} okText="确定" cancelText="取消">
          <Button type="link" size="small" icon={<CheckOutlined style={{ color: '#52c41a' }} />} />
        </Popconfirm>
      )}
      {record.review_status !== 2 && (
        <Popconfirm title="确认审核失败？" onConfirm={() => handleReview(record.id, 2)} okText="确定" cancelText="取消">
          <Button type="link" size="small" danger icon={<CloseOutlined />} />
        </Popconfirm>
      )}
    </Space>
  );

  const formatReviewedAt = (value) => {
    if (!value) return '-';
    const text = String(value).replace('T', ' ');
    return text.length > 16 ? text.slice(0, 16) : text;
  };

  const columns = [
    {
      title: '照片',
      key: 'photo',
      width: 80,
      render: (_, record) => (
        <img
          src={getThumbnailUrl(record)}
          alt={record.title}
          style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }}
          onClick={() => handleView(record)}
        />
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 180,
      ellipsis: true,
    },
    {
      title: '上传者',
      key: 'uploader',
      width: 160,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {record.uploader_avatar ? (
            <img src={record.uploader_avatar} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
              {(record.uploader_display_name || record.uploaded_by || '?').slice(0, 1)}
            </div>
          )}
          <span>{record.uploader_display_name || record.uploaded_by}</span>
        </div>
      ),
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      key: 'review_status',
      width: 100,
      align: 'center',
      render: (val) => {
        return <Tag color={getColor('review_status', val)}>{getLabel('review_status', val)}</Tag>;
      },
    },
    {
      title: '审核人',
      key: 'reviewed_by',
      width: 120,
      ellipsis: true,
      render: (_, record) => record.reviewer_display_name || record.reviewed_by || '-',
    },
    {
      title: '审核时间',
      dataIndex: 'reviewed_at',
      key: 'reviewed_at',
      width: 150,
      render: (val) => formatReviewedAt(val),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      align: 'center',
      render: (_, record) => reviewActions(record),
    },
  ];

  const batchButtons = selectedRowKeys.length > 0 ? [
    <Popconfirm key="pass" title={`审核通过选中的 ${selectedRowKeys.length} 张照片？`} onConfirm={() => handleBatchReview(1)}>
      <Button type="primary" icon={<CheckOutlined />} loading={batchLoading}>
        {mobile ? `通过 (${selectedRowKeys.length})` : `批量通过 (${selectedRowKeys.length})`}
      </Button>
    </Popconfirm>,
    <Popconfirm key="reject" title={`审核失败选中的 ${selectedRowKeys.length} 张照片？`} onConfirm={() => handleBatchReview(2)}>
      <Button danger icon={<CloseOutlined />} loading={batchLoading}>
        {mobile ? `失败 (${selectedRowKeys.length})` : `批量失败 (${selectedRowKeys.length})`}
      </Button>
    </Popconfirm>,
  ] : [];

  return (
    <div className={`${styles.container} ${styles.listPage}`}>
      <div className={styles.header}>
        <h2 className={styles.title}>审核管理</h2>
        <Space wrap className={styles.headerActions}>
          {batchButtons}
          {!mobile && (
            <Select
              value={statusFilter}
              onChange={handleFilter}
              placeholder="状态筛选"
              allowClear
              style={{ width: 130 }}
              options={reviewStatuses.map((s) => ({ value: parseInt(s.value), label: s.label }))}
            />
          )}
          {!mobile && <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>}
        </Space>
      </div>

      {mobile ? (
        <div className={styles.searchBar}>
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <Select
              value={statusFilter}
              onChange={handleFilter}
              placeholder="状态筛选"
              allowClear
              style={{ width: '100%' }}
              options={reviewStatuses.map((s) => ({ value: parseInt(s.value), label: s.label }))}
            />
            <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
          </Space>
        </div>
      ) : null}

      {mobile ? (
        <Spin spinning={loading}>
          <div className={styles.cardList}>
            {photos.map((record) => (
              <div className={styles.card} key={record.id}>
                <div className={styles.cardRow}>
                  <Checkbox
                    checked={selectedRowKeys.includes(record.id)}
                    onChange={() => toggleSelect(record.id)}
                  />
                  <img
                    src={getThumbnailUrl(record)}
                    alt={record.title}
                    className={styles.cardThumb}
                    onClick={() => handleView(record)}
                  />
                  <div className={styles.cardBody}>
                    <h3 className={styles.cardTitle}>{record.title || '未命名'}</h3>
                    <div className={styles.cardMeta}>
                      {record.uploader_display_name || record.uploaded_by || '未知上传者'}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <Tag color={getColor('review_status', record.review_status)}>
                        {getLabel('review_status', record.review_status)}
                      </Tag>
                    </div>
                    {(record.reviewed_by || record.reviewed_at) && (
                      <div className={styles.cardMeta} style={{ marginTop: 6 }}>
                        {record.reviewer_display_name || record.reviewed_by || '-'}
                        {record.reviewed_at ? ` · ${formatReviewedAt(record.reviewed_at)}` : ''}
                      </div>
                    )}
                  </div>
                </div>
                <div className={styles.cardActions}>{reviewActions(record)}</div>
              </div>
            ))}
            {!loading && !photos.length ? <div className={styles.cardMeta}>暂无待审照片</div> : null}
          </div>
          <Pagination
            className={styles.mobilePager}
            current={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            simple
            onChange={(page, pageSize) => loadPhotos(page, pageSize, statusFilter)}
          />
        </Spin>
      ) : (
        <div className={styles.tableWrap}>
          <ListTable
            columns={columns}
            dataSource={photos}
            loading={loading}
            rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
            pagination={{
              current: pagination.page,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 张`,
              onChange: (page, pageSize) => loadPhotos(page, pageSize, statusFilter),
            }}
            scroll={{ x: 1100, y: 'calc(100vh - 200px)' }}
          />
        </div>
      )}
    </div>
  );
}
