import { useState, useEffect } from 'react';
import { Form, Input, Button, message, Card, Avatar, Descriptions, Divider, Tabs, Typography } from 'antd';
import { UserOutlined, LockOutlined, SaveOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import styles from './Admin.module.css';

const { Text } = Typography;

export default function Profile() {
  const { user, loginUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();

  useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({
        displayName: user.displayName || user.username,
        email: user.email || '',
      });
    }
  }, [user, profileForm]);

  const handleUpdateProfile = async (values) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.code === 200) {
        message.success('个人信息更新成功');
        loginUser({ ...user, ...values });
      } else {
        message.error(data.message || '更新失败');
      }
    } catch (err) {
      message.error('网络错误');
    }
    setLoading(false);
  };

  const handleChangePassword = async (values) => {
    setPasswordLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oldPassword: values.oldPassword,
          newPassword: values.newPassword,
        }),
      });
      const data = await res.json();
      if (data.code === 200) {
        message.success('密码修改成功');
        passwordForm.resetFields();
      } else {
        message.error(data.message || '修改失败');
      }
    } catch (err) {
      message.error('网络错误');
    }
    setPasswordLoading(false);
  };

  const roleLabels = { admin: '管理员', editor: '编辑者', viewer: '查看者' };
  const roleColors = { admin: 'red', editor: 'blue', viewer: 'default' };

  const tabItems = [
    {
      key: 'info',
      label: '基本信息',
      children: (
        <Form form={profileForm} onFinish={handleUpdateProfile} layout="vertical" style={{ maxWidth: 400 }}>
          <Form.Item label="用户名">
            <Input value={user?.username} disabled prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item name="displayName" label="显示名称">
            <Input placeholder="输入显示名称" />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input placeholder="输入邮箱" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
              保存
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'password',
      label: '修改密码',
      children: (
        <Form form={passwordForm} onFinish={handleChangePassword} layout="vertical" style={{ maxWidth: 400 }}>
          <Form.Item name="oldPassword" label="原密码" rules={[{ required: true, message: '请输入原密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="输入原密码" />
          </Form.Item>
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '至少6位' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="输入新密码" />
          </Form.Item>
          <Form.Item name="confirmPassword" label="确认密码" dependencies={['newPassword']} rules={[
            { required: true, message: '请确认密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                return Promise.reject(new Error('两次密码不一致'));
              },
            }),
          ]}>
            <Input.Password prefix={<LockOutlined />} placeholder="确认新密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={passwordLoading} icon={<SaveOutlined />}>
              修改密码
            </Button>
          </Form.Item>
        </Form>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>个人信息</h2>
      </div>
      <Card style={{ maxWidth: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <Avatar size={64} icon={<UserOutlined />} style={{ backgroundColor: 'var(--accent)' }} />
          <div style={{ marginLeft: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 500 }}>{user?.displayName || user?.username}</div>
            <Text type="secondary">{roleLabels[user?.role] || user?.role}</Text>
          </div>
        </div>
        <Divider />
        <Tabs items={tabItems} />
      </Card>
    </div>
  );
}