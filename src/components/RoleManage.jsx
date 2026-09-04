import { useState, useEffect } from 'react';
import { Button, Modal, Form, Input, InputNumber, Switch, Space, message, Popconfirm, Tree, Empty } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useDict } from '../contexts/DictContext';
import { getAllMenus } from '../api/menus';
import { getRoles, getRole, createRole, updateRole, deleteRole } from '../api/roles';
import ListTable from './ListTable';
import styles from './Admin.module.css';

export default function RoleManage() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const { getDict } = useDict();
  const roles_dict = getDict('role');
  const [menuTree, setMenuTree] = useState([]);
  const [checkedKeys, setCheckedKeys] = useState([]);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const data = await getRoles();
      if (data.code === 200) {
        setRoles([...(data.data || [])]);
      }
    } catch (err) {
      message.error(err.message || '获取角色列表失败');
    }
    setLoading(false);
  };

  const fetchMenuTree = async () => {
    try {
      const data = await getAllMenus();
      if (data.code === 200) setMenuTree(data.data);
    } catch (err) {
      message.error(err.message || '获取菜单列表失败');
    }
  };

  const fetchRolePermissions = async (roleId) => {
    try {
      const data = await getRole(roleId);
      if (data.code === 200 && data.data.permissions) {
        setCheckedKeys(data.data.permissions.map(p => p.id));
      }
    } catch (err) {
      message.error(err.message || '获取角色权限失败');
    }
  };

  useEffect(() => { fetchRoles(); }, []);

  const buildTreeData = (items) => {
    return items.map(item => ({
      title: `${item.label} (${item.type === 'module' ? '模块' : item.type === 'button' ? '按钮' : '菜单'})`,
      key: item.id,
      children: item.children ? buildTreeData(item.children) : [],
    }));
  };

  const handleAdd = async () => {
    setEditingRole(null);
    form.resetFields();
    setCheckedKeys([]);
    await fetchMenuTree();
    setModalVisible(true);
  };

  const handleEdit = async (record) => {
    setEditingRole(record);
    form.setFieldsValue(record);
    await Promise.all([fetchMenuTree(), fetchRolePermissions(record.id)]);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteRole(id);
      message.success('删除成功');
      fetchRoles();
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
      const payload = { ...values, permissions: checkedKeys };
      if (editingRole) {
        await updateRole(editingRole.id, payload);
      } else {
        await createRole(payload);
      }
      message.success(editingRole ? '更新成功' : '创建成功');
      setModalVisible(false);
      fetchRoles();
    } catch (err) {
      if (!err.errorFields) message.error(err.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
      align: 'center',
    },
    {
      title: '角色',
      dataIndex: 'label',
      key: 'label',
      width: 140,
    },
    {
      title: '标识',
      dataIndex: 'name',
      key: 'name',
      width: 140,
      render: (v) => <span style={{ color: 'var(--text-secondary)' }}>{v}</span>,
    },
    {
      title: '用户数',
      dataIndex: 'user_count',
      key: 'user_count',
      width: 88,
      align: 'center',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 88,
      align: 'center',
      render: (val) => <Switch checked={val === 1} disabled size="small" />,
    },
    {
      title: '操作',
      key: 'action',
      width: 108,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined style={{ color: 'var(--accent)' }} />} onClick={() => handleEdit(record)} />
          {record.name !== 'admin' && (
            <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)} okButtonProps={{ loading: deletingId === record.id }}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const treeData = buildTreeData(menuTree);
  const isAdminRole = editingRole?.name === 'admin';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>角色管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建角色</Button>
      </div>
      <div className={styles.tableWrap}>
        <ListTable columns={columns} dataSource={roles} loading={loading} pagination={false} scroll={{ x: 720, y: 'calc(100vh - 160px)' }} />
      </div>

      <Modal
        title={editingRole ? '编辑角色' : '新建角色'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="确定"
        cancelText="取消"
        confirmLoading={submitting}
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item name="name" label="角色名" rules={[{ required: true, message: '请输入角色名' }]}>
            <Input disabled={isAdminRole} placeholder="输入角色名" />
          </Form.Item>
          <Form.Item name="label" label="标签" rules={[{ required: true, message: '请输入标签' }]}>
            <Input placeholder="输入标签" />
          </Form.Item>
          <Form.Item name="level" label="等级" initialValue={1}>
            <InputNumber min={1} max={3} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="菜单权限">
            {treeData.length > 0 ? (
              <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, padding: 8, maxHeight: 300, overflow: 'auto' }}>
                <Tree
                  checkable
                  checkStrictly
                  checkedKeys={checkedKeys}
                  onCheck={(checked) => {
                    const keys = Array.isArray(checked) ? checked : checked.checked;
                    setCheckedKeys(keys);
                  }}
                  treeData={treeData}
                  defaultExpandAll
                />
              </div>
            ) : (
              <Empty description="暂无菜单数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}