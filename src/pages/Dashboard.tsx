import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Progress, Table, Tag, Button, Alert } from 'antd';
import { 
  ScheduleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ClockCircleOutlined,
  BarChartOutlined,
  RiseOutlined,
  DatabaseOutlined,
  CloudServerOutlined
  , PauseCircleOutlined
} from '@ant-design/icons';
import { } from '@ant-design/charts';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { DashboardStats, ExecutionTrend, TaskPerformance, SystemHealth } from '@/types';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trends, setTrends] = useState<ExecutionTrend[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [performance, setPerformance] = useState<TaskPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // 并行获取所有仪表板数据
      const [statsRes, trendsRes, healthRes, performanceRes] = await Promise.all([
        api.get<DashboardStats>('/monitoring/dashboard/stats'),
        api.get<ExecutionTrend[]>('/monitoring/executions/trends?days=7'),
        api.get<SystemHealth>('/monitoring/system/health'),
        api.get<TaskPerformance[]>('/monitoring/tasks/performance?limit=5')
      ]);

      setStats(statsRes);
      setTrends(trendsRes);
      setSystemHealth(healthRes);
      setPerformance(performanceRes);
    } catch (error) {
      console.error('获取仪表板数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const systemStatus = systemHealth ? (
    systemHealth.status === 'healthy' ? 'success' :
    systemHealth.status === 'warning' ? 'warning' : 'error'
  ) : 'info';
  const statusMessage = systemHealth ? (
    systemHealth.status === 'healthy' ? '系统运行正常' :
    systemHealth.status === 'warning' ? '系统存在警告' : '系统异常'
  ) : '正在检查系统状态...';

  const latestTrend = trends.length ? trends[trends.length - 1] : null;
  const statusPieData = latestTrend ? [
    { type: '成功', value: latestTrend.success_count ?? 0 },
    { type: '失败', value: (latestTrend.failed_count ?? latestTrend.failure_count ?? 0) },
    { type: '跳过', value: latestTrend.skipped_count ?? 0 }
  ] : (stats ? [
    { type: '成功', value: stats.total_successful_executions || 0 },
    { type: '失败', value: stats.total_failed_executions || 0 },
    { type: '跳过', value: stats.total_skipped_executions || 0 }
  ] : []);
  const statusPieTotal = statusPieData.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  const statusPieDataChart = statusPieData.filter((d: any) => (Number(d.value) || 0) > 0);
  const isSingleSlice = statusPieDataChart.length === 1;
  const pieAngleField = isSingleSlice ? 'percent' : 'value';
  const pieChartData = isSingleSlice
    ? [{ type: statusPieDataChart[0].type, percent: 1 }]
    : statusPieDataChart;

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'task_name',
      key: 'task_name',
      render: (text: string) => <span className="font-medium">{text}</span>
    },
    {
      title: '成功率',
      dataIndex: 'success_rate',
      key: 'success_rate',
      render: (rate: number) => (
        <Progress 
          percent={Math.round(rate * 100)} 
          size="small"
          strokeColor={rate >= 0.9 ? '#52c41a' : rate >= 0.7 ? '#faad14' : '#ff4d4f'}
        />
      )
    },
    {
      title: '平均执行时间',
      dataIndex: 'avg_duration',
      key: 'avg_duration',
      render: (duration: number) => `${(duration / 1000).toFixed(2)}s`
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: any) => {
        const enabled = !!record?.enabled;
        const failures24 = Number(record?.recent_failures_24h ?? 0);
        let text = '健康';
        let color = 'green';
        if (!enabled) {
          text = '停用';
          color = 'default';
        } else if (failures24 > 0) {
          text = '异常';
          color = 'red';
        }
        return <Tag color={color}>{text}</Tag>;
      }
    }
  ];

  return (
    <div className="space-y-6">
      {/* 统计卡片 - 单行排列 */}
      <Row gutter={16} wrap={false}>
        <Col flex={1}>
          <Card>
            <Statistic
              title="任务总数"
              value={stats?.total_tasks || 0}
              prefix={<ScheduleOutlined className="text-blue-500" />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col flex={1}>
          <Card>
            <Statistic
              title="运行中任务"
              value={stats?.enabled_tasks || 0}
              prefix={<ClockCircleOutlined className="text-green-500" />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col flex={1}>
          <Card>
            <Statistic
              title="成功执行"
              value={stats?.total_successful_executions || 0}
              prefix={<CheckCircleOutlined className="text-green-500" />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col flex={1}>
          <Card>
            <Statistic
              title="跳过执行"
              value={stats?.total_skipped_executions || 0}
              prefix={<PauseCircleOutlined className="text-yellow-500" />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col flex={1}>
          <Card>
            <Statistic
              title="失败执行"
              value={stats?.total_failed_executions || 0}
              prefix={<CloseCircleOutlined className="text-red-500" />}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      {/* 应用监控替换图表区域 */}
      <Row gutter={16}>
        <Col span={24}>
          <Card title="系统状态总览" loading={loading}>
            <Alert title={statusMessage} type={systemStatus as any} showIcon className="mb-4" />
            <Row gutter={16}>
              <Col span={8}>
                <Card size="small" styles={{ body: { minHeight: 120, display: 'flex', alignItems: 'center' } }}>
                  <Statistic
                    title="数据库状态"
                    value={systemHealth?.database_status?.status === 'connected' ? '正常' : '异常'}
                    prefix={<DatabaseOutlined />}
                    styles={{ content: { color: systemHealth?.database_status?.status === 'connected' ? '#3f8600' : '#cf1322' } }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" styles={{ body: { minHeight: 120, display: 'flex', alignItems: 'center' } }}>
                  <Statistic
                    title="调度器状态"
                    value={systemHealth?.scheduler_status?.status === 'running' ? '运行中' : '停止'}
                    prefix={<ClockCircleOutlined />}
                    styles={{ content: { color: systemHealth?.scheduler_status?.status === 'running' ? '#3f8600' : '#cf1322' } }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" styles={{ body: { minHeight: 120, display: 'flex', alignItems: 'center' } }}>
                  <Statistic
                    title="Redis状态"
                    value={
                      systemHealth?.redis_status?.status === 'connected'
                        ? '正常'
                        : systemHealth?.redis_status?.status === 'unknown'
                        ? '未配置'
                        : '异常'
                    }
                    prefix={<CloudServerOutlined />}
                    styles={{ content: { color:
                      systemHealth?.redis_status?.status === 'connected'
                        ? '#3f8600'
                        : systemHealth?.redis_status?.status === 'unknown'
                        ? undefined
                        : '#cf1322' } }}
                  />
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={24}>
          <Card title="服务详情" loading={loading}>
            <Table
              dataSource={[
                {
                  service: '数据库',
                  status: systemHealth?.database_status?.status,
                  response_time: systemHealth?.database_status?.response_time,
                  last_check: systemHealth?.database_status?.last_check,
                },
                {
                  service: '调度器',
                  status: systemHealth?.scheduler_status?.status,
                  response_time: systemHealth?.scheduler_status?.response_time,
                  last_check: systemHealth?.scheduler_status?.last_check,
                },
              ]}
              columns={[
                { title: '服务', dataIndex: 'service', key: 'service' },
                { title: '状态', dataIndex: 'status', key: 'status', render: (status: string) => {
                    const color = status === 'connected' || status === 'running' ? 'green' : 'red';
                    const text = status === 'connected' || status === 'running' ? '正常' : '异常';
                    return <Tag color={color}>{text}</Tag>;
                  } },
                { title: '响应时间(ms)', dataIndex: 'response_time', key: 'response_time', render: (time: number) => time ? `${time}ms` : '-' },
                { title: '最后检查', dataIndex: 'last_check', key: 'last_check', render: (time: string) => time ? new Date(time).toLocaleString() : '-' },
              ]}
              rowKey="service"
              pagination={false}
            />
          </Card>
        </Col>
      </Row>

      {/* 任务性能表格 */}
      <Card title="任务性能排行" loading={loading}>
        <Table
          columns={columns}
          dataSource={performance}
          rowKey="task_id"
          pagination={false}
          size="small"
        />
      </Card>

      {/* 快速操作区域已移除 */}
    </div>
  );
};

export default Dashboard;
