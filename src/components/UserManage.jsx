import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Switch, Space, Popconfirm, Tag, Avatar, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import { getUsers, createUser, updateUser, updateUserStatus, deleteUser } from '../api/users';
import { useAuth } from '../contexts/AuthContext';
import styles from './Admin.module.css';

const GENDER_LABELS = { male: '男', female: '女', secret: '保密' };

export default function UserManage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();
  const { user: currentUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [statusLoadingId, setStatusLoadingId] = useState(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (error) {
      message.error(error.message || '加载用户失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAdd = () => {
    setEditingUser(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record) => {
    setEditingUser(record);
    form.setFieldsValue({
      username: record.username,
      displayName: record.display_name,
      email: record.email,
      role: record.role,
      gender: record.gender,
      bio: record.bio,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteUser(id);
      message.success('删除成功');
      loadUsers();
    } catch (error) {
      message.error(error.message || '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  const handleStatusChange = async (id, checked) => {
    setStatusLoadingId(id);
    try {
      await updateUserStatus(id, checked ? 1 : 0);
      message.success(checked ? '已启用' : '已禁用');
      loadUsers();
    } catch (error) {
      message.error(error.message || '操作失败');
    } finally {
      setStatusLoadingId(null);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      
      if (editingUser) {
        await updateUser(editingUser.id, {
          displayName: values.displayName,
          email: values.email,
          role: values.role,
          gender: values.gender,
          bio: values.bio,
        });
        message.success('更新成功');
      } else {
        await createUser({
          username: values.username,
          password: values.password,
          displayName: values.displayName,
          email: values.email,
          role: values.role,
          gender: values.gender,
          bio: values.bio,
        });
        message.success('创建成功');
      }
      
      setModalOpen(false);
      loadUsers();
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const roleColors = {
    admin: 'red',
    editor: 'blue',
    viewer: 'default'
  };

  const roleLabels = {
    admin: '管理员',
    editor: '编辑者',
    viewer: '查看者'
  };

  const columns = [
    {
      title: '用户',
      key: 'user',
      fixed: 'left',
      width: 200,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar src={record.avatar} icon={<UserOutlined />} size={36} />
          <div>
            <div style={{ fontWeight: 500 }}>{record.display_name || record.username}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>@{record.username}</div>
          </div>
        </div>
      ),
    },
    {
      title: '性别',
      dataIndex: 'gender',
      key: 'gender',
      width: 80,
      align: 'center',
      render: (g) => g ? GENDER_LABELS[g] : '-',
    },
    {
      title: '简介',
      dataIndex: 'bio',
      key: 'bio',
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      align: 'center',
      render: (role) => (
        <Tag color={roleColors[role]}>{roleLabels[role]}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center',
      render: (status, record) => (
        <Switch
          checked={status === 1}
          onChange={(checked) => handleStatusChange(record.id, checked)}
          disabled={record.id === currentUser?.id || statusLoadingId === record.id}
          loading={statusLoadingId === record.id}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined style={{ color: 'var(--accent)' }} />}
            onClick={() => handleEdit(record)}
          />
          {record.id !== currentUser?.id && (
            <Popconfirm
              title="确定删除此用户？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
              okButtonProps={{ loading: deletingId === record.id }}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>用户管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加用户
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={false}
        scroll={{ x: 900 }}
      />

      <Modal
        title={editingUser ? '编辑用户' : '添加用户'}
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
          initialValues={{ role: 'viewer' }}
          style={{ marginTop: 24 }}
        >
          {!editingUser && (
            <>
              <Form.Item 
                name="username" 
                label="用户名" 
                rules={[
                  { required: true, message: '请输入用户名' },
                  { min: 3, message: '用户名至少3个字符' },
                  { max: 20, message: '用户名最多20个字符' },
                  { pattern: /^[a-zA-Z0-9]+$/, message: '只允许英文和数字' },
                ]}
              >
                <Input placeholder="输入用户名" />
              </Form.Item>
              
              <Form.Item 
                name="password" 
                label="密码" 
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 8, message: '密码至少8位' },
                  { max: 20, message: '密码最多20位' },
                ]}
              >
                <Input.Password placeholder="输入密码" />
              </Form.Item>
            </>
          )}
          
          <Form.Item name="displayName" label="显示名称">
            <Input placeholder="输入显示名称" />
          </Form.Item>
          
          <Form.Item name="email" label="邮箱">
            <Input placeholder="输入邮箱" />
          </Form.Item>

          <Form.Item name="gender" label="性别">
            <Select allowClear placeholder="选择性别">
              <Select.Option value="male">男</Select.Option>
              <Select.Option value="female">女</Select.Option>
              <Select.Option value="secret">保密</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="bio" label="个人介绍">
            <Input.TextArea placeholder="输入个人介绍" rows={2} maxLength={200} showCount />
          </Form.Item>
          
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="admin">管理员</Select.Option>
              <Select.Option value="editor">编辑者</Select.Option>
              <Select.Option value="viewer">查看者</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
