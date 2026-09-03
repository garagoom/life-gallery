import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, message, Typography, Radio, Space } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, EditOutlined } from '@ant-design/icons';
import { useDict } from '../contexts/DictContext';
import styles from './Login.module.css';

const { Text } = Typography;

export default function Register() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { getDict } = useDict();

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.code === 200) {
        message.success('注册成功，请登录');
        navigate('/login');
      } else {
        message.error(data.message || '注册失败');
      }
    } catch (err) {
      message.error('网络错误');
    }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.logo}>PHOTO PORTFOLIO</h1>
          <p className={styles.subtitle}>创建新账号</p>
        </div>
        <Form form={form} onFinish={handleSubmit} size="large">
          <Form.Item name="username" rules={[
            { required: true, message: '请输入用户名' },
            { min: 3, message: '用户名至少3个字符' },
            { max: 20, message: '用户名最多20个字符' },
            { pattern: /^[a-zA-Z0-9]+$/, message: '只允许英文和数字' },
          ]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" autoComplete="username" />
          </Form.Item>
          <Form.Item name="displayName">
            <Input prefix={<UserOutlined />} placeholder="显示名称（选填）" />
          </Form.Item>
          <Form.Item name="email">
            <Input prefix={<MailOutlined />} placeholder="邮箱（选填）" />
          </Form.Item>
          <Form.Item name="gender" label="性别">
            <Radio.Group>
              {getDict('gender').map(g => (
                <Radio.Button key={g.value} value={g.value}>{g.label}</Radio.Button>
              ))}
            </Radio.Group>
          </Form.Item>
          <Form.Item name="role" label="身份" initialValue="creator">
            <Radio.Group>
              {getDict('role').filter(r => ['creator', 'viewer'].includes(r.value)).map(r => (
                <Radio.Button key={r.value} value={r.value}>{r.label}</Radio.Button>
              ))}
            </Radio.Group>
          </Form.Item>
          <Form.Item name="bio">
            <Input.TextArea prefix={<EditOutlined />} placeholder="个人介绍（选填）" rows={2} maxLength={200} showCount />
          </Form.Item>
          <Form.Item name="password" rules={[
            { required: true, message: '请输入密码' },
            { min: 8, message: '密码至少8位' },
            { max: 20, message: '密码最多20位' },
          ]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" autoComplete="new-password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              注册
            </Button>
          </Form.Item>
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary">已有账号？</Text> <Link to="/login">去登录</Link>
          </div>
        </Form>
      </div>
    </div>
  );
}
