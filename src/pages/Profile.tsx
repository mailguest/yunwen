import React, { useState } from 'react';
import { Card, Form, Input, Button, Avatar, Upload, Row, Col, Divider, App as AntApp } from 'antd';
import { UserOutlined, MailOutlined, CalendarOutlined, KeyOutlined, UploadOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';

const Profile: React.FC = () => {
  const { user, updateProfile } = useAuthStore();
  const { message } = AntApp.useApp();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();

  const handleProfileSubmit = async (values: any) => {
    try {
      setLoading(true);
      await updateProfile(values);
      message.success('个人资料更新成功');
    } catch (error) {
      message.error('个人资料更新失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (values: any) => {
    try {
      setPasswordLoading(true);
      await api.post('/auth/change-password', {
        current_password: values.current_password,
        new_password: values.new_password,
      });
      message.success('密码修改成功');
      passwordForm.resetFields();
    } catch (error) {
      message.error('密码修改失败');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    
    try {
      const response = await api.post<{avatar_url: string}>('/auth/upload-avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      message.success('头像上传成功');
      // 更新用户头像
      if (user) {
        updateProfile({ avatar_url: response.avatar_url });
      }
    } catch (error) {
      message.error('头像上传失败');
    }
    
    return false; // 阻止自动上传
  };

  React.useEffect(() => {
    profileForm.setFieldsValue({
      username: user?.username,
      email: user?.email,
      full_name: user?.full_name,
      phone: user?.phone,
      department: user?.department,
      position: user?.position,
    });
  }, [user, profileForm]);

  const uploadProps = {
    beforeUpload: handleAvatarUpload,
    showUploadList: false,
    accept: 'image/*',
  };

  return (
    <div className="space-y-6">
      {/* 个人信息卡片 */}
      <Card title="个人信息">
        <Row gutter={24}>
          <Col span={6}>
            <div className="text-center">
              <div className="mb-4">
                <Avatar
                  size={120}
                  icon={<UserOutlined />}
                  src={user?.avatar_url}
                  className="mx-auto"
                />
              </div>
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />}>
                  更换头像
                </Button>
              </Upload>
            </div>
          </Col>
          <Col span={18}>
            <Form
              form={profileForm}
              layout="vertical"
              initialValues={{
                username: user?.username,
                email: user?.email,
                full_name: user?.full_name,
                phone: user?.phone,
                department: user?.department,
                position: user?.position,
              }}
              onFinish={handleProfileSubmit}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="用户名"
                    name="username"
                    rules={[{ required: true, message: '请输入用户名' }]}
                  >
                    <Input prefix={<UserOutlined />} placeholder="用户名" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="邮箱"
                    name="email"
                    rules={[
                      { required: true, message: '请输入邮箱' },
                      { type: 'email', message: '请输入有效的邮箱地址' }
                    ]}
                  >
                    <Input prefix={<MailOutlined />} placeholder="邮箱" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="姓名"
                    name="full_name"
                  >
                    <Input placeholder="姓名" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="手机号"
                    name="phone"
                  >
                    <Input placeholder="手机号" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="部门"
                    name="department"
                  >
                    <Input placeholder="部门" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="职位"
                    name="position"
                  >
                    <Input placeholder="职位" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading}>
                  保存修改
                </Button>
              </Form.Item>
            </Form>
          </Col>
        </Row>
      </Card>

      {/* 账户信息 */}
      <Card title="账户信息">
        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">用户ID</span>
            <span className="font-mono">{user?.id}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">角色</span>
            <span>
              {user?.role === 'admin' ? '管理员' : 
               user?.role === 'user' ? '用户' : '访客'}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">账户状态</span>
            <span className={user?.is_active ? 'text-green-600' : 'text-red-600'}>
              {user?.is_active ? '激活' : '禁用'}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">注册时间</span>
            <span>{user?.created_at ? new Date(user.created_at).toLocaleString() : '-'}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600">最后登录</span>
            <span>{user?.last_login ? new Date(user.last_login).toLocaleString() : '从未登录'}</span>
          </div>
        </div>
      </Card>

      {/* 修改密码 */}
      <Card title="修改密码">
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handlePasswordSubmit}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="当前密码"
                name="current_password"
                rules={[{ required: true, message: '请输入当前密码' }]}
              >
                <Input.Password prefix={<KeyOutlined />} placeholder="当前密码" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="新密码"
                name="new_password"
                rules={[
                  { required: true, message: '请输入新密码' },
                  { min: 6, message: '密码至少6个字符' }
                ]}
              >
                <Input.Password prefix={<KeyOutlined />} placeholder="新密码" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="确认新密码"
                name="confirm_password"
                dependencies={['new_password']}
                rules={[
                  { required: true, message: '请确认新密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('new_password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    },
                  }),
                ]}
              >
                <Input.Password prefix={<KeyOutlined />} placeholder="确认新密码" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={passwordLoading}>
              修改密码
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Profile;
