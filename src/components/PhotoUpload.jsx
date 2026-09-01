import { useState } from 'react';
import { Modal, Form, Input, Select, Slider, Upload, Button, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { uploadPhoto } from '../api/photos';
import styles from './PhotoUpload.module.css';

export default function PhotoUpload({ open, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleUpload = async () => {
    try {
      const values = await form.validateFields();
      if (!selectedFile) {
        message.error('请选择一张图片');
        return;
      }

      setLoading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', values.title || '未命名');
      formData.append('date', values.date || '');
      formData.append('category', values.category || 'landscape');
      formData.append('rotation', values.rotation || 0);

      await uploadPhoto(formData);
      message.success('上传成功');
      form.resetFields();
      setSelectedFile(null);
      setPreview(null);
      onClose();
      onSuccess?.();
    } catch (error) {
      if (error.errorFields) return;
      message.error('上传失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setSelectedFile(null);
    setPreview(null);
    onClose();
  };

  const uploadProps = {
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('只能上传图片文件！');
        return false;
      }
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(file);
      setSelectedFile(file);
      return false;
    },
    showUploadList: false,
  };

  return (
    <Modal
      title="上传照片"
      open={open}
      onOk={handleUpload}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText="上传"
      cancelText="取消"
      width={480}
      styles={{
        header: { borderBottom: 'none' },
        content: { borderRadius: 12, overflow: 'hidden' },
      }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ category: 'landscape', rotation: 0 }}
        style={{ marginTop: 24 }}
      >
        <Form.Item>
          <Upload.Dragger {...uploadProps}>
            {preview ? (
              <img 
                src={preview} 
                alt="预览" 
                style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }} 
              />
            ) : (
              <div style={{ padding: '20px 0' }}>
                <p style={{ fontSize: 40, color: '#8b7355', marginBottom: 8 }}>
                  <UploadOutlined />
                </p>
                <p style={{ color: '#4a4a4a' }}>点击或拖拽图片到此处上传</p>
                <p style={{ color: '#8b7355', fontSize: 13 }}>支持 JPEG、PNG、WebP 格式</p>
              </div>
            )}
          </Upload.Dragger>
        </Form.Item>

        <Form.Item name="title" label="标题">
          <Input placeholder="输入照片标题" />
        </Form.Item>

        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item name="date" label="日期" style={{ flex: 1 }}>
            <Input type="date" />
          </Form.Item>

          <Form.Item name="category" label="分类" style={{ flex: 1 }}>
            <Select>
              <Select.Option value="landscape">风光</Select.Option>
              <Select.Option value="portrait">人像</Select.Option>
              <Select.Option value="street">街拍</Select.Option>
            </Select>
          </Form.Item>
        </div>

        <Form.Item name="rotation" label="旋转角度">
          <Slider min={-3} max={3} step={0.5} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
