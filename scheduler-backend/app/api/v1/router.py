# API路由主文件

from fastapi import APIRouter
from app.api.v1.endpoints import auth, tasks, executions, groups, system, users, monitoring

api_router = APIRouter()

# 认证相关
api_router.include_router(auth.router, prefix="/auth", tags=["认证"])

# 任务管理
api_router.include_router(tasks.router, prefix="/tasks", tags=["任务管理"])

# 执行记录
api_router.include_router(executions.router, prefix="/executions", tags=["执行记录"])

# 任务分组
api_router.include_router(groups.router, prefix="/groups", tags=["任务分组"])

# 用户管理
api_router.include_router(users.router, prefix="/users", tags=["用户管理"])

# 系统配置
api_router.include_router(system.router, prefix="/system", tags=["系统配置"])

# 监控统计
api_router.include_router(monitoring.router, prefix="/monitoring", tags=["监控统计"])