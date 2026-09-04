import { useState, useEffect } from 'react';
import { Button, Image, Space, Popconfirm, Tag, Select, message } from 'antd';
import { CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';
import { getReviewPhotos, reviewPhoto, batchReviewPhotos } from '../api/photos';
import { getThumbnailUrl } from '../data/photos';
import { useDict } from '../contexts/DictContext';
import ListTable from './ListTable';
import styles from './Admin.module.css';

export default function ReviewManage() {
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

  const handleReview = async (id, review_status) => {
    try {
      await reviewPhoto(id, review_status);
      message.success(review_status === 1 ? '已通过' : '已拒绝');
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
      message.success(review_status === 1 ? `已通过 ${selectedRowKeys.length} 张` : `已拒绝 ${selectedRowKeys.length} 张`);
      setSelectedRowKeys([]);
      loadPhotos(pagination.page, pagination.pageSize, statusFilter);
    } catch (err) {
      message.error(err.message || '批量操作失败');
    }
    setBatchLoading(false);
  };

  const columns = [
    {
      title: '照片',
      key: 'photo',
      width: 80,
      render: (_, record) => (
        <Image src={getThumbnailUrl(record)} width={60} height={60} style={{ objectFit: 'cover', borderRadius: 4 }} preview={false} />
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
      width: 180,
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
      title: '状态',
      dataIndex: 'review_status',
      key: 'review_status',
      width: 88,
      align: 'center',
      render: (val) => {
        return <Tag color={getColor('review_status', val)}>{getLabel('review_status', val)}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          {record.review_status !== 1 && (
            <Popconfirm title="通过审核？" onConfirm={() => handleReview(record.id, 1)} okText="确定" cancelText="取消">
              <Button type="link" size="small" icon={<CheckOutlined style={{ color: '#52c41a' }} />} />
            </Popconfirm>
          )}
          {record.review_status !== 2 && (
            <Popconfirm title="拒绝？" onConfirm={() => handleReview(record.id, 2)} okText="确定" cancelText="取消">
              <Button type="link" size="small" danger icon={<CloseOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>审核管理</h2>
        <Space>
          {selectedRowKeys.length > 0 && (
            <>
              <Popconfirm title={`通过选中的 ${selectedRowKeys.length} 张照片？`} onConfirm={() => handleBatchReview(1)}>
                <Button type="primary" icon={<CheckOutlined />} loading={batchLoading}>批量通过 ({selectedRowKeys.length})</Button>
              </Popconfirm>
              <Popconfirm title={`拒绝选中的 ${selectedRowKeys.length} 张照片？`} onConfirm={() => handleBatchReview(2)}>
                <Button danger icon={<CloseOutlined />} loading={batchLoading}>批量拒绝 ({selectedRowKeys.length})</Button>
              </Popconfirm>
            </>
          )}
          <Select
            value={statusFilter}
            onChange={handleFilter}
            placeholder="状态筛选"
            allowClear
            style={{ width: 130 }}
            options={reviewStatuses.map(s => ({ value: parseInt(s.value), label: s.label }))}
          />
          <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
        </Space>
      </div>

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
          scroll={{ x: 900, y: 'calc(100vh - 200px)' }}
        />
      </div>
    </div>
  );
}
