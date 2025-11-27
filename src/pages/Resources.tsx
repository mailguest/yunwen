import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Switch, Popconfirm, Select, App as AntApp } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, 
  DashboardOutlined, ScheduleOutlined, ProfileOutlined, AreaChartOutlined, FileTextOutlined, SettingOutlined, 
  UserOutlined, SafetyOutlined, AlertOutlined, TeamOutlined, DatabaseOutlined, MonitorOutlined } from '@ant-design/icons'
import { api } from '@/lib/api'

interface Resource {
  id: number
  name: string
  code: string
  path: string
  icon?: string
  parent_id?: number
  order_index: number
  is_active: boolean
  system_id?: number
  system_code?: string
  system_name?: string
  created_at: string
  updated_at: string
}

const Resources: React.FC = () => {
  const { message } = AntApp.useApp()
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingRecord, setEditingRecord] = useState<Resource | null>(null)
  const [form] = Form.useForm()
  const [systems, setSystems] = useState<Array<{ id: number; code: string; name: string }>>([])
  const [selectedSystemCode, setSelectedSystemCode] = useState<string>('')
  const [searchKeyword, setSearchKeyword] = useState<string>('')

  const iconMap: Record<string, React.ReactNode> = {
    dashboardoutlined: <DashboardOutlined />,
    scheduleoutlined: <ScheduleOutlined />,
    profileoutlined: <ProfileOutlined />,
    areachartoutlined: <AreaChartOutlined />,
    filetextoutlined: <FileTextOutlined />,
    settingoutlined: <SettingOutlined />,
    useroutlined: <UserOutlined />,
    safetyoutlined: <SafetyOutlined />,
    alertoutlined: <AlertOutlined />,
    teamoutlined: <TeamOutlined />,
    databaseoutlined: <DatabaseOutlined />,
    monitoroutlined: <MonitorOutlined />,
  }
  const getIcon = (name?: string) => (name ? iconMap[name.toLowerCase()] : undefined)
  const iconOptions = Object.keys(iconMap).map(k => ({ value: k.replace('outlined','Outlined'), label: k.replace('outlined','Outlined') }))

  const fetchResources = async () => {
    setLoading(true)
    try {
      const params: string[] = []
      if (selectedSystemCode) params.push(`system_code=${encodeURIComponent(selectedSystemCode)}`)
      if (searchKeyword) params.push(`keyword=${encodeURIComponent(searchKeyword)}`)
      const qs = params.length ? `?${params.join('&')}` : ''
      const res = await api.get<{ success: boolean; items: Resource[] }>(`/iam/resources${qs}`)
      setResources(res.items)
    } catch {
      message.error('获取资源列表失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchSystems = async () => {
    try {
      const res = await api.get<{ success: boolean; items: Array<{ id: number; code: string; name: string }> }>(`/systems`)
      setSystems(res.items)
    } catch {}
  }

  useEffect(() => {
    fetchResources()
    fetchSystems()
  }, [])

  useEffect(() => {
    fetchResources()
  }, [selectedSystemCode])

  const handleCreate = () => {
    setEditingRecord(null)
    form.resetFields()
    form.setFieldsValue({ system_code: selectedSystemCode || 'default' })
    setModalVisible(true)
  }

  const handleEdit = (record: Resource) => {
    setEditingRecord(record)
    form.setFieldsValue(record)
    setModalVisible(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/iam/resources/${id}`)
      message.success('删除资源成功')
      fetchResources()
    } catch {
      message.error('删除资源失败')
    }
  }

  const handleSubmit = async (values: any) => {
    const payload = {
      name: values.name,
      code: values.code,
      path: values.path,
      icon: values.icon ?? null,
      parent_id: values.parent_id ?? null,
      order_index: Number(values.order_index ?? 0),
      is_active: values.is_active ?? true,
      system_code: values.system_code ?? 'default',
    }
    try {
      if (editingRecord) {
        await api.put(`/iam/resources/${editingRecord.id}`, payload)
        message.success('更新资源成功')
      } else {
        await api.post(`/iam/resources`, payload)
        message.success('创建资源成功')
      }
      setModalVisible(false)
      fetchResources()
    } catch {
      message.error(editingRecord ? '更新资源失败' : '创建资源失败')
    }
  }

  const columns = [
    { title: '资源名称', dataIndex: 'name', key: 'name' },
    { title: '资源代码', dataIndex: 'code', key: 'code', render: (code: string) => <Tag color="blue">{code}</Tag> },
    { title: '路径', dataIndex: 'path', key: 'path' },
    { title: '图标', dataIndex: 'icon', key: 'icon', render: (name: string) => (
      <Space>
        {getIcon(name)}
        <span>{name}</span>
      </Space>
    ) },
    { title: '系统', dataIndex: 'system_name', key: 'system_name', render: (_: any, record: Resource) => record.system_name || record.system_code || 'default' },
    { title: '父级ID', dataIndex: 'parent_id', key: 'parent_id' },
    { title: '排序', dataIndex: 'order_index', key: 'order_index' },
    { title: '状态', dataIndex: 'is_active', key: 'is_active', render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag> },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Resource) => (
        <Space size="middle">
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定要删除这个资源吗？" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div className="p-6">
      <Card>
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">资源管理</h2>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>创建资源</Button>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <Select value={selectedSystemCode} onChange={(v) => setSelectedSystemCode(v)} allowClear placeholder="按系统筛选" style={{ width: 220 }}>
              {systems.map(s => (
                <Select.Option key={s.code} value={s.code}>{s.name}（{s.code}）</Select.Option>
              ))}
            </Select>
            <Input.Search allowClear placeholder="按名称或代码搜索" onSearch={(v) => { setSearchKeyword(v); fetchResources() }} style={{ width: 280 }} />
          </div>

          <Table columns={columns} dataSource={resources} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
        </div>
      </Card>

      <Modal title={editingRecord ? '编辑资源' : '创建资源'} open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} width={600}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="资源名称" rules={[{ required: true, message: '请输入资源名称' }]}>
            <Input placeholder="请输入资源名称" />
          </Form.Item>
          <Form.Item name="code" label="资源代码" rules={[{ required: true, message: '请输入资源代码' }]}>
            <Input placeholder="请输入资源代码" />
          </Form.Item>
          <Form.Item name="path" label="路径" rules={[{ required: true, message: '请输入路径' }]}>
            <Input placeholder="请输入路径" />
          </Form.Item>
          <Form.Item name="icon" label="图标">
            <Select
              showSearch
              allowClear
              placeholder="选择图标"
              optionLabelProp="label"
            >
              {iconOptions.map(opt => (
                <Select.Option key={opt.value} value={opt.value} label={opt.label}>
                  <Space>
                    {getIcon(opt.value)}
                    <span>{opt.label}</span>
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="system_code" label="系统归属" initialValue={'default'}>
            <Select allowClear placeholder="选择系统">
              {systems.map(s => (
                <Select.Option key={s.code} value={s.code}>{s.name}（{s.code}）</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="parent_id" label="父级资源">
            <Select allowClear placeholder="选择父级资源">
              {resources.map(r => (
                <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="order_index" label="排序" initialValue={0}>
            <Input type="number" placeholder="请输入排序" />
          </Form.Item>
          <Form.Item name="is_active" label="状态" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">保存</Button>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Resources
