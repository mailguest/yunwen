import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Form, Input, Select, Switch, App as AntApp } from 'antd';
import { format, parse } from 'date-fns';
import { toast } from 'sonner';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import { User } from '@/types';

const { Option } = Select;

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();
  const [resetVisible, setResetVisible] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [resetForm] = Form.useForm();
  const { modal } = AntApp.useApp();
  const [roles, setRoles] = useState<Array<{ id: number; name: string }>>([]);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get<User[]>('/users');
      setUsers(response);
    } catch (error) {
      console.error('获取用户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get<{ success: boolean; items: Array<{ id: number; name: string }> }>(`/iam/roles`);
      setRoles(res.items);
    } catch (error) {
      // ignore
    }
  };

  const handleCreate = () => {
    setEditingUser(null);
    setModalVisible(true);
    if (!roles.length) fetchRoles();
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setModalVisible(true);
    if (!roles.length) fetchRoles();
  };

  const handleDelete = async (userId: string) => {
    modal.confirm({
      title: '确认删除',
      content: '确定要删除这个用户吗？此操作不可恢复。',
      onOk: async () => {
        try {
          await api.delete(`/users/${userId}`);
          toast.success('用户删除成功');
          fetchUsers();
        } catch (error) {
          toast.error('用户删除失败');
        }
      },
    });
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingUser) {
        // 编辑用户
        await api.put(`/users/${editingUser.id}`, values);
        toast.success('用户更新成功');
        const roleIds: number[] = values.role_ids || [];
        if (Array.isArray(roleIds)) {
          await api.post(`/iam/users/${editingUser.id}/roles`, { role_ids: roleIds });
        }
      } else {
        // 创建用户
        const created = await api.post('/users', { ...values, role: values.role || 'user' });
        const userId = created?.data?.id || created?.id || null;
        toast.success('用户创建成功');
        const roleIds: number[] = values.role_ids || [];
        if (userId && Array.isArray(roleIds)) {
          await api.post(`/iam/users/${userId}/roles`, { role_ids: roleIds });
        }
      }
      
      setModalVisible(false);
      fetchUsers();
    } catch (error) {
      toast.error('保存用户失败');
    }
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    form.resetFields();
  };

  useEffect(() => {
    if (modalVisible) {
      if (editingUser) {
        form.setFieldsValue({
          username: editingUser.username,
          email: editingUser.email,
          is_active: editingUser.is_active,
        });
        // 读取用户角色
        (async () => {
          try {
            const res = await api.get<{ success: boolean; role_ids: number[] }>(`/iam/users/${editingUser.id}/roles`);
            form.setFieldsValue({ role_ids: res.role_ids });
          } catch (e) {
            form.setFieldsValue({ role_ids: [] });
          }
        })();
      } else {
        form.resetFields();
        form.setFieldsValue({ role: 'user', is_active: true, role_ids: [] });
      }
      // 打开弹窗时确保角色列表已加载
      fetchRoles();
    }
  }, [modalVisible, editingUser, form]);

  const openReset = (user: User) => {
    setResetUser(user);
    setResetVisible(true);
    resetForm.resetFields();
  };

  const handleResetSave = async () => {
    try {
      const values = await resetForm.validateFields();
      await api.post(`/users/${resetUser!.id}/reset-password`, { password: values.password });
      toast.success('密码重置成功');
      setResetVisible(false);
    } catch (error) {
      toast.error('密码重置失败');
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'red';
      case 'user': return 'blue';
      case 'guest': return 'green';
      default: return 'default';
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin': return '管理员';
      case 'user': return '用户';
      case 'guest': return '访客';
      default: return role;
    }
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      sorter: (a: User, b: User) => a.username.localeCompare(b.username),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '角色',
      key: 'roles',
      render: (_: any, record: any) => {
        const arr: Array<{ code?: string; name?: string }> = Array.isArray(record.roles)
          ? record.roles
          : (record.role ? [{ code: record.role, name: getRoleText(record.role) }] : []);
        if (!arr.length) return <Tag>未分配</Tag>;
        return (
          <Space size="small" wrap>
            {arr.map((r, idx) => (
              <Tag key={idx} color={getRoleColor(r.code || '')}>{r.name || r.code}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '激活' : '禁用'}
        </Tag>
      ),
      filters: [
        { text: '激活', value: true },
        { text: '禁用', value: false },
      ],
      onFilter: (value: boolean, record: User) => record.is_active === value,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (d: any) => {
        try {
          if (!d) return '—';
          if (typeof d === 'string') {
            const patterns = ['yyyy-MM-dd HH:mm:ss.SSS', 'yyyy-MM-dd HH:mm:ss'];
            for (const p of patterns) {
              const parsed = parse(d, p, new Date());
              if (!isNaN(parsed.getTime())) return format(parsed, 'yyyy-MM-dd HH:mm:ss');
            }
            const fallback = new Date(d.replace(' ', 'T'));
            if (!isNaN(fallback.getTime())) return format(fallback, 'yyyy-MM-dd HH:mm:ss');
          } else {
            const dt = new Date(d);
            if (!isNaN(dt.getTime())) return format(dt, 'yyyy-MM-dd HH:mm:ss');
          }
        } catch {}
        return '—';
      },
      sorter: (a: User, b: User) => 
        new Date(a.created_at as any).getTime() - new Date(b.created_at as any).getTime(),
    },
    {
      title: '最后登录',
      dataIndex: 'last_login',
      key: 'last_login',
      render: (d: any) => {
        if (!d) return '从未登录';
        try {
          if (typeof d === 'string') {
            const patterns = ['yyyy-MM-dd HH:mm:ss.SSS', 'yyyy-MM-dd HH:mm:ss'];
            for (const p of patterns) {
              const parsed = parse(d, p, new Date());
              if (!isNaN(parsed.getTime())) return format(parsed, 'yyyy-MM-dd HH:mm:ss');
            }
            const fallback = new Date(d.replace(' ', 'T'));
            if (!isNaN(fallback.getTime())) return format(fallback, 'yyyy-MM-dd HH:mm:ss');
          } else {
            const dt = new Date(d);
            if (!isNaN(dt.getTime())) return format(dt, 'yyyy-MM-dd HH:mm:ss');
          }
        } catch {}
        return '—';
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: User) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
          <Button
            type="link"
            onClick={() => openReset(record)}
          >
            重置密码
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">用户管理</h2>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            创建用户
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      {/* 创建/编辑用户模态框 */}
      <Modal
        title={editingUser ? '编辑用户' : '创建用户'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        okText="保存"
        cancelText="取消"
        width={600}
        forceRender
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            is_active: true,
          }}
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' },
              { max: 20, message: '用户名最多20个字符' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线' }
            ]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>

          <Form.Item
            label="邮箱"
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>

          {!editingUser && (
            <Form.Item
              label="密码"
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少6个字符' }
              ]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
          )}

          <Form.Item label="角色" name="role_ids">
            <Select
              mode="multiple"
              placeholder="请选择角色"
              options={roles.map(r => ({ label: r.name, value: r.id }))}
              loading={!roles.length}
              allowClear
              showSearch
            />
          </Form.Item>

          <Form.Item
            label="状态"
            name="is_active"
            valuePropName="checked"
          >
            <Switch checkedChildren="激活" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`重置密码 - ${resetUser?.username || ''}`}
        open={resetVisible}
        onOk={handleResetSave}
        onCancel={() => setResetVisible(false)}
        okText="保存"
        cancelText="取消"
        width={500}
        forceRender
      >
        <Form form={resetForm} layout="vertical">
          <Form.Item
            label="新密码"
            name="password"
            rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '至少6个字符' }]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            label="确认密码"
            name="confirm"
            dependencies={["password"]}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve();
                  return Promise.reject(new Error('两次输入的密码不一致'));
                }
              })
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Users;
