# 智能定时任务控制平台

一个基于 Node.js（Express）与 React 的现代化任务调度系统，支持 HTTP/RPC 任务、并发控制、参数管理、分组管理与完整监控。

## 🌟 核心特性

- **动态任务配置**: 支持HTTP和RPC任务类型
- **智能调度**: 基于cron表达式的灵活调度策略
- **并发控制**: 防止任务重复执行，支持跳过策略
- **参数管理**: 支持动态和静态参数配置
- **任务分组**: 灵活的任务分组管理
- **执行历史**: 完整的任务执行记录和日志
- **实时监控**: 系统健康监控和性能统计
- **现代化UI**: 基于React和Ant Design的响应式界面
- **Docker部署**: 完整的容器化部署方案

## 🏗️ 技术架构

### 后端技术栈
- 框架: `Express`（TypeScript）
- 数据库: `PostgreSQL`（`pg` 连接池，`demo1` schema）
- 调度: `later` + `cron-parser`（按秒级 CRON）
- 认证: `JWT` + 角色/资源权限（RBAC）
- 文档: `swagger-ui-express`（`/api/docs`）
- 日志: 结构化日志（`api/lib/logger.ts`）

### 前端技术栈
- 框架: `React 18`
- 语言: `TypeScript 5`
- 构建: `Vite 6`
- UI组件: `Ant Design 6`
- 状态管理: `Zustand`
- 样式: `TailwindCSS 3`
- 图表: `Recharts`

## 📋 系统要求

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 20+（开发环境）
- PostgreSQL 14+/16+（数据库）

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone <repository-url>
cd demo
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

### 3. 手动部署（Docker Compose）

1) 在项目根目录创建 `.env`（供 Compose 使用）并填写：
```bash
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=scheduler
DB_SCHEMA=demo1
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=change-this-in-prod
VITE_API_BASE_URL=http://localhost:3001/api
```

2) 启动服务：
```bash
docker-compose up -d
```

3) 查看状态与日志：
```bash
docker-compose ps
docker-compose logs -f api
docker-compose logs -f frontend
```

## 🔗 访问地址

- 前端界面: `http://localhost:3000`
- 后端 API: `http://localhost:3001`
- API 文档: `http://localhost:3001/api/docs`
- 监控界面: `http://localhost:3000/monitoring`

## 🔑 默认账号

- 管理员: `admin` / `admin123`
- 普通用户（若执行初始化脚本）: `user` / `user123`
- 演示用户（若执行初始化脚本）: `demo` / `demo123`

## 📁 项目结构

```
demo/
├── api/                      # Node.js 后端（Express + TS）
│   ├── config/               # 数据库/初始化配置
│   ├── lib/                  # 日志/可观测性
│   ├── middleware/           # 中间件（认证等）
│   ├── routes/               # 路由（auth/tasks/monitoring/...）
│   ├── scripts/              # 数据库初始化/修复脚本
│   ├── services/             # 业务服务（scheduler/taskService）
│   ├── app.ts                # Express 应用
│   ├── server.ts             # 本地开发入口
│   └── docs.ts               # OpenAPI 规范生成
├── src/                      # React 前端
│   ├── components/           # 组件
│   ├── pages/                # 页面（Dashboard/Tasks/Monitoring/...）
│   ├── hooks/                # 自定义 Hook
│   ├── lib/                  # API 客户端与工具
│   └── stores/               # 状态管理
├── supabase/migrations/      # 数据库迁移 SQL（含 demo1 schema）
├── docker/                   # Nginx 等容器配置
├── Dockerfile.api            # 后端镜像构建
├── Dockerfile.frontend       # 前端镜像构建
├── docker-compose.yml        # Compose 编排（api/frontend）
├── deploy.sh / deploy.bat    # 一键部署脚本
└── README.md                 # 项目文档
```

## 🔧 配置说明

### 后端环境（`.env.local`，被 API 容器复制使用）
```bash
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=scheduler
DB_SCHEMA=demo1
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=change-this-in-prod
# 可选：语句/事务超时
STATEMENT_TIMEOUT_MS=0
IDLE_TX_TIMEOUT_MS=0
```

### 前端环境（本地开发 `.env` 或 Compose 构建参数）
```bash
VITE_API_BASE_URL=http://localhost:3001/api
VITE_APP_NAME=智能定时任务调度平台
VITE_APP_VERSION=0.1.0
VITE_DEV_MODE=true
VITE_REQUEST_TIMEOUT=30000
VITE_ENABLE_MOCK=false
VITE_LOG_LEVEL=info
```

### 数据库初始化
- 直接运行脚本：`npx tsx api/scripts/init-database.ts`
- 或手动执行迁移：`supabase/migrations/20240115000001_initial_schema.sql`

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

### 后端（Express + TS）
- 安装依赖：`npm install`
- 开发启动：`npm run server:dev`（`nodemon` + `tsx` 启动 `api/server.ts`）
- Swagger 文档：`http://localhost:3001/api/docs`

### 前端（React + Vite）
- 安装依赖：`npm install`
- 开发启动：`npm run client:dev`（端口 `3000`，代理 `/api` 到 `3001`）
- 联合启动：`npm run dev`（同时启动前后端）
- 构建生产：`npm run build` / `npm run build:frontend`
- 预览打包：`npm run preview`

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
- 检查 Nginx 配置（`docker/nginx.conf`）
- 验证端口映射（`3000 -> 80`）
- 检查代理配置（`vite.config.ts` 中 `/api` 代理）

### 日志查看

```bash
# 查看所有服务日志
docker-compose logs

# 查看特定服务日志
docker-compose logs -f api
docker-compose logs -f frontend

# 查看实时日志
docker-compose logs -f --tail=100 api
```

## 🔄 备份与恢复

### 数据库备份（示例）
```bash
# 使用本机 pg_dump（根据你的连接信息替换）
pg_dump -h localhost -U postgres -d scheduler -F c -f backup.dump

# 恢复
pg_restore -h localhost -U postgres -d scheduler -c backup.dump
```

## 📚 API文档

完整的文档在部署后访问：
- Swagger UI: `http://localhost:3001/api/docs`
- OpenAPI JSON: `http://localhost:3001/api/openapi.json`

主要 API 端点：
- `/api/auth/*` - 认证相关
- `/api/tasks/*` - 任务管理
- `/api/task-groups/*` - 任务分组
- `/api/monitoring/*` - 监控统计
- `/api/users/*` - 用户管理
- `/api/settings/*` - 设置管理
- `/api/notifications/*` - 通知配置
- `/api/systems/*` - 系统管理
- `/api/metrics/*` - 指标上报

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

- 项目维护者: [pangdahai]
- 邮箱: [278912990@qq.com]

---

**⭐ 如果这个项目对你有帮助，请给个Star！**
