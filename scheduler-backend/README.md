# 智能定时任务控制平台

企业级智能定时任务调度平台，支持HTTP/RPC任务类型，提供可视化的任务管理和监控功能。

## 功能特性

- 🚀 **智能调度**: 支持HTTP/RPC任务类型，cron表达式配置
- 🔄 **并发控制**: 上次任务未结束时跳过本次任务执行  
- 📊 **参数管理**: 支持动态参数和静态参数传入
- 📋 **分组管理**: 支持任务分组和权限控制
- 📈 **实时监控**: 实时任务状态监控和执行历史追踪
- 📝 **日志系统**: 集成Loguru，按天保存日志文件
- 🐳 **容器化部署**: 完整的Docker支持和UV包管理
- 🔧 **高可用设计**: 集群部署支持和故障自动恢复

## 技术栈

### 前端
- React 18 + TypeScript 5
- Vite 5 + TailwindCSS 3
- Ant Design 5 + Zustand

### 后端  
- FastAPI 0.104 + Python 3.11
- APScheduler 3.10 + Pydantic 2.5
- PostgreSQL 16 + SQLAlchemy 2.0
- Redis 7.2 + Loguru 0.7

## 快速开始

### 环境要求
- Python 3.11+
- Node.js 18+
- PostgreSQL 16+
- Redis 7.2+

### 安装依赖

```bash
# 安装UV包管理器
curl -LsSf https://astral.sh/uv/install.sh | sh

# 安装Python依赖
uv pip install -r scheduler-backend/pyproject.toml

# 安装前端依赖  
npm install
```

### 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置文件
vim .env
```

### 数据库初始化

```bash
# 运行数据库迁移
alembic upgrade head
```

### 启动服务

```bash
# 启动后端服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 启动前端服务
npm run dev
```

## 项目结构

```
.
├── src/                    # 前端代码
│   ├── components/         # React组件
│   ├── pages/             # 页面组件
│   ├── hooks/             # 自定义Hooks
│   └── lib/               # 工具函数
├── api/                   # Express后端API
├── scheduler-backend/     # Python调度服务
│   ├── app/               # FastAPI应用
│   ├── scheduler/         # 调度引擎
│   └── models/            # 数据模型
├── supabase/              # 数据库迁移
└── docker/               # Docker配置
```

## API文档

启动服务后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 许可证

MIT License