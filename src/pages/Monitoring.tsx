import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Alert, Table, Tag, Button, Modal, Form, Input, Select, App as AntApp } from 'antd';
import { toast } from 'sonner';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ClockCircleOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { SystemHealth } from '@/types';

const Monitoring: React.FC = () => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const { message } = AntApp.useApp();
  const [alertVisible, setAlertVisible] = useState(false);
  const [ruleForm] = Form.useForm();
  const [tasks, setTasks] = useState<Array<{ id: number; name: string }>>([]);
  const [rules, setRules] = useState<Array<any>>([]);
  const [rulesLoading, setRulesLoading] = useState(false);

  useEffect(() => {
    fetchMonitoringData();
  }, []);

  const fetchMonitoringData = async () => {
    try {
      setLoading(true);
      
      const healthRes = await api.get<SystemHealth>('/monitoring/system/health');
      setSystemHealth(healthRes);
    } catch (error) {
      console.error('获取监控数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const openAlertModal = () => {
    setAlertVisible(true);
  };

  useEffect(() => {
    if (alertVisible) {
      (async () => {
        try {
          const t = await api.get<any>('/tasks?limit=100');
          const items = Array.isArray(t.items) ? t.items.map((x: any) => ({ id: x.id, name: x.name })) : [];
          setTasks(items);
          setRulesLoading(true);
          const r = await api.get<any>('/notifications/rules');
          setRules(Array.isArray(r.items) ? r.items : []);
          setRulesLoading(false);
        } catch (e) {
          setTasks([]);
          setRules([]);
          setRulesLoading(false);
        }
      })();
    }
  }, [alertVisible]);

  const submitAlert = async () => {
    try {
      const values = await alertForm.validateFields();
      await api.post('/notifications/send', values);
      message.success('通知已发送');
      setAlertVisible(false);
    } catch (e: any) {
      message.error('发送失败');
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

  // 已移除不稳定的 Gauge 配置，统一用 Antd Progress 展示

  return (
    <div className="space-y-6">
      {/* 系统状态总览 */}
      <Card 
        title="系统状态总览" 
        loading={loading}
        extra={<Button type="link" icon={<ReloadOutlined />} onClick={fetchMonitoringData}>刷新</Button>}
      >
        <Alert
          title={statusMessage}
          type={systemStatus}
          showIcon
          className="mb-4"
        />
        
        <Row gutter={16}>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="数据库状态"
                value={systemHealth?.database_status?.status === 'connected' ? '正常' : '异常'}
                prefix={<DatabaseOutlined />}
                styles={{ content: { color: systemHealth?.database_status?.status === 'connected' ? '#3f8600' : '#cf1322' } }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="调度器状态"
                value={systemHealth?.scheduler_status?.status === 'running' ? '运行中' : '停止'}
                prefix={<ClockCircleOutlined />}
                styles={{ content: { color: systemHealth?.scheduler_status?.status === 'running' ? '#3f8600' : '#cf1322' } }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="Redis状态"
                value={systemHealth?.redis_status?.status === 'connected' ? '正常' : '异常'}
                prefix={<CloudServerOutlined />}
                styles={{ content: { color: systemHealth?.redis_status?.status === 'connected' ? '#3f8600' : '#cf1322' } }}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 移除示例的系统资源监控，仅保留真实指标展示 */}

      {/* 已按要求移除“今日执行趋势”可视化 */}

      {/* 服务详情（移除 Redis 示例，仅展示数据库与调度器） */}
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
            {
              title: '服务',
              dataIndex: 'service',
              key: 'service',
            },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              render: (status: string) => {
                const color = status === 'connected' || status === 'running' ? 'green' : 'red';
                const text = status === 'connected' || status === 'running' ? '正常' : '异常';
                return <Tag color={color}>{text}</Tag>;
              }
            },
            {
              title: '响应时间(ms)',
              dataIndex: 'response_time',
              key: 'response_time',
              render: (time: number) => time ? `${time}ms` : '-',
            },
            {
              title: '最后检查',
              dataIndex: 'last_check',
              key: 'last_check',
              render: (time: string) => time ? new Date(time).toLocaleString() : '-',
            },
          ]}
          rowKey="service"
          pagination={false}
        />
      </Card>

      {/* 底部操作已移除，根据要求不再显示导出与设置告警，刷新按钮已移动到标题旁 */}

    </div>
  );
};

export default Monitoring;
