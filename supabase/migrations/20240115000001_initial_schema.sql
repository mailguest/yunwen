-- 设置搜索路径到demo1模式
SET search_path TO demo1;

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'guest')),
    is_active BOOLEAN DEFAULT true,
    avatar_url TEXT,
    full_name VARCHAR(255),
    phone VARCHAR(20),
    department VARCHAR(100),
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建任务组表
CREATE TABLE IF NOT EXISTS task_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建任务表
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    group_id INTEGER REFERENCES task_groups(id),
    cron_expression VARCHAR(100) NOT NULL,
    task_type VARCHAR(20) NOT NULL CHECK (task_type IN ('http', 'rpc')),
    task_config JSONB NOT NULL,
    concurrent_control BOOLEAN DEFAULT false,
    timeout INTEGER DEFAULT 300,
    retry_count INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT true,
    last_execution_at TIMESTAMP,
    next_execution_at TIMESTAMP,
    parameters JSONB DEFAULT '[]'::jsonb,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建任务执行记录表
CREATE TABLE IF NOT EXISTS task_executions (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed', 'skipped', 'timeout')),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration INTEGER, -- 执行耗时（秒）
    output TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    execution_context JSONB DEFAULT '{}'::jsonb,
    trigger_type VARCHAR(20) NOT NULL CHECK (trigger_type IN ('scheduled', 'manual', 'retry', 'api')),
    triggered_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    config_type VARCHAR(20) NOT NULL CHECK (config_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    is_secret BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建通知配置表
CREATE TABLE IF NOT EXISTS notification_configs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    notification_type VARCHAR(20) NOT NULL CHECK (notification_type IN ('email', 'webhook', 'dingtalk', 'wechat')),
    config JSONB NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建系统日志表
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')),
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    logger_name VARCHAR(255),
    request_id VARCHAR(100),
    user_id INTEGER REFERENCES users(id),
    task_id INTEGER REFERENCES tasks(id),
    execution_id INTEGER REFERENCES task_executions(id),
    context JSONB DEFAULT '{}'::jsonb
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_tasks_group_id ON tasks(group_id);
CREATE INDEX IF NOT EXISTS idx_tasks_enabled ON tasks(enabled);
CREATE INDEX IF NOT EXISTS idx_tasks_next_execution ON tasks(next_execution_at);
CREATE INDEX IF NOT EXISTS idx_task_executions_task_id ON task_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_executions_status ON task_executions(status);
CREATE INDEX IF NOT EXISTS idx_task_executions_created_at ON task_executions(created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_task_id ON system_logs(task_id);

-- 插入默认管理员用户（密码：admin123）
INSERT INTO users (email, username, password_hash, role, is_active, created_at, updated_at) 
VALUES (
    'admin@example.com', 
    'admin', 
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- 这是bcrypt加密的admin123
    'admin', 
    true, 
    CURRENT_TIMESTAMP, 
    CURRENT_TIMESTAMP
) ON CONFLICT (email) DO NOTHING;

-- 插入测试用户（密码：user123）
INSERT INTO users (email, username, password_hash, role, is_active, created_at, updated_at) 
VALUES (
    'user@example.com', 
    'user', 
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- 这是bcrypt加密的user123
    'user', 
    true, 
    CURRENT_TIMESTAMP, 
    CURRENT_TIMESTAMP
) ON CONFLICT (email) DO NOTHING;

-- 插入演示用户（密码：demo123）
INSERT INTO users (email, username, password_hash, role, is_active, created_at, updated_at) 
VALUES (
    'demo@example.com', 
    'demo', 
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- 这是bcrypt加密的demo123
    'user', 
    true, 
    CURRENT_TIMESTAMP, 
    CURRENT_TIMESTAMP
) ON CONFLICT (email) DO NOTHING;

-- 插入默认任务组
INSERT INTO task_groups (name, description, created_by, created_at, updated_at) 
VALUES 
    ('系统任务', '系统级别的定时任务', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('业务任务', '业务相关的定时任务', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('监控任务', '系统监控相关的任务', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- 插入示例任务
INSERT INTO tasks (
    name, description, group_id, cron_expression, task_type, task_config, 
    concurrent_control, timeout, retry_count, enabled, parameters, created_by, created_at, updated_at
) VALUES 
(
    '健康检查', 
    '每分钟检查系统健康状态', 
    3, 
    '0 * * * * *', 
    'http', 
    '{"url": "http://localhost:3001/health", "method": "GET"}', 
    false, 
    30, 
    3, 
    true, 
    '[]'::jsonb, 
    1, 
    CURRENT_TIMESTAMP, 
    CURRENT_TIMESTAMP
),
(
    '数据备份', 
    '每天凌晨2点执行数据备份', 
    1, 
    '0 0 2 * * *', 
    'http', 
    '{"url": "http://localhost:3001/api/backup", "method": "POST"}', 
    true, 
    3600, 
    1, 
    true, 
    '[{"parameter_name": "backup_type", "parameter_value": "full", "parameter_type": "string", "is_dynamic": false}]'::jsonb, 
    1, 
    CURRENT_TIMESTAMP, 
    CURRENT_TIMESTAMP
),
(
    '日志清理', 
    '每周清理30天前的日志', 
    1, 
    '0 0 3 * * 0', 
    'http', 
    '{"url": "http://localhost:3001/api/logs/cleanup", "method": "DELETE"}', 
    false, 
    300, 
    2, 
    true, 
    '[{"parameter_name": "days_to_keep", "parameter_value": "30", "parameter_type": "number", "is_dynamic": false}]'::jsonb, 
    1, 
    CURRENT_TIMESTAMP, 
    CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为所有表创建更新时间触发器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_task_groups_updated_at BEFORE UPDATE ON task_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_task_executions_updated_at BEFORE UPDATE ON task_executions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_configs_updated_at BEFORE UPDATE ON system_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notification_configs_updated_at BEFORE UPDATE ON notification_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();