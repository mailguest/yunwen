# 智能定时任务控制平台

一个基于FastAPI和React的现代化任务调度系统，支持HTTP/RPC任务、并发控制、参数管理、分组功能和完整的监控体系。

## 🌟 核心特性

- **动态任务配置**: 支持HTTP和RPC（包括Java Dubbo）任务类型
- **智能调度**: 基于cron表达式的灵活调度策略
- **并发控制**: 防止任务重复执行，支持跳过策略
- **参数管理**: 支持动态和静态参数配置
- **任务分组**: 灵活的任务分组管理
- **执行历史**: 完整的任务执行记录和日志
- **实时监控**: 系统健康监控和性能统计
- **现代化UI**: 基于React和Ant Design的响应式界面
- **Docker部署**: 完整的容器化部署方案
- **UV包管理**: 现代化的Python包管理

## 🏗️ 技术架构

### 后端技术栈
- **框架**: FastAPI 0.104+
- **语言**: Python 3.11+
- **数据库**: PostgreSQL 16+
- **缓存**: Redis 7.2+
- **调度**: APScheduler 3.10+
- **ORM**: SQLAlchemy 2.0+
- **认证**: JWT + 角色权限控制
- **日志**: Loguru + JSON格式化
- **包管理**: UV

### 前端技术栈
- **框架**: React 18+
- **语言**: TypeScript 5+
- **构建**: Vite 5+
- **UI组件**: Ant Design 5+
- **状态管理**: Zustand
- **样式**: TailwindCSS 3+
- **图表**: Recharts

## 📋 系统要求

- Docker 20.10+
- Docker Compose 2.0+
- Python 3.11+ (开发环境)
- Node.js 18+ (开发环境)
- PostgreSQL 16+ (生产环境)
- Redis 7.2+ (生产环境)

## 🚀 快速部署

### 1. 克隆项目
```bash
git clone <repository-url>
cd intelligent-task-scheduler
```

### 2. 使用部署脚本

#### Linux/macOS:
```bash
chmod +x deploy.sh
./deploy.sh
```

#### Windows:
```cmd
deploy.bat
```

### 3. 手动部署

#### 启动服务
```bash
docker-compose up -d
```

#### 查看服务状态
```bash
docker-compose ps
```

#### 查看日志
```bash
docker-compose logs -f [service_name]
```

## 🔗 访问地址

- **前端界面**: http://localhost:3000
- **后端API**: http://localhost:8000
- **API文档**: http://localhost:8000/docs
- **系统监控**: http://localhost:8000/monitoring

## 🔑 默认账号

- **用户名**: admin
- **密码**: admin123

## 📁 项目结构

```
intelligent-task-scheduler/
├── scheduler-backend/          # Python后端服务
│   ├── app/
│   │   ├── api/v1/            # API路由
│   │   ├── core/              # 核心功能
│   │   ├── models/            # 数据模型
│   │   ├── schemas/           # 数据验证
│   │   ├── services/          # 业务逻辑
│   │   └── utils/             # 工具函数
│   ├── logs/                  # 日志文件
│   ├── uploads/               # 文件上传
│   ├── main.py               # 主入口
│   ├── pyproject.toml        # 项目配置
│   └── Dockerfile            # Docker配置
├── src/                       # React前端
│   ├── components/           # 组件
│   ├── pages/               # 页面
│   ├── hooks/               # 自定义Hook
│   ├── utils/               # 工具函数
│   └── stores/              # 状态管理
├── supabase/                 # 数据库迁移
│   └── migrations/         # SQL迁移文件
├── docker/                   # Docker配置
│   └── nginx.conf          # Nginx配置
├── docker-compose.yml      # Docker Compose配置
├── Dockerfile.frontend     # 前端Dockerfile
├── deploy.sh               # Linux部署脚本
├── deploy.bat              # Windows部署脚本
└── README.md               # 项目文档
```

## 🔧 配置说明

### 环境变量

