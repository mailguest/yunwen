# 执行记录服务

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta
from loguru import logger

from app.models import Execution, Task, User, ExecutionStatus, TriggerType

class ExecutionService:
    """执行记录服务类"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_executions(self, skip: int = 0, limit: int = 10, 
                             filters: Optional[Dict[str, Any]] = None) -> tuple[List[Execution], int]:
        """获取执行记录列表"""
        query = select(Execution).options(
            selectinload(Execution.task),
            selectinload(Execution.triggered_by_user)
        )
        
        # 应用过滤条件
        if filters:
            conditions = []
            if "task_id" in filters:
                conditions.append(Execution.task_id == filters["task_id"])
            if "status" in filters:
                conditions.append(Execution.status == filters["status"])
            if "trigger_type" in filters:
                conditions.append(Execution.trigger_type == filters["trigger_type"])
            if "start_date" in filters:
                conditions.append(Execution.created_at >= filters["start_date"])
            if "end_date" in filters:
                conditions.append(Execution.created_at <= filters["end_date"])
            if "search" in filters:
                search_term = f"%{filters['search']}%"
                conditions.append(
                    or_(
                        Execution.output.ilike(search_term),
                        Execution.error_message.ilike(search_term)
                    )
                )
            
            if conditions:
                query = query.where(and_(*conditions))
        
        # 获取总数
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar()
        
        # 获取分页数据
        query = query.offset(skip).limit(limit).order_by(Execution.created_at.desc())
        result = await self.db.execute(query)
        executions = result.scalars().all()
        
        return list(executions), total
    
    async def get_execution_by_id(self, execution_id: str) -> Optional[Execution]:
        """根据ID获取执行记录"""
        query = select(Execution).options(
            selectinload(Execution.task),
            selectinload(Execution.triggered_by_user)
        ).where(Execution.id == execution_id)
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_running_executions_by_task(self, task_id: str) -> List[Execution]:
        """获取任务正在运行的执行记录"""
        query = select(Execution).where(
            and_(
                Execution.task_id == task_id,
                Execution.status == ExecutionStatus.RUNNING
            )
        )
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def create_execution(self, task_id: str, status: ExecutionStatus,
                             trigger_type: TriggerType = TriggerType.SCHEDULED,
                             triggered_by: Optional[str] = None,
                             retry_count: int = 0,
                             execution_context: Optional[Dict[str, Any]] = None) -> Execution:
        """创建执行记录"""
        execution = Execution(
            task_id=task_id,
            status=status,
            trigger_type=trigger_type,
            triggered_by=triggered_by,
            retry_count=retry_count,
            execution_context=execution_context or {}
        )
        
        self.db.add(execution)
        await self.db.flush()
        await self.db.refresh(execution, ["task", "triggered_by_user"])
        
        logger.info(f"创建执行记录: 任务 {task_id}, 状态 {status}, 触发方式 {trigger_type}")
        return execution
    
    async def update_execution(self, execution_id: str, **kwargs) -> Execution:
        """更新执行记录"""
        execution = await self.get_execution_by_id(execution_id)
        if not execution:
            raise ValueError("执行记录不存在")
        
        # 更新字段
        for field, value in kwargs.items():
            if hasattr(execution, field):
                setattr(execution, field, value)
        
        await self.db.commit()
        await self.db.refresh(execution, ["task", "triggered_by_user"])
        
        logger.info(f"更新执行记录: {execution_id}, 状态: {execution.status}")
        return execution
    
    async def get_execution_statistics(self, task_id: Optional[str] = None,
                                     days: int = 30) -> Dict[str, Any]:
        """获取执行统计信息"""
        # 计算时间范围
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        query = select(
            func.count(Execution.id).label("total_count"),
            func.count(case((Execution.status == ExecutionStatus.SUCCESS, 1))).label("success_count"),
            func.count(case((Execution.status == ExecutionStatus.FAILED, 1))).label("failure_count"),
            func.count(case((Execution.status == ExecutionStatus.SKIPPED, 1))).label("skipped_count"),
            func.count(case((Execution.status == ExecutionStatus.RUNNING, 1))).label("running_count"),
            func.avg(case((Execution.duration.is_not(None), Execution.duration))).label("avg_duration"),
            func.max(Execution.duration).label("max_duration"),
            func.min(Execution.duration).label("min_duration"),
        ).where(
            and_(
                Execution.created_at >= start_date,
                Execution.created_at <= end_date
            )
        )
        
        if task_id:
            query = query.where(Execution.task_id == task_id)
        
        result = await self.db.execute(query)
        stats = result.one()
        
        # 计算成功率
        success_rate = 0
        if stats.total_count > 0:
            success_rate = (stats.success_count / stats.total_count) * 100
        
        return {
            "total_count": stats.total_count or 0,
            "success_count": stats.success_count or 0,
            "failure_count": stats.failure_count or 0,
            "skipped_count": stats.skipped_count or 0,
            "running_count": stats.running_count or 0,
            "success_rate": round(success_rate, 2),
            "avg_duration": float(stats.avg_duration) if stats.avg_duration else 0,
            "max_duration": stats.max_duration or 0,
            "min_duration": stats.min_duration or 0,
            "time_range": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": days
            }
        }
    
    async def get_execution_trends(self, task_id: Optional[str] = None,
                                 days: int = 7) -> List[Dict[str, Any]]:
        """获取执行趋势数据"""
        # 计算时间范围
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # 按天分组统计
        query = select(
            func.date_trunc('day', Execution.created_at).label('date'),
            func.count(Execution.id).label('count'),
            func.count(case((Execution.status == ExecutionStatus.SUCCESS, 1))).label('success_count'),
            func.count(case((Execution.status == ExecutionStatus.FAILED, 1))).label('failure_count'),
            func.avg(case((Execution.duration.is_not(None), Execution.duration))).label('avg_duration')
        ).where(
            and_(
                Execution.created_at >= start_date,
                Execution.created_at <= end_date
            )
        )
        
        if task_id:
            query = query.where(Execution.task_id == task_id)
        
        query = query.group_by(func.date_trunc('day', Execution.created_at))
        query = query.order_by(func.date_trunc('day', Execution.created_at))
        
        result = await self.db.execute(query)
        rows = result.all()
        
        trends = []
        for row in rows:
            success_rate = 0
            if row.count > 0:
                success_rate = (row.success_count / row.count) * 100
            
            trends.append({
                "date": row.date.strftime("%Y-%m-%d"),
                "total_count": row.count,
                "success_count": row.success_count,
                "failure_count": row.failure_count,
                "success_rate": round(success_rate, 2),
                "avg_duration": float(row.avg_duration) if row.avg_duration else 0
            })
        
        return trends
    
    async def retry_execution(self, execution_id: str, triggered_by: str) -> Execution:
        """重试执行记录"""
        execution = await self.get_execution_by_id(execution_id)
        if not execution:
            raise ValueError("执行记录不存在")
        
        if execution.status not in [ExecutionStatus.FAILED, ExecutionStatus.TIMEOUT]:
            raise ValueError("只能重试失败或超时的执行记录")
        
        # 创建新的执行记录用于重试
        new_execution = await self.create_execution(
            task_id=execution.task_id,
            status=ExecutionStatus.PENDING,
            trigger_type=TriggerType.RETRY,
            triggered_by=triggered_by,
            retry_count=execution.retry_count + 1
        )
        
        logger.info(f"创建重试执行记录: {execution_id} -> {new_execution.id}")
        
        return new_execution
    
    async def get_active_executions(self) -> List[Execution]:
        """获取活跃的执行记录"""
        query = select(Execution).options(
            selectinload(Execution.task),
            selectinload(Execution.triggered_by_user)
        ).where(
            Execution.status == ExecutionStatus.RUNNING
        ).order_by(Execution.created_at.desc())
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def cancel_execution(self, execution_id: str) -> bool:
        """取消执行记录"""
        execution = await self.get_execution_by_id(execution_id)
        if not execution:
            raise ValueError("执行记录不存在")
        
        if execution.status != ExecutionStatus.RUNNING:
            raise ValueError("只能取消运行中的执行记录")
        
        # 更新执行状态
        await self.update_execution(
            execution_id,
            status=ExecutionStatus.FAILED,
            end_time=datetime.now(),
            error_message="任务被取消"
        )
        
        logger.info(f"取消执行记录: {execution_id}")
        return True