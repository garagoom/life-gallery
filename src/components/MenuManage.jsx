import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Switch, Space, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import styles from './Admin.module.css';

export default function MenuManage() {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMenu, setEditingMenu] = useState(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  });

  const fetchMenus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/menus', {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.code === 200) {
        setMenus(data.data);
      }
    } catch (err) {
      message.error('获取菜单列表失败');
    }
    setLoading(false);
  };

  useEffect(() => { fetchMenus(); }, []);

  const handleAdd = (parentId = null) => {
    setEditingMenu(null);
    form.resetFields();
    if (parentId) form.setFieldsValue({ parent_id: parentId });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingMenu(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/menus/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.code === 200) {
        message.success('删除成功');
        fetchMenus();
      } else {
        message.error(data.message);
      }
    } catch (err) {
      message.error('删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      const url = editingMenu ? `/api/menus/${editingMenu.id}` : '/api/menus';
      const method = editingMenu ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });
      const data = await res.json();
      if (data.code === 200) {
        message.success(editingMenu ? '更新成功' : '创建成功');
        setModalVisible(false);
        fetchMenus();
      } else {
        message.error(data.message);
      }
    } catch (err) {
      message.error('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      width: 150,
    },
    {
      title: '标签',
      dataIndex: 'label',
      key: 'label',
      width: 150,
    },
    {
      title: '图标',
      dataIndex: 'icon',
      key: 'icon',
      width: 120,
      render: (text) => text || '-',
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 70,
      align: 'center',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      align: 'center',
      render: (val) => <Switch checked={val === 1} disabled size="small" />,
    },
    {
      title: '操作',
      key: 'action',
      width: 130,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<PlusOutlined style={{ color: 'var(--accent)' }} />} onClick={() => handleAdd(record.id)} title="添加子菜单" />
          <Button type="link" size="small" icon={<EditOutlined style={{ color: 'var(--accent)' }} />} onClick={() => handleEdit(record)} />
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)} okButtonProps={{ loading: deletingId === record.id }}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>菜单管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAdd()}>新建菜单</Button>
      </div>
      <div className={styles.tableWrap}>
        <Table
          columns={columns}
          dataSource={menus}
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 800 }}
          childrenColumnName="children"
          expandable={{ defaultExpandAllRows: true }}
        />
      </div>

      <Modal
        title={editingMenu ? '编辑菜单' : '新建菜单'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="确定"
        cancelText="取消"
        confirmLoading={submitting}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item name="parent_id" label="上级菜单">
            <Select allowClear placeholder="无（顶级菜单）">
              {menus.map(m => (
                <Select.Option key={m.id} value={m.id}>{m.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="key" label="Key" rules={[{ required: true, message: '请输入Key' }]}>
            <Input placeholder="输入Key" />
          </Form.Item>
          <Form.Item name="label" label="标签" rules={[{ required: true, message: '请输入标签' }]}>
            <Input placeholder="输入标签" />
          </Form.Item>
          <Form.Item name="icon" label="图标">
            <Input placeholder="输入图标名" />
          </Form.Item>
          <Form.Item name="path" label="路径">
            <Input placeholder="输入路径" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}