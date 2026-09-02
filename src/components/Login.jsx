import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { login } from '../api/auth';
import { useAuth } from '../contexts/AuthContext';
import { useImagePreloader } from '../data/preloader';
import styles from './Login.module.css';

const { Text } = Typography;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { loginUser } = useAuth();

  // Start preloading images in background while user is on login page
  useImagePreloader();

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const data = await login(values.username, values.password);
      loginUser(data.user);
      message.success('登录成功');
      navigate('/loading', { replace: true });
    } catch (error) {
      message.error(error.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.logo}>PHOTO PORTFOLIO</h1>
          <p className={styles.subtitle}>管理系统登录</p>
        </div>
        
        <Form onFinish={handleSubmit} size="large">
          <Form.Item 
            name="username" 
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' },
              { max: 20, message: '用户名最多20个字符' },
              { pattern: /^[a-zA-Z0-9]+$/, message: '只允许英文和数字' },
            ]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="用户名" 
              autoComplete="username"
            />
          </Form.Item>
          
          <Form.Item 
            name="password" 
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="密码" 
              autoComplete="current-password"
            />
          </Form.Item>
          
          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              block
            >
              登录
            </Button>
          </Form.Item>
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary">没有账号？</Text> <Link to="/register">去注册</Link>
          </div>
        </Form>
      </div>
    </div>
  );
}
