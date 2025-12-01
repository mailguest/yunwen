// 任务管理主页面
import React, { useState, useEffect, useRef } from 'react';
import { Card, Table, Button, Space, Tag, Switch, Modal, Input, Select, App as AntApp } from 'antd';
import dayjs from 'dayjs';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, PauseCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTaskStore } from '@/stores/taskStore';
import { api } from '@/lib/api';
import { Task } from '@/types/task';
import { formatDate } from '@/lib/utils';

const { Search } = Input;
const { Option } = Select;

const TaskList: React.FC = () => {
  const navigate = useNavigate();
  const { tasks, loading, fetchTasks, deleteTask, updateTaskStatus } = useTaskStore();
  const { message } = AntApp.useApp();
  
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [groupFilter, setGroupFilter] = useState<string>('');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [execModalVisible, setExecModalVisible] = useState(false);
  const [execLoading, setExecLoading] = useState(false);
  const [execItems, setExecItems] = useState<any[]>([]);
  const [execTotal, setExecTotal] = useState(0);
  const [execPage, setExecPage] = useState(1);
  const [execLimit, setExecLimit] = useState(10);
  const [execStatus, setExecStatus] = useState<string>('');
  const [execStart, setExecStart] = useState<string | undefined>(undefined);
  const [execEnd, setExecEnd] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleSearch = (value: string) => {
    setSearchText(value);
    fetchTasks({ search: value, status: statusFilter, group_id: groupFilter });
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    fetchTasks({ search: searchText, status: value, group_id: groupFilter });
  };

  const handleGroupFilterChange = (value: string) => {
    setGroupFilter(value);
    fetchTasks({ search: searchText, status: statusFilter, group_id: value });
  };

  const handleCreateTask = () => {
    navigate('/tasks/create');
  };

  const handleEditTask = (task: Task) => {
    navigate(`/tasks/${task.id}/edit`);
  };

  const handleDeleteTask = (task: Task) => {
    setSelectedTask(task);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (selectedTask) {
      try {
        await deleteTask(selectedTask.id);
        message.success('任务删除成功');
        setDeleteModalVisible(false);
        setSelectedTask(null);
      } catch (error) {
        message.error('任务删除失败');
      }
    }
  };

  const handleStatusToggle = async (task: Task, enabled: boolean) => {
    try {
      await updateTaskStatus(task.id, enabled);
      message.success(`任务已${enabled ? '启用' : '禁用'}`);
    } catch (error) {
      message.error('任务状态更新失败');
    }
  };

  const handleManualTrigger = async (task: Task) => {
    try {
      await useTaskStore.getState().triggerTask(String(task.id));
      message.success('任务已手动触发');
      // 重新加载列表以刷新下一次执行时间
      await fetchTasks();
    } catch (error) {
      message.error('任务触发失败');
    }
  };

  const fetchDebounceRef = useRef<number | null>(null);

  const scheduleFetchExecutions = (
    taskId: number,
    page: number,
    limit: number,
    status?: string,
    start?: string,
    end?: string,
    delay = 300,
  ) => {
    if (fetchDebounceRef.current) {
      window.clearTimeout(fetchDebounceRef.current);
    }
    fetchDebounceRef.current = window.setTimeout(() => {
      fetchExecutions(taskId, page, limit, status, start, end);
    }, delay);
  };

  const openExecutions = (task: Task) => {
    setSelectedTask(task);
    setExecPage(1);
    setExecModalVisible(true);
    scheduleFetchExecutions(Number(task.id), 1, execLimit, execStatus, execStart, execEnd, 0);
  };

  const fetchExecutions = async (
    taskId: number,
    page: number,
    limit: number,
    status?: string,
    start?: string,
    end?: string,
  ) => {
    try {
      setExecLoading(true);
      const params = new URLSearchParams();
      params.append('task_id', String(taskId));
      params.append('page', String(page));
      params.append('limit', String(limit));
      if (status) params.append('status', status);
      if (start) params.append('start_time', start);
      if (end) params.append('end_time', end);

      const data = await api.get<{ success: boolean; items: any[]; total: number; page: number; limit: number; message?: string }>(`/monitoring/executions?${params.toString()}`);
      if (!data.success) throw new Error(data.message || '获取执行记录失败');
      setExecItems((data as any).items || []);
      setExecTotal((data as any).total || 0);
      setExecPage((data as any).page || page);
      setExecLimit((data as any).limit || limit);
    } catch (e) {
      console.error('获取执行记录失败:', e);
      message.error('获取执行记录失败');
    } finally {
      setExecLoading(false);
    }
  };

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text: string, record: Task) => (
        <div>
          <a className="font-medium text-blue-600 hover:underline" onClick={() => navigate(`/tasks/${record.id}`)} title="查看详情">{text}</a>
          <div className="text-gray-500 text-sm">{record.description}</div>
        </div>
      ),
    },
    {
      title: '分组',
      dataIndex: ['group', 'name'],
      key: 'group',
      width: 120,
      render: (text: string) => (
        <Tag color="blue">{text || '默认分组'}</Tag>
      ),
    },
    {
      title: '类型',
      dataIndex: 'task_type',
      key: 'task_type',
      width: 80,
      render: (type: string) => (
        <Tag color={type === 'http' ? 'green' : 'orange'}>
          {type === 'http' ? 'HTTP' : 'RPC'}
        </Tag>
      ),
    },
    {
      title: 'Cron表达式',
      dataIndex: 'cron_expression',
      key: 'cron_expression',
      width: 150,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean, record: Task) => (
        <Switch
          checked={enabled}
          onChange={(checked) => handleStatusToggle(record, checked)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      ),
    },
    {
      title: '最后执行',
      dataIndex: 'last_execution_at',
      key: 'last_execution_at',
      width: 150,
      render: (date: string) => (
        <span className="text-gray-600">
          {date ? formatDate(date) : '从未执行'}
        </span>
      ),
    },
    {
      title: '下次执行',
      dataIndex: 'next_execution_at',
      key: 'next_execution_at',
      width: 150,
      render: (date: string) => (
        <span className="text-blue-600">
          {date ? formatDate(date) : '未安排'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: Task) => (
        <Space size="small">
          <Button
            type="text"
            icon={<PlayCircleOutlined />}
            onClick={() => handleManualTrigger(record)}
            title="手动触发"
          />
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => openExecutions(record)}
            title="查看执行记录"
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEditTask(record)}
            title="编辑"
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteTask(record)}
            title="删除"
          />
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Card>
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">任务管理</h1>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreateTask}
              size="large"
            >
              创建任务
            </Button>
          </div>
          
          <div className="flex gap-4 mb-4">
            <Search
              placeholder="搜索任务名称或描述"
              allowClear
              onSearch={handleSearch}
              style={{ width: 300 }}
              className="flex-1"
            />
            <Select
              placeholder="状态筛选"
              allowClear
              style={{ width: 150 }}
              onChange={handleStatusFilterChange}
            >
              <Option value="true">启用</Option>
              <Option value="false">禁用</Option>
            </Select>
            <Select
              placeholder="分组筛选"
              allowClear
              style={{ width: 150 }}
              onChange={handleGroupFilterChange}
            >
              <Option value="">全部分组</Option>
              <Option value="default">默认分组</Option>
              <Option value="data-sync">数据同步</Option>
              <Option value="system-maintenance">系统维护</Option>
            </Select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <Table
            columns={columns}
            dataSource={tasks}
            loading={loading}
            rowKey="id"
            scroll={{ x: 'max-content' }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
          />
        </div>
      </Card>

      <Modal
        title={`执行记录 - ${selectedTask?.name || ''}`}
        open={execModalVisible}
        onCancel={() => setExecModalVisible(false)}
        footer={null}
        width={900}
        destroyOnClose
        bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
      >
        <div className="flex gap-3 mb-3">
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 140 }}
            value={execStatus}
            onChange={(v) => { setExecStatus(v); if (selectedTask) scheduleFetchExecutions(Number(selectedTask.id), 1, execLimit, v, execStart, execEnd); }}
          >
            <Option value="success">成功</Option>
            <Option value="failed">失败</Option>
            <Option value="skipped">跳过</Option>
            <Option value="running">运行中</Option>
            <Option value="pending">等待中</Option>
            <Option value="timeout">超时</Option>
          </Select>
          <Input
            type="datetime-local"
            value={execStart ? dayjs(execStart).format('YYYY-MM-DDTHH:mm') : ''}
            onChange={(e) => { const v = e.target.value ? dayjs(e.target.value).toISOString() : undefined; setExecStart(v); if (selectedTask) scheduleFetchExecutions(Number(selectedTask.id), 1, execLimit, execStatus, v, execEnd); }}
          />
          <Input
            type="datetime-local"
            value={execEnd ? dayjs(execEnd).format('YYYY-MM-DDTHH:mm') : ''}
            onChange={(e) => { const v = e.target.value ? dayjs(e.target.value).toISOString() : undefined; setExecEnd(v); if (selectedTask) scheduleFetchExecutions(Number(selectedTask.id), 1, execLimit, execStatus, execStart, v); }}
          />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <Table
            dataSource={execItems}
            loading={execLoading}
            rowKey="id"
            scroll={{ x: 'max-content', y: 420 }}
            pagination={{
              current: execPage,
              pageSize: execLimit,
              total: execTotal,
              showSizeChanger: true,
              showQuickJumper: true,
              onChange: (p, ps) => { setExecLimit(ps); if (selectedTask) scheduleFetchExecutions(Number(selectedTask.id), p, ps, execStatus, execStart, execEnd); }
            }}
            columns={[
              { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (s: string) => <Tag color={s === 'success' ? 'green' : s === 'failed' ? 'red' : s === 'running' ? 'blue' : s === 'skipped' ? 'orange' : 'default'}>{s}</Tag> },
              { title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 180, render: (t: string) => t ? formatDate(t) : '-' },
              { title: '结束时间', dataIndex: 'end_time', key: 'end_time', width: 180, render: (t: string) => t ? formatDate(t) : '-' },
              { title: '耗时(秒)', dataIndex: 'duration', key: 'duration', width: 100 },
              { title: '重试次数', dataIndex: 'retry_count', key: 'retry_count', width: 100 },
              { title: '触发类型', dataIndex: 'trigger_type', key: 'trigger_type', width: 120 },
              { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: (t: string) => t ? formatDate(t) : '-' },
              { title: '错误信息', dataIndex: 'error_message', key: 'error_message', ellipsis: true },
            ]}
          />
        </div>
      </Modal>

      <Modal
        title="确认删除"
        open={deleteModalVisible}
        onOk={confirmDelete}
        onCancel={() => setDeleteModalVisible(false)}
        okText="确认"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>确定要删除任务「{selectedTask?.name}」吗？</p>
        <p className="text-red-500">此操作不可恢复，相关的执行记录也会被删除。</p>
      </Modal>
    </div>
  );
};

export default TaskList;
