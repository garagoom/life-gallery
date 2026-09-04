import { useState, useEffect } from 'react';
import { Button, Modal, Form, Input, InputNumber, Select, Space, message, Popconfirm, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getAllMenus, createMenu, updateMenu, deleteMenu } from '../api/menus';
import { useDict } from '../contexts/DictContext';
import { iconList, getIcon } from '../utils/icons';
import ListTable from './ListTable';
import styles from './Admin.module.css';

function toTableTree(nodes) {
  return (nodes || []).map((node) => {
    const { key, children, ...rest } = node;
    const item = { ...rest, menuKey: key };
    if (children?.length) item.children = toTableTree(children);
    return item;
  });
}

function collectExpandKeys(nodes, acc = []) {
  (nodes || []).forEach((node) => {
    if (node.children?.length) {
      acc.push(node.id);
      collectExpandKeys(node.children, acc);
    }
  });
  return acc;
}

function flattenMenus(nodes, acc = []) {
  (nodes || []).forEach((node) => {
    acc.push(node);
    if (node.children?.length) flattenMenus(node.children, acc);
  });
  return acc;
}

export default function MenuManage() {
  const [menus, setMenus] = useState([]);
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMenu, setEditingMenu] = useState(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const { getDict } = useDict();
  const menuTypeDict = getDict('menu_type');
  const visibleDict = getDict('visible');

  const fetchMenus = async () => {
    setLoading(true);
    try {
      const data = await getAllMenus();
      if (data.code === 200) {
        const tree = toTableTree(data.data);
        setMenus(tree);
        setExpandedKeys(collectExpandKeys(tree));
      }
    } catch (err) {
      message.error(err.message || '获取菜单列表失败');
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
    form.setFieldsValue({ ...record, key: record.menuKey });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteMenu(id);
      message.success('删除成功');
      await fetchMenus();
    } catch (err) {
      message.error(err.message || '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      if (editingMenu) {
        await updateMenu(editingMenu.id, values);
      } else {
        await createMenu(values);
      }
      message.success(editingMenu ? '更新成功' : '创建成功');
      setModalVisible(false);
      await fetchMenus();
    } catch (err) {
      if (!err.errorFields) message.error(err.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: 'Key',
      dataIndex: 'menuKey',
      key: 'menuKey',
      width: 180,
    },
    {
      title: '标签',
      dataIndex: 'label',
      key: 'label',
      width: 140,
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      align: 'center',
      render: (val) => {
        const item = menuTypeDict.find(d => d.value === val);
        return item ? <span style={{ color: `var(--${item.color})` }}>{item.label}</span> : val;
      },
    },
    {
      title: '可见',
      dataIndex: 'visible',
      key: 'visible',
      width: 72,
      align: 'center',
      render: (val) => {
        const item = visibleDict.find(d => d.value === String(val));
        return <Switch checked={val === 1} disabled size="small" />;
      },
    },
    {
      title: '图标',
      dataIndex: 'icon',
      key: 'icon',
      width: 72,
      align: 'center',
      render: (text) => {
        const icon = getIcon(text);
        return icon ? <span style={{ fontSize: 18, display: 'inline-flex' }}>{icon}</span> : '-';
      },
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      width: 220,
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 64,
      align: 'center',
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
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
        <ListTable
          columns={columns}
          dataSource={menus}
          loading={loading}
          pagination={false}
          scroll={{ x: 1000, y: 'calc(100vh - 160px)' }}
          childrenColumnName="children"
          expandable={{
            expandedRowKeys: expandedKeys,
            onExpandedRowsChange: setExpandedKeys,
          }}
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
              {flattenMenus(menus).map(m => (
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
          <Form.Item name="type" label="类型" initialValue="menu">
            <Select>
              {menuTypeDict.map(d => (
                <Select.Option key={d.value} value={d.value}>{d.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="visible" label="可见" initialValue={1}>
            <Select>
              {visibleDict.map(d => (
                <Select.Option key={d.value} value={Number(d.value)}>{d.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="icon" label="图标">
            <Select
              showSearch
              placeholder="选择图标"
              allowClear
              optionFilterProp="value"
            >
              {iconList.map((item) => (
                <Select.Option key={item.value} value={item.value}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {item.icon}
                    <span>{item.value}</span>
                  </span>
                </Select.Option>
              ))}
            </Select>
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