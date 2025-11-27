// 任务创建/编辑页面
import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Select, Button, Space, Steps, InputNumber, Switch, Divider, Tag, App as AntApp } from 'antd';
import { SaveOutlined, LeftOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useTaskStore } from '@/stores/taskStore';
import { api } from '@/lib/api';
import { Task, TaskType } from '@/types/task';

const { TextArea } = Input;
const { Option } = Select;
// const { Step } = Steps; // Removed - use Steps.Step directly

const TaskForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { currentTask, loading, fetchTaskById, createTask, updateTask } = useTaskStore();
  const { message } = AntApp.useApp();
  
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [parameters, setParameters] = useState<Array<{parameter_name: string, parameter_value: string, parameter_type: string, is_dynamic: boolean}>>([]);
  const [groups, setGroups] = useState<Array<{ id: number; name: string }>>([]);

  useEffect(() => {
    api.get<{ success: boolean; items: Array<{ id: number; name: string }> }>(`/task-groups`).then(res => {
      setGroups(res.items || []);
    }).catch(err => console.error('加载任务分组失败:', err));
  }, []);

  useEffect(() => {
    if (id) {
      fetchTaskById(id);
    }
  }, [id, fetchTaskById]);

  useEffect(() => {
    if (currentTask) {
      form.setFieldsValue({
        name: currentTask.name,
        description: currentTask.description,
        group_id: currentTask.group_id,
        cron_expression: currentTask.cron_expression,
        task_type: currentTask.task_type,
        task_config: typeof currentTask.task_config === 'string' ? currentTask.task_config : JSON.stringify(currentTask.task_config, null, 2),
        concurrent_control: currentTask.concurrent_control,
        timeout: currentTask.timeout,
        retry_count: currentTask.retry_count,
        enabled: currentTask.enabled,
      });
      if (currentTask.parameters) {
        setParameters(Array.isArray(currentTask.parameters) ? currentTask.parameters : []);
      }
    }
  }, [currentTask, form]);

  const steps = [
    {
      title: '基本信息',
      content: 'basic-info',
    },
    {
      title: '调度配置',
      content: 'schedule-config',
    },
    {
      title: '任务参数',
      content: 'task-params',
    },
    {
      title: '高级设置',
      content: 'advanced-settings',
    },
  ];

  const handleNext = () => {
    form.validateFields().then(() => {
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    }).catch(() => {
      message.error('请填写完整的必填信息');
    });
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async () => {
    try {
      // 跨步骤校验关键必填字段
      await form.validateFields(['name', 'task_type', 'cron_expression']);

      // 获取所有字段（含未挂载字段）
      const values = form.getFieldsValue(true);
      const taskData: any = {
        ...values,
        parameters: parameters,
      };

      // 将 group_id 转为数字（如果有）
      if (taskData.group_id !== undefined && taskData.group_id !== null) {
        const gid = Number(taskData.group_id);
        taskData.group_id = Number.isNaN(gid) ? undefined : gid;
      }

      if (typeof taskData.task_config === 'string') {
        try {
          taskData.task_config = JSON.parse(taskData.task_config);
        } catch {
          message.error('任务配置必须是有效的JSON');
          return;
        }
      }

      if (id) {
        await updateTask(id, taskData);
        message.success('任务更新成功');
      } else {
        await createTask(taskData);
        message.success('任务创建成功');
      }
      
      navigate('/tasks');
    } catch (error) {
      message.error('保存失败，请检查输入内容');
    }
  };

  const addParameter = () => {
    setParameters([...parameters, {
      parameter_name: '',
      parameter_value: '',
      parameter_type: 'string',
      is_dynamic: false,
    }]);
  };

  const removeParameter = (index: number) => {
    const newParams = parameters.filter((_, i) => i !== index);
    setParameters(newParams);
  };

  const updateParameter = (index: number, field: string, value: any) => {
    const newParams = [...parameters];
    newParams[index] = { ...newParams[index], [field]: value };
    setParameters(newParams);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <Form.Item
              label="任务名称"
              name="name"
              rules={[{ required: true, message: '请输入任务名称' }]}
            >
              <Input placeholder="请输入任务名称" />
            </Form.Item>
            
            <Form.Item
              label="任务描述"
              name="description"
            >
              <TextArea rows={3} placeholder="请输入任务描述" />
            </Form.Item>
            
            <Form.Item
              label="任务分组"
              name="group_id"
            >
              <Select placeholder="请选择任务分组">
                {groups.map(g => (
                  <Option key={g.id} value={g.id}>{g.name}</Option>
                ))}
              </Select>
            </Form.Item>
          </div>
        );
      
      case 1:
        return (
          <div className="space-y-6">
            <Form.Item
              label="任务类型"
              name="task_type"
              rules={[{ required: true, message: '请选择任务类型' }]}
            >
              <Select placeholder="请选择任务类型">
                <Option value="http">HTTP请求</Option>
                <Option value="rpc">RPC调用</Option>
              </Select>
            </Form.Item>
            
            <Form.Item
              label="Cron表达式"
              name="cron_expression"
              rules={[{ required: true, message: '请输入Cron表达式' }]}
              help="例如：0 2 * * * 表示每天凌晨2点执行"
            >
              <Input placeholder="0 2 * * *" />
            </Form.Item>
            
            <Form.Item
              label="任务配置"
              name="task_config"
              help="JSON格式的任务配置，根据任务类型不同而不同"
            >
              <TextArea rows={4} placeholder='{"url": "https://api.example.com", "method": "GET"}' />
            </Form.Item>
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">任务参数</h3>
              <Button type="dashed" icon={<PlusOutlined />} onClick={addParameter}>
                添加参数
              </Button>
            </div>
            
            {parameters.map((param, index) => (
              <Card key={index} size="small" className="mb-4">
                <div className="flex gap-4 items-center">
                  <Input
                    placeholder="参数名称"
                    value={param.parameter_name}
                    onChange={(e) => updateParameter(index, 'parameter_name', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="参数值"
                    value={param.parameter_value}
                    onChange={(e) => updateParameter(index, 'parameter_value', e.target.value)}
                    className="flex-1"
                  />
                  <Select
                    value={param.parameter_type}
                    onChange={(value) => updateParameter(index, 'parameter_type', value)}
                    style={{ width: 120 }}
                  >
                    <Option value="string">字符串</Option>
                    <Option value="number">数字</Option>
                    <Option value="boolean">布尔值</Option>
                    <Option value="json">JSON</Option>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={param.is_dynamic}
                      onChange={(checked) => updateParameter(index, 'is_dynamic', checked)}
                      checkedChildren="动态"
                      unCheckedChildren="静态"
                    />
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeParameter(index)}
                    />
                  </div>
                </div>
              </Card>
            ))}
            
            {parameters.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                暂无任务参数，点击上方按钮添加
              </div>
            )}
          </div>
        );
      
      case 3:
        return (
          <div className="space-y-6">
            <Form.Item
              label="并发控制"
              name="concurrent_control"
              valuePropName="checked"
              help="启用后，如果上次任务未结束，本次任务将跳过执行"
            >
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
            
            <Form.Item
              label="超时时间（秒）"
              name="timeout"
              rules={[{ required: true, message: '请输入超时时间' }]}
            >
              <InputNumber min={1} max={3600} style={{ width: '100%' }} />
            </Form.Item>
            
            <Form.Item
              label="重试次数"
              name="retry_count"
              rules={[{ required: true, message: '请输入重试次数' }]}
            >
              <InputNumber min={0} max={10} style={{ width: '100%' }} />
            </Form.Item>
            
            <Form.Item
              label="启用任务"
              name="enabled"
              valuePropName="checked"
            >
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <Card>
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {id ? '编辑任务' : '创建任务'}
            </h1>
            <Button icon={<LeftOutlined />} onClick={() => navigate('/tasks')}>
              返回列表
            </Button>
          </div>
          
          <Steps current={currentStep} items={steps.map(item => ({ key: item.content, title: item.title }))} />
        </div>

        <Form form={form} layout="vertical" className="mt-8">
          {renderStepContent()}
        </Form>

        <div className="flex justify-between mt-8">
          <Button onClick={handlePrev} disabled={currentStep === 0}>
            上一步
          </Button>
          <div className="space-x-4">
            {currentStep === steps.length - 1 ? (
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
                保存任务
              </Button>
            ) : (
              <Button type="primary" onClick={handleNext}>
                下一步
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default TaskForm;
