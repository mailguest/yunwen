from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from datetime import datetime, timedelta

from app.core.auth import get_current_user
from app.models.user import User
from app.services.monitoring_service import monitoring_service
from app.schemas.monitoring import (
    DashboardStats,
    ExecutionTrend,
    TaskPerformance,
    SystemHealth,
    LogEntry,
    LogSearchRequest
)

router = APIRouter(prefix="/monitoring", tags=["监控管理"])


@router.get("/dashboard/stats", response_model=DashboardStats, summary="获取仪表板统计")
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user)
):
    """获取仪表板统计数据"""
    return await monitoring_service.get_dashboard_stats()


@router.get("/executions/trends", response_model=List[ExecutionTrend], summary="获取执行趋势")
async def get_execution_trends(
    days: int = Query(default=7, ge=1, le=30, description="统计天数"),
    current_user: User = Depends(get_current_user)
):
    """获取执行趋势数据"""
    return await monitoring_service.get_execution_trends(days)


@router.get("/tasks/performance", response_model=List[TaskPerformance], summary="获取任务性能")
async def get_task_performance(
    limit: int = Query(default=10, ge=1, le=100, description="返回数量"),
    current_user: User = Depends(get_current_user)
):
    """获取任务性能统计"""
    return await monitoring_service.get_task_performance(limit)


@router.get("/system/health", response_model=SystemHealth, summary="获取系统健康状态")
async def get_system_health(
    current_user: User = Depends(get_current_user)
):
    """获取系统健康状态"""
    return await monitoring_service.get_system_health()


@router.get("/logs/search", response_model=List[LogEntry], summary="搜索日志")
async def search_logs(
    keyword: Optional[str] = Query(default=None, description="搜索关键词"),
    level: Optional[str] = Query(default=None, description="日志级别"),
    start_time: Optional[datetime] = Query(default=None, description="开始时间"),
    end_time: Optional[datetime] = Query(default=None, description="结束时间"),
    limit: int = Query(default=100, ge=1, le=1000, description="返回数量"),
    current_user: User = Depends(get_current_user)
):
    """搜索系统日志"""
    request = LogSearchRequest(
        keyword=keyword,
        level=level,
        start_time=start_time,
        end_time=end_time,
        limit=limit
    )
    return await monitoring_service.search_logs(request)


@router.get("/logs/executions/{execution_id}", response_model=List[LogEntry], summary="获取执行日志")
async def get_execution_logs(
    execution_id: str,
    current_user: User = Depends(get_current_user)
):
    """获取指定执行的日志"""
    return await monitoring_service.get_execution_logs(execution_id)


@router.get("/logs/download", summary="下载日志文件")
async def download_logs(
    date: Optional[str] = Query(default=None, description="日志日期 (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user)
):
    """下载日志文件"""
    return await monitoring_service.download_logs(date)