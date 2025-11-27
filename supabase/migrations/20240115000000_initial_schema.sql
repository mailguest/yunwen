-- 智能定时任务控制平台 - 初始数据库结构
-- 创建时间: 2024-01-15
-- 描述: 创建用户、任务、执行记录等核心表结构

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'guest')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 任务分组表
CREATE TABLE task_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 任务表
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    group_id UUID REFERENCES task_groups(id) ON DELETE SET NULL,
    cron_expression VARCHAR(100) NOT NULL,
    task_type VARCHAR(20) CHECK (task_type IN ('http', 'rpc')) NOT NULL,
    task_config JSONB NOT NULL DEFAULT '{}',
    concurrent_control BOOLEAN DEFAULT true,
    timeout INTEGER DEFAULT 300 CHECK (timeout > 0),
    retry_count INTEGER DEFAULT 3 CHECK (retry_count >= 0),
    enabled BOOLEAN DEFAULT true,
    last_execution_at TIMESTAMP WITH TIME ZONE,
    next_execution_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 任务参数表
CREATE TABLE task_parameters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    parameter_name VARCHAR(100) NOT NULL,
    parameter_value TEXT,
    parameter_type VARCHAR(20) DEFAULT 'string' CHECK (parameter_type IN ('string', 'number', 'boolean', 'json')),
    is_dynamic BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(task_id, parameter_name)
);

-- 执行记录表
CREATE TABLE executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    status VARCHAR(20) CHECK (status IN ('pending', 'running', 'success', 'failed', 'skipped', 'timeout')) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- 执行时长（秒）
    output TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    execution_context JSONB DEFAULT '{}', -- 执行上下文信息
    trigger_type VARCHAR(20) DEFAULT 'scheduled' CHECK (trigger_type IN ('scheduled', 'manual', 'retry', 'api')),
    triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 系统配置表
CREATE TABLE system_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    config_type VARCHAR(20) DEFAULT 'string' CHECK (config_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    is_secret BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 操作日志表
CREATE TABLE operation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    operation_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    operation_detail JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 通知配置表
CREATE TABLE notification_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    notification_type VARCHAR(20) CHECK (notification_type IN ('email', 'webhook', 'dingtalk', 'wechat')) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 任务通知关联表
CREATE TABLE task_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    notification_config_id UUID REFERENCES notification_configs(id) ON DELETE CASCADE,
    notify_on_success BOOLEAN DEFAULT false,
    notify_on_failure BOOLEAN DEFAULT true,
    notify_on_retry BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(task_id, notification_config_id)
);

-- 创建索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

CREATE INDEX idx_task_groups_name ON task_groups(name);
CREATE INDEX idx_task_groups_created_by ON task_groups(created_by);

CREATE INDEX idx_tasks_group_id ON tasks(group_id);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_enabled ON tasks(enabled);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_tasks_next_execution_at ON tasks(next_execution_at);
CREATE INDEX idx_tasks_task_type ON tasks(task_type);

CREATE INDEX idx_task_parameters_task_id ON task_parameters(task_id);
CREATE INDEX idx_task_parameters_parameter_name ON task_parameters(parameter_name);

CREATE INDEX idx_executions_task_id ON executions(task_id);
CREATE INDEX idx_executions_status ON executions(status);
CREATE INDEX idx_executions_start_time ON executions(start_time DESC);
CREATE INDEX idx_executions_created_at ON executions(created_at DESC);
CREATE INDEX idx_executions_trigger_type ON executions(trigger_type);

CREATE INDEX idx_operation_logs_user_id ON operation_logs(user_id);
CREATE INDEX idx_operation_logs_operation_type ON operation_logs(operation_type);
CREATE INDEX idx_operation_logs_resource_type ON operation_logs(resource_type);
CREATE INDEX idx_operation_logs_created_at ON operation_logs(created_at DESC);

CREATE INDEX idx_task_notifications_task_id ON task_notifications(task_id);
CREATE INDEX idx_task_notifications_notification_config_id ON task_notifications(notification_config_id);

-- 创建函数：自动更新updated_at字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器：自动更新updated_at字段
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_groups_updated_at BEFORE UPDATE ON task_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_configs_updated_at BEFORE UPDATE ON system_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_configs_updated_at BEFORE UPDATE ON notification_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建函数：计算下次执行时间
CREATE OR REPLACE FUNCTION calculate_next_execution(cron_expr TEXT, current_time TIMESTAMP WITH TIME ZONE)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    -- 这里应该实现cron表达式解析，暂时返回简单的计算结果
    -- 实际项目中需要使用专业的cron解析库
    RETURN current_time + INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- 创建函数：记录操作日志
CREATE OR REPLACE FUNCTION log_operation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO operation_logs (user_id, operation_type, resource_type, resource_id, operation_detail)
        VALUES (current_setting('app.current_user_id', true)::UUID, 'delete', TG_TABLE_NAME, OLD.id, row_to_json(OLD));
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO operation_logs (user_id, operation_type, resource_type, resource_id, operation_detail)
        VALUES (current_setting('app.current_user_id', true)::UUID, 'update', TG_TABLE_NAME, NEW.id, jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW)));
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO operation_logs (user_id, operation_type, resource_type, resource_id, operation_detail)
        VALUES (current_setting('app.current_user_id', true)::UUID, 'create', TG_TABLE_NAME, NEW.id, row_to_json(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 创建视图：任务统计视图
CREATE VIEW task_statistics AS
SELECT 
    t.id,
    t.name,
    t.enabled,
    t.last_execution_at,
    t.next_execution_at,
    COUNT(e.id) as total_executions,
    COUNT(CASE WHEN e.status = 'success' THEN 1 END) as success_count,
    COUNT(CASE WHEN e.status = 'failed' THEN 1 END) as failure_count,
    AVG(CASE WHEN e.duration IS NOT NULL THEN e.duration END) as avg_duration,
    MAX(e.created_at) as last_execution_time
FROM tasks t
LEFT JOIN executions e ON t.id = e.task_id
GROUP BY t.id, t.name, t.enabled, t.last_execution_at, t.next_execution_at;

-- 创建视图：最近执行记录视图
CREATE VIEW recent_executions AS
SELECT 
    e.*,
    t.name as task_name,
    t.task_type,
    g.name as group_name
FROM executions e
JOIN tasks t ON e.task_id = t.id
LEFT JOIN task_groups g ON t.group_id = g.id
WHERE e.created_at >= NOW() - INTERVAL '7 days'
ORDER BY e.created_at DESC;

-- 插入默认数据
INSERT INTO users (email, username, password_hash, role, is_active) VALUES 
('admin@scheduler.com', 'admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PJ/..G', 'admin', true);

INSERT INTO task_groups (name, description, created_by) VALUES 
('默认分组', '系统默认任务分组', (SELECT id FROM users WHERE username = 'admin')),
('数据同步', '数据同步相关任务', (SELECT id FROM users WHERE username = 'admin')),
('系统维护', '系统维护和清理任务', (SELECT id FROM users WHERE username = 'admin'));

INSERT INTO system_configs (config_key, config_value, config_type, description) VALUES 
('max_concurrent_tasks', '10', 'number', '最大并发任务数'),
('default_task_timeout', '300', 'number', '默认任务超时时间（秒）'),
('default_retry_count', '3', 'number', '默认重试次数'),
('log_retention_days', '30', 'number', '日志保留天数'),
('enable_email_notifications', 'true', 'boolean', '是否启用邮件通知'),
('system_timezone', 'Asia/Shanghai', 'string', '系统时区');