import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Popconfirm, Select, Tree, App as AntApp } from 'antd'
import { format, parse } from 'date-fns'
import { PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined } from '@ant-design/icons'
import { api } from '@/lib/api'

interface Role {
  id: number
  name: string
  code: string
  description?: string
  created_at: string
  updated_at: string
}

interface ResourceItem {
  id: number
  name: string
  parent_id?: number | null
  order_index?: number
}

const Roles: React.FC = () => {
  const { message } = AntApp.useApp()
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingRecord, setEditingRecord] = useState<Role | null>(null)
  const [form] = Form.useForm()

  const [bindVisible, setBindVisible] = useState(false)
  const [bindRole, setBindRole] = useState<Role | null>(null)
  const [systems, setSystems] = useState<Array<{ code: string; name: string }>>([])
  const [selectedSystemCode, setSelectedSystemCode] = useState<string>('default')
  const [resources, setResources] = useState<ResourceItem[]>([])
  const [treeData, setTreeData] = useState<any[]>([])
  const [selectedResourceIds, setSelectedResourceIds] = useState<number[]>([])
  const [allRoleResourceIds, setAllRoleResourceIds] = useState<number[]>([])

  const fetchRoles = async () => {
    setLoading(true)
    try {
      const res = await api.get<{ success: boolean; items: Role[] }>(`/iam/roles`)
      setRoles(res.items)
    } catch {
      message.error('获取角色列表失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchAllResources = async (systemCode?: string): Promise<ResourceItem[]> => {
    try {
      const code = systemCode || selectedSystemCode
      const res = await api.get<{ success: boolean; items: any[] }>(`/iam/resources?system_code=${code}`)
      const items: ResourceItem[] = res.items.map(i => ({ id: i.id, name: i.name, parent_id: i.parent_id ?? null, order_index: i.order_index ?? 0 }))
      setResources(items)
      const toTree = (list: ResourceItem[]) => {
        const map = new Map<number, any>()
        list.forEach(i => {
          map.set(i.id, { title: i.name, key: i.id, children: [], order: i.order_index || 0 })
        })
        list.forEach(i => {
          if (i.parent_id) {
            const p = map.get(i.parent_id)
            const n = map.get(i.id)
            if (p && n) p.children.push(n)
          }
        })
        const roots = list.filter(i => !i.parent_id).map(i => map.get(i.id))
        const sortRec = (nodes: any[]) => {
          nodes.sort((a,b) => a.order - b.order)
          nodes.forEach(n => sortRec(n.children))
        }
        sortRec(roots)
        return roots
      }
      setTreeData(toTree(items))
      setSelectedResourceIds(prev => prev.filter(id => items.some(it => it.id === id)))
      return items
    } catch {
      setResources([])
      setTreeData([])
      setSelectedResourceIds([])
      return []
    }
  }

  const fetchSystems = async () => {
    try {
      const res = await api.get<{ success: boolean; items: Array<{ id: number; code: string; name: string }> }>(`/systems`)
      setSystems(res.items.map(i => ({ code: i.code, name: i.name })))
    } catch {}
  }

  useEffect(() => {
    fetchRoles()
  }, [])

  const handleCreateRole = () => {
    setEditingRecord(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEditRole = (record: Role) => {
    setEditingRecord(record)
    form.setFieldsValue(record)
    setModalVisible(true)
  }

  const handleDeleteRole = async (id: number) => {
    try {
      await api.delete(`/iam/roles/${id}`)
      message.success('删除角色成功')
      fetchRoles()
    } catch {
      message.error('删除角色失败')
    }
  }

  const handleRoleSubmit = async (values: any) => {
    try {
      if (editingRecord) {
        await api.put(`/iam/roles/${editingRecord.id}`, values)
        message.success('更新角色成功')
      } else {
        await api.post('/iam/roles', values)
        message.success('创建角色成功')
      }
      setModalVisible(false)
      fetchRoles()
    } catch {
      message.error(editingRecord ? '更新角色失败' : '创建角色失败')
    }
  }

  const openBindResources = async (role: Role) => {
    setBindRole(role)
    await fetchSystems()
    const items = await fetchAllResources(selectedSystemCode)
    try {
      const res = await api.get<{ success: boolean; resource_ids: number[] }>(`/iam/roles/${role.id}/resources`)
      setAllRoleResourceIds(res.resource_ids)
      const setIds = res.resource_ids.filter(id => items.some(r => r.id === id))
      setSelectedResourceIds(setIds)
    } catch {
      setSelectedResourceIds([])
    }
    setBindVisible(true)
  }

  const handleSystemChange = async (v: string) => {
    setSelectedSystemCode(v)
    const items = await fetchAllResources(v)
    const setIds = allRoleResourceIds.filter(id => items.some(r => r.id === id))
    setSelectedResourceIds(setIds)
  }

  const submitBindResources = async () => {
    if (!bindRole) return
    if (treeData.length === 0) {
      message.error('当前系统无可配置权限')
      return
    }
    try {
      const sysIdsSet = new Set(resources.map(r => r.id))
      const preserved = allRoleResourceIds.filter(id => !sysIdsSet.has(id))
      const merged = Array.from(new Set([...preserved, ...selectedResourceIds]))
      await api.post(`/iam/roles/${bindRole.id}/resources`, { resource_ids: merged })
      setAllRoleResourceIds(merged)
      message.success('权限配置成功')
      setBindVisible(false)
    } catch {
      message.error('权限配置失败')
    }
  }

  const columns = [
    { title: '角色名称', dataIndex: 'name', key: 'name' },
    { title: '角色代码', dataIndex: 'code', key: 'code', render: (code: string) => <Tag color="blue">{code}</Tag> },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (d: any) => {
      try {
        if (!d) return '—'
        if (typeof d === 'string') {
          const patterns = ['yyyy-MM-dd HH:mm:ss.SSS', 'yyyy-MM-dd HH:mm:ss']
          for (const p of patterns) {
            const parsed = parse(d, p, new Date())
            if (!isNaN(parsed.getTime())) return format(parsed, 'yyyy-MM-dd HH:mm:ss')
          }
          const fallback = new Date(d.replace(' ', 'T'))
          if (!isNaN(fallback.getTime())) return format(fallback, 'yyyy-MM-dd HH:mm:ss')
        } else {
          const dt = new Date(d)
          if (!isNaN(dt.getTime())) return format(dt, 'yyyy-MM-dd HH:mm:ss')
        }
      } catch {}
      return '—'
    } },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Role) => (
        <Space size="middle">
          <Button type="link" icon={<SafetyOutlined />} onClick={() => openBindResources(record)}>权限配置</Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditRole(record)}>编辑</Button>
          <Popconfirm title="确定要删除这个角色吗？" onConfirm={() => handleDeleteRole(record.id)} okText="确定" cancelText="取消">
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
            <h2 className="text-xl font-bold">角色管理</h2>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateRole}>创建角色</Button>
          </div>

          <Table columns={columns} dataSource={roles} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
        </div>
      </Card>

      <Modal title={editingRecord ? '编辑角色' : '创建角色'} open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} width={600}>
        <Form form={form} layout="vertical" onFinish={handleRoleSubmit}>
          <Form.Item name="name" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]}>
            <Input placeholder="请输入角色名称" />
          </Form.Item>
          <Form.Item name="code" label="角色代码" rules={[{ required: true, message: '请输入角色代码' }]}>
            <Input placeholder="请输入角色代码" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入描述" rows={3} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">保存</Button>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="角色权限配置" open={bindVisible} onCancel={() => setBindVisible(false)} onOk={submitBindResources} okText="保存" width={640} okButtonProps={{ disabled: treeData.length === 0 }}>
        <Space style={{ marginBottom: 12 }}>
          <span>选择系统：</span>
          <Select
            value={selectedSystemCode}
            onChange={(v) => handleSystemChange(v as string)}
            style={{ width: 220 }}
          >
            {systems.map(s => (
              <Select.Option key={s.code} value={s.code}>{s.name}（{s.code}）</Select.Option>
            ))}
          </Select>
        </Space>
        {treeData.length === 0 ? (
          <div style={{ color: '#888', padding: 12 }}>无权限资源</div>
        ) : (
          <Tree
            checkable
            treeData={treeData}
            checkedKeys={selectedResourceIds as any}
            onCheck={(keys) => {
              const arr = Array.isArray(keys) ? (keys as any[]) : ((keys as any).checked as any[])
              const nums = (arr || []).map(k => typeof k === 'string' ? Number(k) : k).filter((v: any) => typeof v === 'number' && !isNaN(v))
              setSelectedResourceIds(nums)
            }}
            defaultExpandAll
            height={320}
          />
        )}
      </Modal>
    </div>
  )
}

export default Roles
