import React, { useState } from 'react';
import { Form, Input, Button, Card } from 'antd';
import { toast } from 'sonner';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api'

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const [siteName, setSiteName] = useState('智能定时任务调度平台')
  const [siteDesc, setSiteDesc] = useState('企业级定时任务调度系统')

  React.useEffect(() => {
    (async () => {
      try {
        const res: any = await api.get('/settings/app')
        const d = res?.data
        if (d) {
          if (d.site_name) setSiteName(d.site_name)
          if (d.site_description) setSiteDesc(d.site_description)
        }
      } catch {}
    })()
  }, [])

  const onFinish = async (values: { username: string; password: string }) => {
    try {
      setLoading(true);
      const email = values.username.trim();
      await login({ email, password: values.password });
      toast.success('登录成功');
      navigate('/');
    } catch (error) {
      toast.error('登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-100">
      <div className="absolute top-4 right-6 z-50">
        <a href="/api/docs" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">API 文档</a>
      </div>
      <div className="absolute inset-0 bg-aurora"></div>
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>

      <Card 
        className="w-full max-w-2xl rounded-2xl border border-white/30 bg-white/85 backdrop-blur-xl shadow-2xl"
        styles={{ header: { paddingTop: 24 } }}
        title={
          <div className="text-center">
            <h2 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 mb-3">{siteName}</h2>
            <p className="text-gray-600 text-base">{siteDesc}</p>
          </div>
        }
      >
        <div className="px-8 py-6">
        <Form
          name="login"
          onFinish={onFinish}
          layout="vertical"
          size="large"
          className="space-y-8"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入账号（邮箱或用户名）' }]}
          >
            <Input prefix={<UserOutlined className="text-gray-400" />} placeholder="账号（邮箱或用户名）" className="rounded-xl h-14" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined className="text-gray-400" />} placeholder="密码" className="rounded-xl h-14" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} className="w-full h-14 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 border-none hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg" size="large">登录</Button>
          </Form.Item>
        </Form>
        </div>

        {/* 移除测试账号提示 */}
      </Card>
    </div>
  );
};

export default Login;
