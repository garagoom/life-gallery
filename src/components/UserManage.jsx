import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Switch, Space, Popconfirm, Tag, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getUsers, createUser, updateUser, updateUserStatus, deleteUser } from '../api/users';
import { useAuth } from '../contexts/AuthContext';
import styles from './Admin.module.css';

export default function UserManage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();
  const { user: currentUser } = useAuth();

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
    });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await deleteUser(id);
      message.success('删除成功');
      loadUsers();
    } catch (error) {
      message.error(error.message || '删除失败');
    }
  };

  const handleStatusChange = async (id, checked) => {
    try {
      await updateUserStatus(id, checked ? 1 : 0);
      message.success(checked ? '已启用' : '已禁用');
      loadUsers();
    } catch (error) {
      message.error(error.message || '操作失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingUser) {
        await updateUser(editingUser.id, {
          displayName: values.displayName,
          email: values.email,
          role: values.role,
        });
        message.success('更新成功');
      } else {
        await createUser({
          username: values.username,
          password: values.password,
          displayName: values.displayName,
          email: values.email,
          role: values.role,
        });
        message.success('创建成功');
      }
      
      setModalOpen(false);
      loadUsers();
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.message || '操作失败');
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
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '显示名称',
      dataIndex: 'display_name',
      key: 'display_name',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      render: (text) => text || '-',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag color={roleColors[role]}>{roleLabels[role]}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => (
        <Switch
          checked={status === 1}
          onChange={(checked) => handleStatusChange(record.id, checked)}
          disabled={record.id === currentUser?.id}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          {record.id !== currentUser?.id && (
            <Popconfirm
              title="确定删除此用户？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" danger icon={<DeleteOutlined />} />
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
      />

      <Modal
        title={editingUser ? '编辑用户' : '添加用户'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="确定"
        cancelText="取消"
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
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input placeholder="输入用户名" />
              </Form.Item>
              
              <Form.Item 
                name="password" 
                label="密码" 
                rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '至少6位' }]}
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
