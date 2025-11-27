# 监控和日志服务

from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta
from loguru import logger

from app.models import Task, Execution, SystemConfig, User
from app.models import ExecutionStatus, TaskStatus
from app.core.database import AsyncSessionLocal
from app.core.config import settings

class MonitoringService:
    """监控服务"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_dashboard_stats(self) -> Dict[str, Any]:
        """获取仪表板统计数据"""
        # 任务统计
        task_stats = await self._get_task_stats()
        
        # 执行统计
        execution_stats = await self._get_execution_stats()
        
        # 系统统计
        system_stats = await self._get_system_stats()
        
        return {
            "tasks": task_stats,
            "executions": execution_stats,
            "system": system_stats,
            "timestamp": datetime.now().isoformat()
        }
    
    async def _get_task_stats(self) -> Dict[str, Any]:
        """获取任务统计"""
        # 总任务数
        total_tasks = await self.db.scalar(select(func.count(Task.id)))
        
        # 启用任务数
        enabled_tasks = await self.db.scalar(
            select(func.count(Task.id)).where(Task.enabled == True)
        )
        
        # 按类型统计
        task_type_stats = await self.db.execute(
            select(Task.task_type, func.count(Task.id))
            .group_by(Task.task_type)
        )
        task_type_counts = dict(task_type_stats.all())
        
        # 最近7天创建的任务
        last_7_days = datetime.now() - timedelta(days=7)
        recent_tasks = await self.db.scalar(
            select(func.count(Task.id)).where(Task.created_at >= last_7_days)
        )
        
        return {
            "total": total_tasks or 0,
            "enabled": enabled_tasks or 0,
            "disabled": (total_tasks or 0) - (enabled_tasks or 0),
            "by_type": task_type_counts,
            "recent_7_days": recent_tasks or 0
        }
    
    async def _get_execution_stats(self) -> Dict[str, Any]:
        """获取执行统计"""
        # 最近24小时的执行统计
        last_24_hours = datetime.now() - timedelta(hours=24)
        
        # 总执行次数
        total_executions = await self.db.scalar(
            select(func.count(Execution.id)).where(Execution.created_at >= last_24_hours)
        )
        
        # 按状态统计
        status_stats = await self.db.execute(
            select(Execution.status, func.count(Execution.id))
            .where(Execution.created_at >= last_24_hours)
            .group_by(Execution.status)
        )
        status_counts = dict(status_stats.all())
        
        # 正在运行的任务
        running_executions = await self.db.scalar(
            select(func.count(Execution.id)).where(Execution.status == ExecutionStatus.RUNNING)
        )
        
        # 成功率
        success_count = status_counts.get(ExecutionStatus.SUCCESS, 0)
        success_rate = (success_count / total_executions * 100) if total_executions > 0 else 0
        
        # 平均执行时间
        avg_duration = await self.db.scalar(
            select(func.avg(Execution.duration))
            .where(
                and_(
                    Execution.created_at >= last_24_hours,
                    Execution.duration.is_not(None)
                )
            )
        )
        
        return {
            "total_24h": total_executions or 0,
            "running": running_executions or 0,
            "by_status": status_counts,
            "success_rate": round(success_rate, 2),
            "avg_duration": float(avg_duration) if avg_duration else 0
        }
    
    async def _get_system_stats(self) -> Dict[str, Any]:
        """获取系统统计"""
        # 活跃用户统计（最近30天）
        last_30_days = datetime.now() - timedelta(days=30)
        active_users = await self.db.scalar(
            select(func.count(func.distinct(User.id)))
            .where(User.created_at >= last_30_days)
        )
        
        # 系统配置项数
        config_count = await self.db.scalar(select(func.count(SystemConfig.id)))
        
        return {
            "active_users_30d": active_users or 0,
            "config_items": config_count or 0,
            "server_time": datetime.now().isoformat(),
            "timezone": settings.SCHEDULER_TIMEZONE
        }
    
    async def get_execution_trends(self, days: int = 7) -> List[Dict[str, Any]]:
        """获取执行趋势数据"""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # 按天分组统计
        query = select(
            func.date_trunc('day', Execution.created_at).label('date'),
            func.count(Execution.id).label('total_count'),
            func.count(func.case((Execution.status == ExecutionStatus.SUCCESS, 1))).label('success_count'),
            func.count(func.case((Execution.status == ExecutionStatus.FAILED, 1))).label('failure_count'),
            func.count(func.case((Execution.status == ExecutionStatus.SKIPPED, 1))).label('skipped_count'),
            func.avg(func.case((Execution.duration.is_not(None), Execution.duration))).label('avg_duration')
        ).where(
            Execution.created_at >= start_date
        ).group_by(
            func.date_trunc('day', Execution.created_at)
        ).order_by(
            func.date_trunc('day', Execution.created_at)
        )
        
        result = await self.db.execute(query)
        rows = result.all()
        
        trends = []
        for row in rows:
            success_rate = 0
            if row.total_count > 0:
                success_rate = (row.success_count / row.total_count) * 100
            
            trends.append({
                "date": row.date.strftime("%Y-%m-%d"),
                "total_count": row.total_count,
                "success_count": row.success_count,
                "failure_count": row.failure_count,
                "skipped_count": row.skipped_count,
                "success_rate": round(success_rate, 2),
                "avg_duration": float(row.avg_duration) if row.avg_duration else 0
            })
        
        return trends
    
    async def get_task_performance(self, task_id: str, days: int = 30) -> Dict[str, Any]:
        """获取任务性能数据"""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # 执行统计
        execution_stats = await self.db.execute(
            select(
                func.count(Execution.id).label('total_executions'),
                func.count(func.case((Execution.status == ExecutionStatus.SUCCESS, 1))).label('success_count'),
                func.count(func.case((Execution.status == ExecutionStatus.FAILED, 1))).label('failure_count'),
                func.avg(func.case((Execution.duration.is_not(None), Execution.duration))).label('avg_duration'),
                func.max(Execution.duration).label('max_duration'),
                func.min(Execution.duration).label('min_duration')
            ).where(
                and_(
                    Execution.task_id == task_id,
                    Execution.created_at >= start_date
                )
            )
        )
        stats = execution_stats.one()
        
        # 最近10次执行记录
        recent_executions = await self.db.execute(
            select(Execution).where(
                and_(
                    Execution.task_id == task_id,
                    Execution.created_at >= start_date
                )
            ).order_by(Execution.created_at.desc()).limit(10)
        )
        executions = list(recent_executions.scalars().all())
        
        # 成功率
        success_rate = 0
        if stats.total_executions > 0:
            success_rate = (stats.success_count / stats.total_executions) * 100
        
        return {
            "task_id": task_id,
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": days
            },
            "executions": {
                "total": stats.total_executions,
                "success": stats.success_count,
                "failure": stats.failure_count,
                "success_rate": round(success_rate, 2)
            },
            "performance": {
                "avg_duration": float(stats.avg_duration) if stats.avg_duration else 0,
                "max_duration": stats.max_duration or 0,
                "min_duration": stats.min_duration or 0
            },
            "recent_executions": [
                {
                    "id": str(exec.id),
                    "status": exec.status,
                    "start_time": exec.start_time.isoformat() if exec.start_time else None,
                    "end_time": exec.end_time.isoformat() if exec.end_time else None,
                    "duration": exec.duration,
                    "trigger_type": exec.trigger_type
                }
                for exec in executions
            ]
        }
    
    async def get_active_executions(self) -> List[Dict[str, Any]]:
        """获取活跃的执行任务"""
        result = await self.db.execute(
            select(Execution).options(
                selectinload(Execution.task),
                selectinload(Execution.triggered_by_user)
            ).where(
                Execution.status == ExecutionStatus.RUNNING
            ).order_by(Execution.created_at.desc())
        )
        
        executions = list(result.scalars().all())
        
        return [
            {
                "id": str(exec.id),
                "task_id": str(exec.task_id),
                "task_name": exec.task.name,
                "status": exec.status,
                "start_time": exec.start_time.isoformat() if exec.start_time else None,
                "duration_so_far": (datetime.now() - exec.start_time).total_seconds() if exec.start_time else 0,
                "trigger_type": exec.trigger_type,
                "triggered_by": exec.triggered_by_user.username if exec.triggered_by_user else None
            }
            for exec in executions
        ]
    
    async def get_system_health(self) -> Dict[str, Any]:
        """获取系统健康状态"""
        health_status = {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "components": {}
        }
        
        # 数据库健康检查
        try:
            await self.db.execute(select(1))
            health_status["components"]["database"] = {
                "status": "healthy",
                "message": "Database connection is working"
            }
        except Exception as e:
            health_status["status"] = "unhealthy"
            health_status["components"]["database"] = {
                "status": "unhealthy",
                "message": f"Database connection failed: {str(e)}"
            }
        
        # 调度器健康检查（这里需要访问调度器实例）
        try:
            from app.core.scheduler import scheduler_manager
            if scheduler_manager.scheduler and scheduler_manager.scheduler.running:
                health_status["components"]["scheduler"] = {
                    "status": "healthy",
                    "message": "Scheduler is running"
                }
            else:
                health_status["status"] = "unhealthy"
                health_status["components"]["scheduler"] = {
                    "status": "unhealthy",
                    "message": "Scheduler is not running"
                }
        except Exception as e:
            health_status["status"] = "unhealthy"
            health_status["components"]["scheduler"] = {
                "status": "unhealthy",
                "message": f"Scheduler check failed: {str(e)}"
            }
        
        # Redis健康检查（如果需要的话）
        try:
            import redis
            redis_client = redis.from_url(settings.REDIS_URL)
            redis_client.ping()
            health_status["components"]["redis"] = {
                "status": "healthy",
                "message": "Redis connection is working"
            }
        except Exception as e:
            health_status["status"] = "unhealthy"
            health_status["components"]["redis"] = {
                "status": "unhealthy",
                "message": f"Redis connection failed: {str(e)}"
            }
        
        return health_status

class LogService:
    """日志服务"""
    
    @staticmethod
    async def get_log_files() -> List[Dict[str, Any]]:
        """获取日志文件列表"""
        import os
        from pathlib import Path
        
        log_dir = Path(settings.LOG_DIR)
        if not log_dir.exists():
            return []
        
        log_files = []
        for log_file in log_dir.glob("*.log"):
            stat = log_file.stat()
            log_files.append({
                "filename": log_file.name,
                "size": stat.st_size,
                "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "path": str(log_file)
            })
        
        # 按修改时间排序
        log_files.sort(key=lambda x: x["modified_at"], reverse=True)
        
        return log_files
    
    @staticmethod
    async def get_log_content(filename: str, lines: int = 100) -> str:
        """获取日志文件内容"""
        import os
        from pathlib import Path
        
        log_dir = Path(settings.LOG_DIR)
        log_file = log_dir / filename
        
        # 安全检查
        if not log_file.exists() or not str(log_file).startswith(str(log_dir)):
            raise ValueError("Invalid log file path")
        
        try:
            # 读取文件最后几行
            with open(log_file, 'r', encoding='utf-8') as f:
                # 使用更高效的方式读取大文件
                if lines > 0:
                    # 读取最后几行
                    content = []
                    for line in f:
                        content.append(line.rstrip())
                        if len(content) > lines:
                            content.pop(0)
                    return '\n'.join(content)
                else:
                    # 读取整个文件
                    return f.read()
        except Exception as e:
            logger.error(f"Error reading log file {filename}: {e}")
            raise
    
    @staticmethod
    async def search_logs(keyword: str, filename: Optional[str] = None, 
                         max_lines: int = 1000) -> List[Dict[str, Any]]:
        """搜索日志内容"""
        import os
        from pathlib import Path
        import re
        
        log_dir = Path(settings.LOG_DIR)
        if not log_dir.exists():
            return []
        
        results = []
        
        # 确定要搜索的文件
        if filename:
            log_files = [log_dir / filename]
        else:
            log_files = list(log_dir.glob("*.log"))
        
        for log_file in log_files:
            if not log_file.exists():
                continue
            
            try:
                with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                    line_number = 0
                    for line in f:
                        line_number += 1
                        if re.search(keyword, line, re.IGNORECASE):
                            results.append({
                                "filename": log_file.name,
                                "line_number": line_number,
                                "content": line.rstrip()[:500],  # 限制内容长度
                                "timestamp": datetime.now().isoformat()
                            })
                            
                            if len(results) >= max_lines:
                                break
                    
                    if len(results) >= max_lines:
                        break
                        
            except Exception as e:
                logger.error(f"Error searching log file {log_file}: {e}")
                continue
        
        return results
    
    @staticmethod
    async def get_execution_logs(execution_id: str) -> str:
        """获取执行任务的日志"""
        # 这里应该从执行日志文件中获取
        # 暂时返回模拟数据
        log_file = Path(settings.LOG_DIR) / f"executions_{datetime.now().strftime('%Y-%m-%d')}.log"
        
        if log_file.exists():
            try:
                with open(log_file, 'r', encoding='utf-8') as f:
                    lines = []
                    for line in f:
                        if f"execution_id={execution_id}" in line:
                            lines.append(line.rstrip())
                    
                    return '\n'.join(lines[-100:])  # 返回最后100行
            except Exception as e:
                logger.error(f"Error reading execution logs: {e}")
                return f"Error reading logs: {str(e)}"
        
        return "No logs found for this execution"

# 创建监控服务实例
monitoring_service = MonitoringService