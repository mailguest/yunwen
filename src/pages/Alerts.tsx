import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Tag, Form, Input, Select, App as AntApp } from 'antd'
import { api } from '@/lib/api'

const Alerts: React.FC = () => {
  const { message } = AntApp.useApp()
  const [loading, setLoading] = useState(false)
  const [rules, setRules] = useState<any[]>([])
  const [tasks, setTasks] = useState<Array<{ id: number; name: string }>>([])
  const [form] = Form.useForm()
  const [editing, setEditing] = useState<any | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [rulesRes, tasksRes] = await Promise.all([
        api.get<any>('/notifications/rules'),
        api.get<any>('/tasks?limit=200')
      ])
      setRules(Array.isArray(rulesRes.items) ? rulesRes.items : [])
      const items = Array.isArray(tasksRes.items) ? tasksRes.items.map((x: any) => ({ id: x.id, name: x.name })) : []
      setTasks(items)
    } catch (e) {
      setRules([])
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editing) {
        await api.put(`/notifications/rules/${editing.id}`, values)
        message.success('规则已更新')
      } else {
        await api.post('/notifications/rules', values)
        message.success('规则已创建')
      }
      setEditing(null)
      form.resetFields()
      fetchData()
    } catch (e) {
      message.error('保存失败')
    }
  }

  const columns = [
    { title: '任务', dataIndex: 'task_name', key: 'task_name' },
    { title: '窗口(分钟)', dataIndex: 'window_minutes', key: 'window_minutes' },
    { title: '失败阈值', dataIndex: 'failure_threshold', key: 'failure_threshold' },
    { title: '收件人', dataIndex: 'to_emails', key: 'to_emails' },
    { title: '启用', dataIndex: 'enabled', key: 'enabled', render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '停用'}</Tag> },
    { title: '操作', key: 'action', render: (_: any, record: any) => (
      <div className="flex gap-2">
        <Button size="small" onClick={() => { setEditing(record); form.setFieldsValue({ task_id: record.task_id, window_minutes: record.window_minutes, failure_threshold: record.failure_threshold, to_emails: record.to_emails, enabled: record.enabled }) }}>编辑</Button>
        <Button size="small" onClick={async () => { await api.put(`/notifications/rules/${record.id}`, { enabled: !record.enabled }); message.success('状态已更新'); fetchData() }}>
          {record.enabled ? '停用' : '启用'}
        </Button>
        <Button size="small" danger onClick={async () => { await api.delete(`/notifications/rules/${record.id}`); message.success('已删除'); fetchData() }}>删除</Button>
      </div>
    ) }
  ]

  return (
    <div className="space-y-4">
      <Card title="告警规则配置">
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ window_minutes: 60, failure_threshold: 1 }}>
          <Form.Item label="任务" name="task_id" rules={[{ required: true, message: '请选择任务' }]}>
            <Select placeholder="请选择任务">
              {tasks.map(t => (
                <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="时间窗口(分钟)" name="window_minutes" rules={[{ required: true }]}>
            <Input placeholder="例如：60" />
          </Form.Item>
          <Form.Item label="失败次数阈值" name="failure_threshold" rules={[{ required: true }]}>
            <Input placeholder="例如：3" />
          </Form.Item>
          <Form.Item label="收件人(逗号分隔)" name="to_emails">
            <Input placeholder="user1@example.com,user2@example.com" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">{editing ? '更新规则' : '创建规则'}</Button>
            {editing && <Button className="ml-2" onClick={() => { setEditing(null); form.resetFields() }}>取消编辑</Button>}
          </Form.Item>
        </Form>
      </Card>

      <Card title="告警规则列表">
        <Table columns={columns} dataSource={rules} loading={loading} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>
    </div>
  )
}

export default Alerts

