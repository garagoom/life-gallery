import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Modal, Form, Input, Select, Upload, Image, Space, Popconfirm, message, Progress, DatePicker, ConfigProvider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, FolderOpenOutlined, SearchOutlined, ReloadOutlined, TeamOutlined } from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import { getPhotos, uploadPhoto, batchUploadPhotos, updatePhoto, deletePhoto, batchDeletePhotos } from '../api/photos';
import { getPhotoUrl, getThumbnailUrl } from '../data/photos';
import { useAuth } from '../contexts/AuthContext';
import { useDict } from '../contexts/DictContext';
import styles from './Admin.module.css';

export default function Admin() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { getColor, getLabel } = useDict();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState(null);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [batchFiles, setBatchFiles] = useState([]);
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [autoDate, setAutoDate] = useState(null);
  
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0
  });
  const [searchParams, setSearchParams] = useState({});
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const loadPhotos = async (page = 1, pageSize = 10, search = {}) => {
    setLoading(true);
    try {
      const result = await getPhotos({ page, pageSize, ...search });
      setPhotos(result.data);
      setPagination(result.pagination);
    } catch (error) {
      message.error(error.message || '加载照片失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPhotos();
  }, []);

  const handleSearch = (values) => {
    const params = {};
    if (values.title) params.title = values.title;
    if (values.dateRange && values.dateRange[0]) {
      params.dateFrom = values.dateRange[0].format('YYYY-MM-DD');
    }
    if (values.dateRange && values.dateRange[1]) {
      params.dateTo = values.dateRange[1].format('YYYY-MM-DD');
    }
    setSearchParams(params);
    loadPhotos(1, pagination.pageSize, params);
  };

  const handleResetSearch = () => {
    searchForm.resetFields();
    setSearchParams({});
    loadPhotos(1, pagination.pageSize, {});
  };

  const handleTableChange = (newPagination) => {
    loadPhotos(newPagination.current, newPagination.pageSize, searchParams);
  };

  const handleAdd = () => {
    setEditingPhoto(null);
    form.resetFields();
    setSelectedFile(null);
    setPreview(null);
    setAutoDate(null);
    setModalOpen(true);
  };

  const handleBatchUpload = () => {
    setBatchFiles([]);
    setBatchProgress(0);
    setBatchModalOpen(true);
  };

  const handleEdit = (record) => {
    setEditingPhoto(record);
    form.setFieldsValue({
      title: record.title,
      date: record.date ? dayjs(record.date) : null,
    });
    setPreview(getPhotoUrl(record));
    setSelectedFile(null);
    setAutoDate(null);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deletePhoto(id);
      message.success('删除成功');
      loadPhotos(pagination.page, pagination.pageSize, searchParams);
    } catch (error) {
      message.error(error.message || '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的照片');
      return;
    }
    setBatchDeleting(true);
    try {
      await batchDeletePhotos(selectedRowKeys);
      message.success(`成功删除 ${selectedRowKeys.length} 张照片`);
      setSelectedRowKeys([]);
      loadPhotos(pagination.page, pagination.pageSize, searchParams);
    } catch (error) {
      message.error(error.message || '批量删除失败');
    } finally {
      setBatchDeleting(false);
    }
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
    
    // Auto-fill title from filename
    const fileName = file.name.replace(/\.[^/.]+$/, '');
    if (!form.getFieldValue('title')) {
      form.setFieldValue('title', fileName);
    }
    
    // Auto-fill date from file modification time
    if (!form.getFieldValue('date')) {
      const fileDate = new Date(file.lastModified);
      setAutoDate(dayjs(fileDate));
      form.setFieldValue('date', dayjs(fileDate));
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      
      if (!editingPhoto && !selectedFile) {
        message.error('请选择一张图片');
        return;
      }

      if (editingPhoto) {
        await updatePhoto(editingPhoto.id, {
          title: values.title,
          date: values.date ? values.date.format('YYYY-MM-DD') : null,
        });
        message.success('更新成功');
      } else {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('title', values.title || '未命名');
        formData.append('date', values.date ? values.date.format('YYYY-MM-DD') : '');
        await uploadPhoto(formData);
        message.success('上传成功');
      }

      setModalOpen(false);
      loadPhotos(pagination.page, pagination.pageSize, searchParams);
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBatchSubmit = async () => {
    if (batchFiles.length === 0) {
      message.error('请选择要上传的文件');
      return;
    }

    setBatchUploading(true);
    setBatchProgress(0);

    try {
      const formData = new FormData();
      batchFiles.forEach(file => {
        formData.append('files', file);
      });

      const result = await batchUploadPhotos(formData);
      message.success(result.message || `成功上传 ${batchFiles.length} 张照片`);
      setBatchModalOpen(false);
      loadPhotos(1, pagination.pageSize, searchParams);
    } catch (error) {
      message.error(error.message || '批量上传失败');
    } finally {
      setBatchUploading(false);
      setBatchProgress(0);
    }
  };

  const columns = [
    {
      title: '照片',
      dataIndex: 'thumbnail',
      key: 'thumbnail',
      width: 80,
      render: (_, record) => (
        <Image
          src={getThumbnailUrl(record)}
          width={60}
          height={60}
          style={{ objectFit: 'cover', borderRadius: 4 }}
          preview={false}
        />
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 100,
    },
    {
      title: '相机',
      key: 'camera',
      width: 150,
      render: (_, record) => {
        if (record.camera_make || record.camera_model) {
          return record.camera_model || record.camera_make || '';
        }
        return '-';
      },
    },
    {
      title: '参数',
      key: 'settings',
      width: 180,
      render: (_, record) => {
        const parts = [];
        if (record.f_number) parts.push(record.f_number);
        if (record.exposure_time) parts.push(record.exposure_time);
        if (record.iso) parts.push(record.iso);
        if (record.focal_length) parts.push(record.focal_length);
        return parts.length > 0 ? parts.join(' | ') : '-';
      },
    },
    {
      title: '审核',
      key: 'review_status',
      width: 80,
      render: (_, record) => {
        const colorMap = { orange: '#fa8c16', green: '#52c41a', red: '#ff4d4f' };
        const color = getColor('review_status', record.review_status);
        return <span style={{ color: colorMap[color] || undefined, fontWeight: 500 }}>{getLabel('review_status', record.review_status)}</span>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="确定删除这张照片？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
            okButtonProps={{ loading: deletingId === record.id }}
          >
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ConfigProvider locale={zhCN}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>照片管理</h2>
          <Space>
            {hasRole('module_admin') && (
              <Button icon={<TeamOutlined />} onClick={() => navigate('/photography/admin/review')}>
                审核管理
              </Button>
            )}
            {selectedRowKeys.length > 0 && (
              <Popconfirm
                title={`确定删除选中的 ${selectedRowKeys.length} 张照片？`}
                onConfirm={handleBatchDelete}
                okText="确定"
                cancelText="取消"
                okType="danger"
                okButtonProps={{ loading: batchDeleting }}
              >
                <Button danger icon={<DeleteOutlined />}>
                  批量删除 ({selectedRowKeys.length})
                </Button>
              </Popconfirm>
            )}
            <Button icon={<FolderOpenOutlined />} onClick={handleBatchUpload}>
              批量上传
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              添加照片
            </Button>
          </Space>
        </div>

        {/* Search Filters */}
        <div className={styles.searchBar}>
          <Form
            form={searchForm}
            layout="inline"
            onFinish={handleSearch}
            style={{ flexWrap: 'wrap', gap: '8px' }}
          >
            <Form.Item name="title" style={{ marginBottom: 0 }}>
              <Input 
                placeholder="搜索标题" 
                style={{ width: 150 }}
                allowClear
              />
            </Form.Item>
            <Form.Item name="dateRange" style={{ marginBottom: 0 }}>
              <DatePicker.RangePicker style={{ width: 240 }} />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                  搜索
                </Button>
                <Button icon={<ReloadOutlined />} onClick={handleResetSearch}>
                  重置
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </div>

        <div className={styles.tableWrap}>
          <Table
            columns={columns}
            dataSource={photos}
            rowKey="id"
            loading={loading}
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
            }}
            pagination={{
              current: pagination.page,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 张照片`,
              pageSizeOptions: ['10', '20', '50'],
              sizeChangerText: '条/页',
              quickGoText: '跳至',
              itemRender: (current, type, originalElement) => {
                if (type === 'prev') return <a>上一页</a>;
                if (type === 'next') return <a>下一页</a>;
                return originalElement;
              },
            }}
            onChange={handleTableChange}
            scroll={{ x: 900 }}
          />
        </div>

        {/* Single Upload Modal */}
        <Modal
          title={editingPhoto ? '编辑照片' : '添加照片'}
          open={modalOpen}
          onOk={handleSubmit}
          onCancel={() => setModalOpen(false)}
          okText="确定"
          cancelText="取消"
          confirmLoading={submitting}
          width={480}
        >
          <Form
            form={form}
            layout="vertical"
            initialValues={{}}
            style={{ marginTop: 24 }}
          >
            {!editingPhoto && (
              <Form.Item>
                <div 
                  className={styles.uploadArea}
                  onClick={() => document.getElementById('single-file-input').click()}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add(styles.dragOver); }}
                  onDragLeave={(e) => e.currentTarget.classList.remove(styles.dragOver)}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove(styles.dragOver);
                    const file = e.dataTransfer.files[0];
                    if (file && file.type.startsWith('image/')) {
                      handleFileSelect(file);
                    }
                  }}
                >
                  <input
                    id="single-file-input"
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) handleFileSelect(file);
                    }}
                  />
                  {preview ? (
                    <img
                      src={preview}
                      alt="预览"
                      style={{ maxWidth: '100%', maxHeight: 150, borderRadius: 8 }}
                    />
                  ) : (
                    <>
                      <p style={{ fontSize: 36, color: '#8b7355', marginBottom: 8 }}>
                        <UploadOutlined />
                      </p>
                      <p style={{ color: '#4a4a4a' }}>点击或拖拽图片到此处</p>
                      <p style={{ color: '#8b7355', fontSize: 13 }}>支持 JPEG、PNG、WebP</p>
                    </>
                  )}
                </div>
              </Form.Item>
            )}

            {editingPhoto && (
              <Form.Item label="当前照片">
                <Image
                  src={getPhotoUrl(editingPhoto)}
                  width={200}
                  style={{ borderRadius: 8 }}
                />
              </Form.Item>
            )}

            <Form.Item name="title" label="标题">
              <Input placeholder="输入照片标题" />
            </Form.Item>

            <div style={{ display: 'flex', gap: 12 }}>
              <Form.Item name="date" label="日期" style={{ flex: 1 }}>
                <DatePicker style={{ width: '100%' }} placeholder="选择日期" />
              </Form.Item>
            </div>
          </Form>
        </Modal>

        {/* Batch Upload Modal */}
        <Modal
          title="批量上传照片"
          open={batchModalOpen}
          onOk={handleBatchSubmit}
          onCancel={() => setBatchModalOpen(false)}
          okText="开始上传"
          cancelText="取消"
          confirmLoading={batchUploading}
          width={520}
        >
          <div style={{ marginTop: 24 }}>
            <div 
              className={styles.batchUploadArea}
              onClick={() => document.getElementById('batch-file-input').click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add(styles.dragOver); }}
              onDragLeave={(e) => e.currentTarget.classList.remove(styles.dragOver)}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove(styles.dragOver);
                const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                setBatchFiles(prev => [...prev, ...files]);
              }}
            >
              <input
                id="batch-file-input"
                type="file"
                multiple
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const files = Array.from(e.target.files);
                  setBatchFiles(prev => [...prev, ...files]);
                  e.target.value = '';
                }}
              />
              <p style={{ fontSize: 36, color: '#8b7355', marginBottom: 8 }}>
                <FolderOpenOutlined />
              </p>
              <p style={{ color: '#4a4a4a' }}>点击选择文件夹或拖拽多张照片</p>
              <p style={{ color: '#8b7355', fontSize: 13 }}>
                支持 JPEG、PNG、WebP，可同时选择多张
              </p>
            </div>

            {batchFiles.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: 8 
                }}>
                  <span style={{ color: '#4a4a4a' }}>已选择 {batchFiles.length} 张照片</span>
                  <Button 
                    size="small" 
                    onClick={() => setBatchFiles([])}
                  >
                    清空
                  </Button>
                </div>
                <div style={{ 
                  maxHeight: 150, 
                  overflow: 'auto',
                  border: '1px solid #d4cdc1',
                  borderRadius: 8,
                  padding: 8
                }}>
                  {batchFiles.map((file, index) => (
                    <div key={index} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      padding: '4px 0',
                      borderBottom: index < batchFiles.length - 1 ? '1px solid #ebe5d9' : 'none'
                    }}>
                      <span style={{ color: '#4a4a4a', fontSize: 13 }}>{file.name}</span>
                      <Button 
                        type="link" 
                        size="small"
                        onClick={() => setBatchFiles(batchFiles.filter((_, i) => i !== index))}
                      >
                        移除
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {batchUploading && (
              <Progress percent={batchProgress} style={{ marginTop: 16 }} />
            )}
          </div>
        </Modal>
      </div>
    </ConfigProvider>
  );
}
