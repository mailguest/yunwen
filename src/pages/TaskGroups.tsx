import React, { useEffect, useState } from 'react'
import { Card, Table, Button, Space, Modal, Form, Input, App as AntApp } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { api } from '@/lib/api'

const TaskGroups: React.FC = () => {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()
  const { message, modal } = AntApp.useApp()

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get<{ success: boolean; items: any[] }>(`/task-groups`)
      setItems(res.items || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); form.resetFields(); setVisible(true) }
  const openEdit = (row: any) => { setEditing(row); form.setFieldsValue({ name: row.name, description: row.description }); setVisible(true) }

  const save = async () => {
    const values = await form.validateFields()
    try {
      if (editing) {
        await api.put(`/task-groups/${editing.id}`, values)
        message.success('更新成功')
      } else {
        await api.post(`/task-groups`, values)
        message.success('创建成功')
      }
      setVisible(false)
      load()
    } catch { message.error('保存失败') }
  }

  const remove = (row: any) => {
    modal.confirm({
      title: '确认删除',
      content: `确认删除分组「${row.name}」？`,
      onOk: async () => { await api.delete(`/task-groups/${row.id}`); message.success('删除成功'); load() }
    })
  }

  return (
    <div className="p-6">
      <Card title="任务分组" extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建分组</Button>}>
        <Table
          dataSource={items}
          loading={loading}
          rowKey="id"
          columns={[
            { title: 'ID', dataIndex: 'id', width: 80 },
            { title: '名称', dataIndex: 'name' },
            { title: '描述', dataIndex: 'description' },
            { title: '创建时间', dataIndex: 'created_at', width: 180 },
            { title: '操作', key: 'action', width: 160, render: (_: any, row: any) => (
              <Space>
                <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(row)}>编辑</Button>
                <Button type="link" danger icon={<DeleteOutlined />} onClick={() => remove(row)}>删除</Button>
              </Space>
            ) },
          ]}
        />
      </Card>

      <Modal title={editing ? '编辑分组' : '新建分组'} open={visible} onOk={save} onCancel={() => setVisible(false)}>
        <Form form={form} layout="vertical">
          <Form.Item label="分组名称" name="name" rules={[{ required: true, message: '请输入分组名称' }]}>
            <Input placeholder="请输入分组名称" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default TaskGroups
