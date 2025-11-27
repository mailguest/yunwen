import React, { useEffect, useMemo } from 'react'
import { Card, Descriptions, Tag, Button, Space, Table } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { useTaskStore } from '@/stores/taskStore'
import { formatDate } from '@/lib/utils'

const TaskDetail: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { currentTask, loading, fetchTaskById } = useTaskStore()

  useEffect(() => {
    if (id) fetchTaskById(id)
  }, [id, fetchTaskById])

  const configText = useMemo(() => {
    if (!currentTask?.task_config) return ''
    try {
      return typeof currentTask.task_config === 'string' ? currentTask.task_config : JSON.stringify(currentTask.task_config, null, 2)
    } catch {
      return ''
    }
  }, [currentTask])

  return (
    <div className="p-6">
      <Card loading={loading} title="任务详情" extra={<Space><Button onClick={() => navigate('/tasks')}>返回列表</Button><Button type="primary" onClick={() => navigate(`/tasks/${id}/edit`)}>编辑任务</Button></Space>}>
        <Descriptions column={2} bordered size="middle">
          <Descriptions.Item label="任务名称">{currentTask?.name}</Descriptions.Item>
          <Descriptions.Item label="任务类型">{currentTask?.task_type === 'http' ? <Tag color="green">HTTP</Tag> : <Tag color="orange">RPC</Tag>}</Descriptions.Item>
          <Descriptions.Item label="分组">{currentTask?.group_id ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Cron表达式">{currentTask?.cron_expression}</Descriptions.Item>
          <Descriptions.Item label="并发控制">{currentTask?.concurrent_control ? <Tag color="blue">启用</Tag> : <Tag>禁用</Tag>}</Descriptions.Item>
          <Descriptions.Item label="超时时间(秒)">{currentTask?.timeout}</Descriptions.Item>
          <Descriptions.Item label="重试次数">{currentTask?.retry_count}</Descriptions.Item>
          <Descriptions.Item label="状态">{currentTask?.enabled ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>}</Descriptions.Item>
          <Descriptions.Item label="最后执行" span={2}>{currentTask?.last_execution_at ? formatDate(currentTask.last_execution_at as any) : '-'}</Descriptions.Item>
          <Descriptions.Item label="下次执行" span={2}>{currentTask?.next_execution_at ? formatDate(currentTask.next_execution_at as any) : '-'}</Descriptions.Item>
          <Descriptions.Item label="任务描述" span={2}>{currentTask?.description ?? '-'}</Descriptions.Item>
        </Descriptions>

        <Card className="mt-4" title="任务配置">
          <pre className="bg-gray-100 p-4 rounded" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{configText}</pre>
        </Card>

        <Card className="mt-4" title="任务参数">
          <Table
            dataSource={currentTask?.parameters || []}
            rowKey={(r) => `${r.parameter_name}-${r.parameter_type}`}
            pagination={false}
            columns={[
              { title: '名称', dataIndex: 'parameter_name', key: 'parameter_name' },
              { title: '值', dataIndex: 'parameter_value', key: 'parameter_value' },
              { title: '类型', dataIndex: 'parameter_type', key: 'parameter_type' },
              { title: '是否动态', dataIndex: 'is_dynamic', key: 'is_dynamic', render: (v: boolean) => v ? <Tag color="blue">是</Tag> : <Tag>否</Tag> },
            ]}
          />
        </Card>
      </Card>
    </div>
  )
}

export default TaskDetail
