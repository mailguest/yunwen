export interface Task {
  id: string;
  name: string;
  description?: string;
  group_id?: string;
  cron_expression: string;
  task_type: 'http' | 'rpc';
  task_config: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    timeout?: number;
    service?: string;
    endpoint?: string;
    [key: string]: any;
  };
  concurrent_control: boolean;
  timeout: number;
  retry_count: number;
  enabled: boolean;
  last_execution_at?: string;
  next_execution_at?: string;
  parameters: Array<{
    parameter_name: string;
    parameter_value: string;
    parameter_type: 'string' | 'number' | 'boolean' | 'json';
    is_dynamic: boolean;
  }>;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskCreate {
  name: string;
  description?: string;
  group_id?: string;
  cron_expression: string;
  task_type: 'http' | 'rpc';
  task_config: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    timeout?: number;
    service?: string;
    endpoint?: string;
    [key: string]: any;
  };
  concurrent_control: boolean;
  timeout: number;
  retry_count: number;
  enabled: boolean;
  parameters: Array<{
    parameter_name: string;
    parameter_value: string;
    parameter_type: 'string' | 'number' | 'boolean' | 'json';
    is_dynamic: boolean;
  }>;
}

export interface TaskUpdate {
  name?: string;
  description?: string;
  group_id?: string;
  cron_expression?: string;
  task_type?: 'http' | 'rpc';
  task_config?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    timeout?: number;
    service?: string;
    endpoint?: string;
    [key: string]: any;
  };
  concurrent_control?: boolean;
  timeout?: number;
  retry_count?: number;
  enabled?: boolean;
  parameters?: Array<{
    parameter_name: string;
    parameter_value: string;
    parameter_type: 'string' | 'number' | 'boolean' | 'json';
    is_dynamic: boolean;
  }>;
}

export interface TaskType {
  value: 'http' | 'rpc';
  label: string;
}

export interface TaskListResponse {
  items: Task[];
  total: number;
  skip: number;
  limit: number;
}