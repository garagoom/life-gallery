import { useState, useEffect } from 'react';
import { Form, Input, Button, message, Card, Avatar, Divider, Tabs, Typography, Radio, Upload } from 'antd';
import { UserOutlined, LockOutlined, SaveOutlined, CameraOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { uploadAvatar } from '../api/auth';
import AvatarCropper from './AvatarCropper';
import styles from './Admin.module.css';

const { Text } = Typography;

const GENDER_LABELS = { male: '男', female: '女', secret: '保密' };

export default function Profile() {
  const { user, loginUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImage, setCropImage] = useState(null);

  useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({
        displayName: user.displayName || user.username,
        email: user.email || '',
        gender: user.gender || null,
        bio: user.bio || '',
      });
    }
  }, [user, profileForm]);

  const handleBeforeUpload = (file) => {
    if (file.size > 5 * 1024 * 1024) {
      message.error('图片不能超过 5MB');
      return false;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setCropImage(e.target.result);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
    return false;
  };

  const handleCropDone = async (file) => {
    setCropOpen(false);
    setCropImage(null);
    setAvatarLoading(true);
    try {
      const data = await uploadAvatar(file);
      loginUser({ ...user, avatar: data.avatar });
      message.success('头像上传成功');
    } catch (err) {
      message.error(err.message || '头像上传失败');
    }
    setAvatarLoading(false);
  };

  const handleCropCancel = () => {
    setCropOpen(false);
    setCropImage(null);
  };

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
          <Form.Item name="gender" label="性别">
            <Radio.Group>
              <Radio.Button value="male">男</Radio.Button>
              <Radio.Button value="female">女</Radio.Button>
              <Radio.Button value="secret">保密</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="bio" label="个人介绍">
            <Input.TextArea placeholder="介绍自己..." rows={3} maxLength={200} showCount />
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
          <Form.Item name="oldPassword" label="原密码" rules={[
            { required: true, message: '请输入原密码' },
            { min: 8, message: '密码至少8位' },
          ]}>
            <Input.Password prefix={<LockOutlined />} placeholder="输入原密码" />
          </Form.Item>
          <Form.Item name="newPassword" label="新密码" rules={[
            { required: true, message: '请输入新密码' },
            { min: 8, message: '密码至少8位' },
            { max: 20, message: '密码最多20位' },
          ]}>
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
          <Upload
            showUploadList={false}
            beforeUpload={handleBeforeUpload}
            accept="image/*"
          >
            <div style={{ position: 'relative', cursor: 'pointer' }}>
              <Avatar
                size={64}
                src={user?.avatar}
                icon={<UserOutlined />}
                style={{ backgroundColor: 'var(--accent)' }}
              />
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 24, height: 24, borderRadius: '50%',
                background: 'var(--accent)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                border: '2px solid var(--bg-secondary)',
              }}>
                <CameraOutlined style={{ color: '#fff', fontSize: 12 }} />
              </div>
            </div>
          </Upload>
          <div style={{ marginLeft: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 500 }}>{user?.displayName || user?.username}</div>
            <Text type="secondary">{roleLabels[user?.role] || user?.role}</Text>
            {user?.gender && user.gender !== 'secret' && (
              <Text type="secondary" style={{ marginLeft: 8 }}>· {GENDER_LABELS[user.gender]}</Text>
            )}
          </div>
          {avatarLoading && <Text type="secondary" style={{ marginLeft: 12 }}>上传中...</Text>}
        </div>
        {user?.bio && (
          <div style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 14 }}>
            {user.bio}
          </div>
        )}
        <Divider />
        <Tabs items={tabItems} />
      </Card>
      <AvatarCropper
        open={cropOpen}
        imageSrc={cropImage}
        onCrop={handleCropDone}
        onCancel={handleCropCancel}
      />
    </div>
  );
}
