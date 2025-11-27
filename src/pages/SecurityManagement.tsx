import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, Switch, message, Popconfirm, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined, SafetyOutlined, UserOutlined, TeamOutlined, DatabaseOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';

const { Option } = Select;

interface User {
  id: number;
  email: string;
  username: string;
  role: string;
  is_active: boolean;
  avatar_url?: string;
  full_name?: string;
  phone?: string;
  department?: string;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

interface Role {
  id: number;
  name: string;
  code: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface Resource {
  id: number;
  name: string;
  code: string;
  path: string;
  icon?: string;
  parent_id?: number;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const SecurityManagement: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'resources'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'user' | 'role' | 'resource'>('user');
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [form] = Form.useForm();

  // 获取用户列表
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get<User[]>('/users');
      setUsers(response);
    } catch (error) {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取角色列表
  const fetchRoles = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; items: Role[] }>('/iam/roles');
      setRoles(response.items);
    } catch (error) {
      message.error('获取角色列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取资源列表
  const fetchResources = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; items: Resource[] }>('/iam/resources');
      setResources(response.items);
    } catch (error) {
      message.error('获取资源列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/roles')) setActiveTab('roles');
    else if (path.includes('/resources')) setActiveTab('resources');
    else setActiveTab('users');
  }, [location.pathname]);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'roles') {
      fetchRoles();
    } else if (activeTab === 'resources') {
      fetchResources();
    }
  }, [activeTab]);

  // 用户管理相关函数
  const handleCreateUser = () => {
    setModalType('user');
    setEditingRecord(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditUser = (record: User) => {
    setModalType('user');
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      password: undefined // 编辑时不显示密码
    });
    setModalVisible(true);
  };

  const handleDeleteUser = async (id: number) => {
    try {
      await api.delete(`/users/${id}`);
      message.success('删除用户成功');
      fetchUsers();
    } catch (error) {
      message.error('删除用户失败');
    }
  };

  const handleResetPassword = async (id: number) => {
    const newPassword = prompt('请输入新密码:');
    if (newPassword) {
      try {
        await api.post(`/users/${id}/reset-password`, { password: newPassword });
        message.success('重置密码成功');
      } catch (error) {
        message.error('重置密码失败');
      }
    }
  };

  const handleUserSubmit = async (values: any) => {
    try {
      if (editingRecord) {
        await api.put(`/users/${editingRecord.id}`, values);
        message.success('更新用户成功');
      } else {
        await api.post('/users', values);
        message.success('创建用户成功');
      }
      setModalVisible(false);
      fetchUsers();
    } catch (error) {
      message.error(editingRecord ? '更新用户失败' : '创建用户失败');
    }
  };

  // 角色管理相关函数
  const handleCreateRole = () => {
    setModalType('role');
    setEditingRecord(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditRole = (record: Role) => {
    setModalType('role');
    setEditingRecord(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDeleteRole = async (id: number) => {
    try {
      await api.delete(`/iam/roles/${id}`);
      message.success('删除角色成功');
      fetchRoles();
    } catch (error) {
      message.error('删除角色失败');
    }
  };

  const handleRoleSubmit = async (values: any) => {
    try {
      if (editingRecord) {
        await api.put(`/iam/roles/${editingRecord.id}`, values);
        message.success('更新角色成功');
      } else {
        await api.post('/iam/roles', values);
        message.success('创建角色成功');
      }
      setModalVisible(false);
      fetchRoles();
    } catch (error) {
      message.error(editingRecord ? '更新角色失败' : '创建角色失败');
    }
  };

  // 资源管理相关函数
  const handleCreateResource = () => {
    setModalType('resource');
    setEditingRecord(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditResource = (record: Resource) => {
    setModalType('resource');
    setEditingRecord(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDeleteResource = async (id: number) => {
    try {
      await api.delete(`/iam/resources/${id}`);
      message.success('删除资源成功');
      fetchResources();
    } catch (error) {
      message.error('删除资源失败');
    }
  };

  const handleResourceSubmit = async (values: any) => {
    try {
      if (editingRecord) {
        await api.put(`/iam/resources/${editingRecord.id}`, values);
        message.success('更新资源成功');
      } else {
        await api.post('/iam/resources', values);
        message.success('创建资源成功');
      }
      setModalVisible(false);
      fetchResources();
    } catch (error) {
      message.error(editingRecord ? '更新资源失败' : '创建资源失败');
    }
  };

  // 用户表格列
  const userColumns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const roleColors = {
          admin: 'red',
          user: 'blue',
          guest: 'green',
        };
        return <Tag color={roleColors[role as keyof typeof roleColors]}>{role}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>{isActive ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: User) => (
        <Space size="middle">
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditUser(record)}>
            编辑
          </Button>
          <Button type="link" icon={<KeyOutlined />} onClick={() => handleResetPassword(record.id)}>
            重置密码
          </Button>
          <Popconfirm
            title="确定要删除这个用户吗？"
            onConfirm={() => handleDeleteUser(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 角色表格列
  const roleColumns = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '角色代码',
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Role) => (
        <Space size="middle">
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditRole(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个角色吗？"
            onConfirm={() => handleDeleteRole(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 资源表格列
  const resourceColumns = [
    {
      title: '资源名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '资源代码',
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
    },
    {
      title: '图标',
      dataIndex: 'icon',
      key: 'icon',
    },
    {
      title: '排序',
      dataIndex: 'order_index',
      key: 'order_index',
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>{isActive ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Resource) => (
        <Space size="middle">
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditResource(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个资源吗？"
            onConfirm={() => handleDeleteResource(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Card>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">安全管理</h1>
          
          {/* 标签页导航 */}
          <div className="flex space-x-1 mb-6">
            <Button
              type={activeTab === 'users' ? 'primary' : 'default'}
              icon={<UserOutlined />}
              onClick={() => navigate('/users')}
            >
              用户管理
            </Button>
            <Button
              type={activeTab === 'roles' ? 'primary' : 'default'}
              icon={<TeamOutlined />}
              onClick={() => navigate('/roles')}
            >
              角色管理
            </Button>
            <Button
              type={activeTab === 'resources' ? 'primary' : 'default'}
              icon={<DatabaseOutlined />}
              onClick={() => navigate('/resources')}
            >
              资源管理
            </Button>
          </div>

          {/* 操作按钮 */}
          <div className="mb-4">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                if (activeTab === 'users') handleCreateUser();
                else if (activeTab === 'roles') handleCreateRole();
                else if (activeTab === 'resources') handleCreateResource();
              }}
            >
              创建{activeTab === 'users' ? '用户' : activeTab === 'roles' ? '角色' : '资源'}
            </Button>
          </div>

          {/* 数据表格 */}
          {activeTab === 'users' && (
            <Table
              columns={userColumns}
              dataSource={users}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          )}

          {activeTab === 'roles' && (
            <Table
              columns={roleColumns}
              dataSource={roles}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          )}

          {activeTab === 'resources' && (
            <Table
              columns={resourceColumns}
              dataSource={resources}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          )}
        </div>
      </Card>

      {/* 模态框 */}
      <Modal
        title={editingRecord ? '编辑' : '创建'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={
            modalType === 'user' ? handleUserSubmit :
            modalType === 'role' ? handleRoleSubmit :
            handleResourceSubmit
          }
        >
          {modalType === 'user' && (
            <>
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input placeholder="请输入用户名" />
              </Form.Item>
              <Form.Item
                name="email"
                label="邮箱"
                rules={[
                  { required: true, message: '请输入邮箱' },
                  { type: 'email', message: '请输入有效的邮箱地址' }
                ]}
              >
                <Input placeholder="请输入邮箱" />
              </Form.Item>
              {!editingRecord && (
                <Form.Item
                  name="password"
                  label="密码"
                  rules={[{ required: true, message: '请输入密码' }]}
                >
                  <Input.Password placeholder="请输入密码" />
                </Form.Item>
              )}
              <Form.Item
                name="role"
                label="角色"
                rules={[{ required: true, message: '请选择角色' }]}
                initialValue="user"
              >
                <Select placeholder="请选择角色">
                  <Option value="admin">管理员</Option>
                  <Option value="user">普通用户</Option>
                  <Option value="guest">访客</Option>
                </Select>
              </Form.Item>
              <Form.Item
                name="is_active"
                label="状态"
                valuePropName="checked"
                initialValue={true}
              >
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </>
          )}

          {modalType === 'role' && (
            <>
              <Form.Item
                name="name"
                label="角色名称"
                rules={[{ required: true, message: '请输入角色名称' }]}
              >
                <Input placeholder="请输入角色名称" />
              </Form.Item>
              <Form.Item
                name="code"
                label="角色代码"
                rules={[{ required: true, message: '请输入角色代码' }]}
              >
                <Input placeholder="请输入角色代码" />
              </Form.Item>
              <Form.Item
                name="description"
                label="描述"
              >
                <Input.TextArea placeholder="请输入描述" rows={3} />
              </Form.Item>
            </>
          )}

          {modalType === 'resource' && (
            <>
              <Form.Item
                name="name"
                label="资源名称"
                rules={[{ required: true, message: '请输入资源名称' }]}
              >
                <Input placeholder="请输入资源名称" />
              </Form.Item>
              <Form.Item
                name="code"
                label="资源代码"
                rules={[{ required: true, message: '请输入资源代码' }]}
              >
                <Input placeholder="请输入资源代码" />
              </Form.Item>
              <Form.Item
                name="path"
                label="路径"
                rules={[{ required: true, message: '请输入路径' }]}
              >
                <Input placeholder="请输入路径" />
              </Form.Item>
              <Form.Item
                name="icon"
                label="图标"
              >
                <Input placeholder="请输入图标" />
              </Form.Item>
              <Form.Item
                name="order_index"
                label="排序"
                initialValue={0}
              >
                <Input type="number" placeholder="请输入排序" />
              </Form.Item>
              <Form.Item
                name="is_active"
                label="状态"
                valuePropName="checked"
                initialValue={true}
              >
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </>
          )}

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SecurityManagement;
