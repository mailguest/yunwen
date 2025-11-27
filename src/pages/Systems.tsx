import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Space, Modal, Form, Input, App as AntApp } from 'antd'
import { api } from '@/lib/api'

const Systems: React.FC = () => {
  const { message } = AntApp.useApp()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [editing, setEditing] = useState<any | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await api.get<any>('/systems')
      setItems(res.items || [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const openCreate = () => { setEditing(null); form.resetFields(); setModalVisible(true) }
  const openEdit = (record: any) => { setEditing(record); form.setFieldsValue({ name: record.name, code: record.code, description: record.description }); setModalVisible(true) }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      if (editing) {
        await api.put(`/systems/${editing.id}`, { name: values.name, description: values.description })
        message.success('系统更新成功')
      } else {
        await api.post('/systems', values)
        message.success('系统创建成功')
      }
      setModalVisible(false)
      fetchData()
    } catch {
      message.error('保存失败')
    }
  }

  const columns = [
    { title: '系统名称', dataIndex: 'name', key: 'name' },
    { title: '系统代码', dataIndex: 'code', key: 'code' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '操作', key: 'action', render: (_: any, record: any) => (
      <Space>
        <Button type="link" onClick={() => openEdit(record)}>编辑</Button>
        <Button type="link" danger onClick={async () => { await api.delete(`/systems/${record.id}`); message.success('已删除'); fetchData() }}>删除</Button>
      </Space>
    ) },
  ]

  return (
    <div className="p-6">
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">系统管理</h2>
          <Button type="primary" onClick={openCreate}>创建系统</Button>
        </div>
        <Table columns={columns} dataSource={items} loading={loading} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal title={editing ? '编辑系统' : '创建系统'} open={modalVisible} onCancel={() => setModalVisible(false)} onOk={submit} okText="保存">
        <Form form={form} layout="vertical">
          <Form.Item label="系统名称" name="name" rules={[{ required: true, message: '请输入系统名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="系统代码" name="code" rules={[{ required: !editing, message: '请输入系统代码' }]}>
            <Input disabled={!!editing} />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Systems

