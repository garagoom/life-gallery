import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Form, Input, Button, message, Typography, Modal, Alert } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { login } from '../api/auth';
import { consumeAuthNotice } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useImagePreloader } from '../data/preloader';
import styles from './Login.module.css';

const { Text } = Typography;

const NOTICE_TEXT = {
  kicked: '账号已在其他设备登录，请重新登录',
  expired: '登录已过期，请重新登录',
};

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginUser } = useAuth();

  useImagePreloader();

  useEffect(() => {
    const applyNotice = (value) => {
      if (value === 'kicked' || value === 'expired') setNotice(value);
    };
    const fromQuery = searchParams.get('notice');
    applyNotice(fromQuery === 'kicked' || fromQuery === 'expired' ? fromQuery : consumeAuthNotice());

    const onNotice = (event) => {
      applyNotice(event.detail || consumeAuthNotice());
    };
    window.addEventListener('auth-notice', onNotice);
    return () => window.removeEventListener('auth-notice', onNotice);
  }, [searchParams]);

  const doLogin = async (username, password, force = false) => {
    const result = await login(username, password, force);

    // 409: session conflict
    if (result?.code === 409) {
      Modal.confirm({
        title: '账号已在其他设备登录',
        content: '是否踢出对方并在此设备登录？',
        okText: '确认登录',
        cancelText: '取消',
        onOk: () => doLogin(username, password, true),
      });
      return;
    }

    loginUser(result.user);
    setNotice(null);
    message.success(result.user?.mustChangePassword ? '请先修改初始密码' : '登录成功');
    navigate(result.user?.mustChangePassword ? '/photography/profile' : '/loading', { replace: true });
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      await doLogin(values.username.trim(), values.password.trim());
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
        {notice && (
          <Alert
            type={notice === 'kicked' ? 'warning' : 'info'}
            showIcon
            message={NOTICE_TEXT[notice]}
            style={{ marginBottom: 20 }}
          />
        )}
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
