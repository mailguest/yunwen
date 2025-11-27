// 类型定义

export interface User {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'user' | 'guest';
  is_active: boolean;
  created_at: string;
  avatar_url?: string;
  full_name?: string;
  phone?: string;
  department?: string;
  position?: string;
  last_login?: string;
}

export interface TaskPerformance {
  task_id: string;
  task_name: string;
  enabled?: boolean;
  success_rate: number;
  avg_duration: number;
  total_executions: number;
  recent_failures: number;
  recent_failures_24h?: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'warning';
  message: string;
  components: {
    database: 'healthy' | 'unhealthy';
    scheduler: 'healthy' | 'unhealthy';
    executor: 'healthy' | 'unhealthy';
  };
  timestamp: string;
  system_stats?: {
    cpu_percent: number;
    memory_percent: number;
    disk_percent: number;
  };
  database_status?: {
    status: 'connected' | 'disconnected';
    response_time: number;
    last_check: string;
  };
  scheduler_status?: {
    status: 'running' | 'stopped';
    response_time: number;
    last_check: string;
  };
  redis_status?: {
    status: 'connected' | 'disconnected';
    response_time: number;
    last_check: string;
  };
}

export interface LogEntry {
  id: string;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  timestamp: string;
  logger_name: string;
  request_id?: string;
  user_id?: string;
  task_id?: string;
  execution_id?: string;
  context?: Record<string, any>;
}

export interface TaskGroup {
  id: string;
  name: string;
  description?: string;
  created_by?: string;
  created_at: string;
}

export interface TaskParameter {
  parameter_name: string;
  parameter_value: string;
  parameter_type: 'string' | 'number' | 'boolean' | 'json';
  is_dynamic: boolean;
}

export interface TaskConfig {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;
  service?: string;
  endpoint?: string;
  [key: string]: any;
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  group_id?: string;
  group?: TaskGroup;
  cron_expression: string;
  task_type: 'http' | 'rpc';
  task_config: TaskConfig;
  concurrent_control: boolean;
  timeout: number;
  retry_count: number;
  enabled: boolean;
  last_execution_at?: string;
  next_execution_at?: string;
  parameters: TaskParameter[];
  created_by?: string;
  creator?: User;
  created_at: string;
  updated_at: string;
}

export interface TaskCreate {
  name: string;
  description?: string;
  group_id?: string;
  cron_expression: string;
  task_type: 'http' | 'rpc';
  task_config: TaskConfig;
  concurrent_control: boolean;
  timeout: number;
  retry_count: number;
  enabled: boolean;
  parameters: TaskParameter[];
}

export interface TaskUpdate {
  name?: string;
  description?: string;
  group_id?: string;
  cron_expression?: string;
  task_type?: 'http' | 'rpc';
  task_config?: TaskConfig;
  concurrent_control?: boolean;
  timeout?: number;
  retry_count?: number;
  enabled?: boolean;
  parameters?: TaskParameter[];
}

export interface TaskListResponse {
  items: Task[];
  total: number;
  skip: number;
  limit: number;
}

export interface ExecutionStatus {
  id: string;
  task_id: string;
  task?: Task;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'timeout';
  start_time?: string;
  end_time?: string;
  duration?: number;
  output?: string;
  error_message?: string;
  retry_count: number;
  execution_context?: Record<string, any>;
  trigger_type: 'scheduled' | 'manual' | 'retry' | 'api';
  triggered_by?: string;
  triggered_by_user?: User;
  created_at: string;
}

export interface ExecutionListResponse {
  items: ExecutionStatus[];
  total: number;
  skip: number;
  limit: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface SystemConfig {
  id: string;
  config_key: string;
  config_value: string;
  config_type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  is_secret: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationConfig {
  id: string;
  name: string;
  notification_type: 'email' | 'webhook' | 'dingtalk' | 'wechat';
  config: Record<string, any>;
  enabled: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_tasks: number;
  enabled_tasks: number;
  running_executions: number;
  total_executions: number;
  success_rate: number;
  avg_duration: number;
  active_tasks?: number;
  total_successful_executions?: number;
  total_failed_executions?: number;
  total_skipped_executions?: number;
}

export interface ExecutionTrend {
  date: string;
  total_count: number;
  success_count: number;
  failure_count: number;
  success_rate: number;
  avg_duration: number;
  failed_count?: number;
  skipped_count?: number;
}