复制 `scheduler-backend/.env.example` 到 `scheduler-backend/.env` 并修改相关配置：

```bash
# 数据库配置
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/scheduler

# Redis配置
REDIS_URL=redis://localhost:6379/0

# JWT密钥
SECRET_KEY=your-secret-key-change-in-production

# 应用配置
DEBUG=false
HOST=0.0.0.0
PORT=8000
```

### Docker配置

在 `docker-compose.yml` 中可以调整：
- 服务端口映射
- 环境变量
- 卷挂载配置
- 网络配置
- 资源限制

## 📊 监控功能

### 仪表板统计
- 任务总数统计
- 执行状态分布
- 系统资源使用
- 近期执行趋势

### 任务性能
- 执行成功率
- 平均执行时间
- 失败原因分析
- 性能趋势图表

### 系统健康
- 数据库连接状态
- 调度器运行状态
- Redis连接状态
- 系统资源监控

### 日志管理
- 实时日志搜索
- 执行日志查看
- 日志级别过滤
- 日志文件下载

## 🛡️ 安全特性

- **JWT认证**: 基于Token的身份验证
- **角色权限**: 管理员、用户、访客三级权限
- **输入验证**: 全面的数据验证和清洗
- **SQL注入防护**: ORM层防护
- **CORS配置**: 跨域请求控制
- **日志审计**: 完整的操作日志记录

## 🔍 开发指南

### 后端开发

#### 安装依赖
```bash
cd scheduler-backend
uv pip install -e .
```

#### 运行开发服务器
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### 运行测试
```bash
pytest tests/
```

### 前端开发

#### 安装依赖
```bash
npm install
```

#### 运行开发服务器
```bash
npm run dev
```

#### 构建生产版本
```bash
npm run build
```

## 📈 性能优化

- **连接池**: 数据库连接池管理
- **缓存策略**: Redis缓存优化
- **异步处理**: 异步任务执行
- **数据库索引**: 优化的数据库索引
- **日志轮转**: 自动日志清理
- **资源限制**: 容器资源限制

## 🚨 故障排查

### 常见问题

#### 1. 服务无法启动
- 检查端口是否被占用
- 检查环境变量配置
- 查看Docker日志

#### 2. 数据库连接失败
- 检查PostgreSQL服务状态
- 验证数据库连接字符串
- 检查防火墙设置

#### 3. 任务执行失败
- 检查任务配置参数
- 查看执行日志
- 验证网络连接

#### 4. 前端无法访问
- 检查Nginx配置
- 验证服务端口映射
- 检查CORS配置

### 日志查看

```bash
# 查看所有服务日志
docker-compose logs

# 查看特定服务日志
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres

# 查看实时日志
docker-compose logs -f --tail=100 backend
```

## 🔄 备份与恢复

### 数据库备份
```bash
# 备份数据库
docker-compose exec postgres pg_dump -U postgres scheduler > backup.sql

# 恢复数据库
docker-compose exec -T postgres psql -U postgres scheduler < backup.sql
```

### 文件备份
```bash
# 备份上传文件
cp -r scheduler-backend/uploads uploads_backup

# 备份日志文件
cp -r scheduler-backend/logs logs_backup
```

## 📚 API文档

完整的API文档可在部署后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

主要API端点：
- `/api/v1/auth/*` - 认证相关
- `/api/v1/tasks/*` - 任务管理
- `/api/v1/executions/*` - 执行记录
- `/api/v1/groups/*` - 任务分组
- `/api/v1/monitoring/*` - 监控统计

## 🤝 贡献指南

1. Fork项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🆘 支持

如果遇到问题，请：
1. 查看本README的故障排查部分
2. 检查GitHub Issues
3. 创建新的Issue

## 📞 联系方式

- 项目维护者: [Your Name]
- 邮箱: [your.email@example.com]
- 项目主页: [https://github.com/yourusername/intelligent-task-scheduler](https://github.com/yourusername/intelligent-task-scheduler)

---

**⭐ 如果这个项目对你有帮助，请给个Star！**