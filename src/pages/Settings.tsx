import React, { useState } from 'react';
import { Card, Form, Input, InputNumber, Select, Switch, Button, Tabs, App as AntApp } from 'antd';
import { Tooltip } from 'antd';
import { toast } from 'sonner';
import { SaveOutlined, SettingOutlined, LockOutlined, NotificationOutlined } from '@ant-design/icons';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { api } from '@/lib/api'

// 使用 Tabs.items API

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { message } = AntApp.useApp();
  const [activeTab, setActiveTab] = useState('basic');
  const [systems, setSystems] = useState<Array<{ id: number; code: string; name: string }>>([])
  const [basicForm] = Form.useForm()
  const [securityForm] = Form.useForm()
  const [pendingSecurityValues, setPendingSecurityValues] = useState<any>(null)

  const handleFinish = async (values: any) => {
    try {
      setLoading(true);
      if (activeTab === 'notification') {
        await api.put('/settings/notification', values);
      } else if (activeTab === 'basic') {
        await api.put('/settings/app', values)
      } else if (activeTab === 'security') {
        await api.put('/settings/security', values)
      }
      message.success('设置保存成功');
    } catch (error) {
      message.error('设置保存失败');
    } finally {
      setLoading(false);
    }
  };

  const basicSettings = {
    site_name: '智能定时任务调度平台',
    site_description: '企业级定时任务调度系统',
    timezone: 'Asia/Shanghai',
    language: 'zh-CN',
    debug: false,
  };


  const securitySettings = {
    jwt_secret_key: 'your-secret-key-change-in-production',
    jwt_algorithm: 'HS256',
    jwt_expiration: 30,
    password_min_length: 8,
    enable_two_factor: false,
  };

  const [notificationSettings, setNotificationSettings] = useState<any>({
    smtp_server: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    smtp_from_email: '',
    enable_email_notifications: false,
  });

  React.useEffect(() => {
    (async () => {
      try {
        const res: any = await api.get('/settings/notification');
        if (res?.config) setNotificationSettings(res.config);
      } catch {}
      try {
        const appRes: any = await api.get('/settings/app')
        const data = appRes?.data || {}
        if (data) {
          setTimeout(() => {
            basicForm.setFieldsValue({
              site_name: data.site_name,
              site_description: data.site_description,
              timezone: data.timezone,
              language: data.language,
              debug: data.debug,
              current_system_code: data.current_system_code,
            })
          }, 0)
        }
      } catch {}
      try {
        const secRes: any = await api.get('/settings/security')
        const s = secRes?.data || {}
        if (s) {
          const vals = {
            jwt_secret_key: s.jwt_secret_key,
            jwt_algorithm: s.jwt_algorithm || 'HS256',
            jwt_expiration: s.jwt_expiration_minutes || 1440,
            password_min_length: s.password_min_length || 8,
            enable_two_factor: !!s.enable_two_factor,
          }
          setPendingSecurityValues(vals)
          if (activeTab === 'security') {
            setTimeout(() => { securityForm.setFieldsValue(vals) }, 0)
          }
        }
      } catch {}
      try {
        const sysRes: any = await api.get('/systems')
        setSystems(sysRes.items || [])
      } catch {}
    })();
  }, []);

  React.useEffect(() => {
    if (activeTab === 'security' && pendingSecurityValues) {
      setTimeout(() => { securityForm.setFieldsValue(pendingSecurityValues) }, 0)
    }
  }, [activeTab, pendingSecurityValues])

  return (
    <div className="space-y-4">
      <Card title="系统设置">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          destroyOnHidden={false}
          items={[
            {
              key: 'basic',
              label: (<span><SettingOutlined />基本设置</span>),
              children: (
                <Form layout="vertical" form={basicForm} initialValues={basicSettings} onFinish={handleFinish}>
                  <Form.Item label="站点名称" name="site_name" rules={[{ required: true, message: '请输入站点名称' }]}>
                    <Input placeholder="请输入站点名称" />
                  </Form.Item>
                  <Form.Item label="站点描述" name="site_description">
                    <Input.TextArea placeholder="请输入站点描述" rows={3} />
                  </Form.Item>
                  <Form.Item label="时区" name="timezone" rules={[{ required: true, message: '请选择时区' }]}>
                    <Select placeholder="请选择时区">
                      <Select.Option value="Asia/Shanghai">Asia/Shanghai</Select.Option>
                      <Select.Option value="UTC">UTC</Select.Option>
                      <Select.Option value="America/New_York">America/New_York</Select.Option>
                      <Select.Option value="Europe/London">Europe/London</Select.Option>
                    </Select>
                  </Form.Item>
                  <Form.Item label="语言" name="language" rules={[{ required: true, message: '请选择语言' }]}>
                    <Select placeholder="请选择语言">
                      <Select.Option value="zh-CN">简体中文</Select.Option>
                      <Select.Option value="en-US">English</Select.Option>
                    </Select>
                  </Form.Item>
                  <Form.Item label="当前系统代码" name="current_system_code" rules={[{ required: true, message: '请选择系统代码' }]}>
                    <Select placeholder="请选择系统代码">
                      {systems.map(s => (
                        <Select.Option key={s.code} value={s.code}>{s.name}（{s.code}）</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item label="调试模式" name="debug" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>保存设置</Button>
                  </Form.Item>
                </Form>
              )
            },
            {
              key: 'security',
              label: (<span><LockOutlined />安全设置</span>),
              children: (
                <Form layout="vertical" form={securityForm} initialValues={securitySettings} onFinish={handleFinish}>
                  <Form.Item label="JWT密钥" name="jwt_secret_key" rules={[{ required: true, message: '请输入JWT密钥' }]}> 
                    <Input.Password placeholder="请输入JWT密钥" />
                  </Form.Item>
                  <Form.Item label="JWT算法" name="jwt_algorithm" rules={[{ required: true, message: '请选择JWT算法' }]}> 
                    <Select placeholder="请选择JWT算法">
                      <Select.Option value="HS256">HS256</Select.Option>
                      <Select.Option value="HS384">HS384</Select.Option>
                      <Select.Option value="HS512">HS512</Select.Option>
                    </Select>
                  </Form.Item>
                  <Form.Item label="JWT过期时间(分钟)" name="jwt_expiration" rules={[{ required: true, message: '请输入JWT过期时间' }]}> 
                    <InputNumber min={1} max={1440} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item label="密码最小长度" name="password_min_length" rules={[{ required: true, message: '请输入密码最小长度' }]}> 
                    <InputNumber min={6} max={20} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item 
                    label={<span>启用双因素认证 <Tooltip title="开启后除密码外，还需第二步验证（如邮箱验证码或动态口令TOTP）以提升账号安全。此开关仅启用策略，具体验证方式需另行配置。" trigger="click"><QuestionCircleOutlined style={{ marginLeft: 6 }} /></Tooltip></span>} 
                    name="enable_two_factor" 
                    valuePropName="checked"
                  > 
                    <Switch />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>保存设置</Button>
                  </Form.Item>
                </Form>
              )
            },
            {
              key: 'notification',
              label: (<span><NotificationOutlined />通知设置</span>),
              children: (
                <Form layout="vertical" initialValues={notificationSettings} onFinish={handleFinish}>
                  <Form.Item label="SMTP服务器" name="smtp_server">
                    <Input placeholder="smtp.gmail.com" />
                  </Form.Item>
                  <Form.Item label="SMTP端口" name="smtp_port">
                    <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item label="SMTP用户名" name="smtp_username">
                    <Input placeholder="your-email@gmail.com" />
                  </Form.Item>
                  <Form.Item label="SMTP密码" name="smtp_password">
                    <Input.Password placeholder="请输入SMTP密码" />
                  </Form.Item>
                  <Form.Item label="发件人邮箱" name="smtp_from_email">
                    <Input placeholder="your-email@gmail.com" />
                  </Form.Item>
                  <Form.Item label="启用邮件通知" name="enable_email_notifications" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>保存设置</Button>
                  </Form.Item>
                </Form>
              )
            }
          ]}
        />
      </Card>
    </div>
  );
};

export default Settings;
