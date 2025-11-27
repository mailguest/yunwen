# 任务服务

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload
from datetime import datetime
from loguru import logger

from app.models import Task, TaskParameter, TaskGroup, User
from app.schemas.task import TaskCreate, TaskUpdate
from app.core.scheduler import scheduler_manager
from app.models import TaskStatus, TaskType

class TaskService:
    """任务服务类"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_tasks(self, skip: int = 0, limit: int = 10, filters: Optional[Dict[str, Any]] = None) -> tuple[List[Task], int]:
        """获取任务列表"""
        query = select(Task).options(
            selectinload(Task.group),
            selectinload(Task.creator),
            selectinload(Task.parameters)
        )
        
        # 应用过滤条件
        if filters:
            conditions = []
            if "group_id" in filters:
                conditions.append(Task.group_id == filters["group_id"])
            if "enabled" in filters:
                conditions.append(Task.enabled == filters["enabled"])
            if "search" in filters:
                search_term = f"%{filters['search']}%"
                conditions.append(
                    or_(
                        Task.name.ilike(search_term),
                        Task.description.ilike(search_term)
                    )
                )
            
            if conditions:
                query = query.where(and_(*conditions))
        
        # 获取总数
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar()
        
        # 获取分页数据
        query = query.offset(skip).limit(limit).order_by(Task.created_at.desc())
        result = await self.db.execute(query)
        tasks = result.scalars().all()
        
        return list(tasks), total
    
    async def get_task_by_id(self, task_id: str) -> Optional[Task]:
        """根据ID获取任务"""
        query = select(Task).options(
            selectinload(Task.group),
            selectinload(Task.creator),
            selectinload(Task.parameters)
        ).where(Task.id == task_id)
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def create_task(self, task_data: TaskCreate, created_by: str) -> Task:
        """创建任务"""
        # 验证cron表达式
        try:
            from croniter import croniter
            croniter(task_data.cron_expression)
        except Exception as e:
            raise ValueError(f"无效的cron表达式: {e}")
        
        # 创建任务
        task = Task(
            name=task_data.name,
            description=task_data.description,
            group_id=task_data.group_id,
            cron_expression=task_data.cron_expression,
            task_type=task_data.task_type,
            task_config=task_data.task_config or {},
            concurrent_control=task_data.concurrent_control,
            timeout=task_data.timeout or settings.DEFAULT_TASK_TIMEOUT,
            retry_count=task_data.retry_count or settings.DEFAULT_RETRY_COUNT,
            enabled=task_data.enabled,
            created_by=created_by
        )
        
        self.db.add(task)
        await self.db.flush()
        
        # 创建任务参数
        if task_data.parameters:
            for param_data in task_data.parameters:
                parameter = TaskParameter(
                    task_id=task.id,
                    parameter_name=param_data.parameter_name,
                    parameter_value=param_data.parameter_value,
                    parameter_type=param_data.parameter_type,
                    is_dynamic=param_data.is_dynamic
                )
                self.db.add(parameter)
        
        await self.db.commit()
        await self.db.refresh(task, ["group", "creator", "parameters"])
        
        # 如果任务启用，添加到调度器
        if task.enabled:
            await scheduler_manager.add_task(task)
        
        logger.info(f"创建任务成功: {task.name}")
        return task
    
    async def update_task(self, task_id: str, task_data: TaskUpdate) -> Task:
        """更新任务"""
        task = await self.get_task_by_id(task_id)
        if not task:
            raise ValueError("任务不存在")
        
        # 验证cron表达式（如果提供）
        if task_data.cron_expression:
            try:
                from croniter import croniter
                croniter(task_data.cron_expression)
            except Exception as e:
                raise ValueError(f"无效的cron表达式: {e}")
        
        # 更新任务基本信息
        update_data = task_data.dict(exclude_unset=True)
        
        for field, value in update_data.items():
            if field != "parameters":  # 参数单独处理
                setattr(task, field, value)
        
        # 更新任务参数
        if "parameters" in update_data:
            # 删除现有参数
            await self.db.execute(
                select(TaskParameter).where(TaskParameter.task_id == task_id).delete()
            )
            
            # 添加新参数
            for param_data in update_data["parameters"]:
                parameter = TaskParameter(
                    task_id=task.id,
                    parameter_name=param_data["parameter_name"],
                    parameter_value=param_data["parameter_value"],
                    parameter_type=param_data["parameter_type"],
                    is_dynamic=param_data["is_dynamic"]
                )
                self.db.add(parameter)
        
        await self.db.commit()
        await self.db.refresh(task, ["group", "creator", "parameters"])
        
        # 如果任务启用，更新调度器
        if task.enabled:
            await scheduler_manager.add_task(task)
        else:
            # 如果任务禁用，从调度器移除
            await scheduler_manager.remove_task(task_id)
        
        logger.info(f"更新任务成功: {task.name}")
        return task
    
    async def update_task_status(self, task_id: str, enabled: bool) -> Task:
        """更新任务状态（启用/禁用）"""
        task = await self.get_task_by_id(task_id)
        if not task:
            raise ValueError("任务不存在")
        
        task.enabled = enabled
        await self.db.commit()
        await self.db.refresh(task)
        
        # 更新调度器
        if enabled:
            await scheduler_manager.add_task(task)
        else:
            await scheduler_manager.remove_task(task_id)
        
        logger.info(f"任务状态更新: {task.name} - {'启用' if enabled else '禁用'}")
        return task
    
    async def update_task_last_execution(self, task_id: str, execution_time: datetime) -> Task:
        """更新任务最后执行时间"""
        task = await self.get_task_by_id(task_id)
        if not task:
            raise ValueError("任务不存在")
        
        task.last_execution_at = execution_time
        
        # 计算下次执行时间
        try:
            from croniter import croniter
            cron = croniter(task.cron_expression, execution_time)
            task.next_execution_at = cron.get_next(datetime)
        except Exception as e:
            logger.warning(f"计算任务下次执行时间失败: {e}")
        
        await self.db.commit()
        return task
    
    async def delete_task(self, task_id: str) -> bool:
        """删除任务"""
        task = await self.get_task_by_id(task_id)
        if not task:
            raise ValueError("任务不存在")
        
        # 从调度器移除任务
        await scheduler_manager.remove_task(task_id)
        
        # 删除任务（级联删除相关数据）
        await self.db.delete(task)
        await self.db.commit()
        
        logger.info(f"删除任务成功: {task.name}")
        return True
    
    async def batch_update_tasks(self, task_ids: List[str], update_data: Dict[str, Any]) -> int:
        """批量更新任务"""
        # 获取要更新的任务
        query = select(Task).where(Task.id.in_(task_ids))
        result = await self.db.execute(query)
        tasks = result.scalars().all()
        
        if not tasks:
            return 0
        
        updated_count = 0
        for task in tasks:
            # 更新任务字段
            for field, value in update_data.items():
                if hasattr(task, field):
                    setattr(task, field, value)
            updated_count += 1
        
        await self.db.commit()
        
        # 更新调度器
        for task in tasks:
            if task.enabled:
                await scheduler_manager.add_task(task)
            else:
                await scheduler_manager.remove_task(str(task.id))
        
        logger.info(f"批量更新任务成功: {updated_count} 个任务")
        return updated_count
    
    async def get_task_statistics(self, task_id: str) -> Dict[str, Any]:
        """获取任务统计信息"""
        from sqlalchemy import func, case
        from app.models import Execution, ExecutionStatus
        
        query = select(
            func.count(Execution.id).label("total_executions"),
            func.count(case((Execution.status == ExecutionStatus.SUCCESS, 1))).label("success_count"),
            func.count(case((Execution.status == ExecutionStatus.FAILED, 1))).label("failure_count"),
            func.count(case((Execution.status == ExecutionStatus.SKIPPED, 1))).label("skipped_count"),
            func.avg(case((Execution.duration.is_not(None), Execution.duration))).label("avg_duration"),
            func.max(Execution.created_at).label("last_execution_time")
        ).where(Execution.task_id == task_id)
        
        result = await self.db.execute(query)
        stats = result.one()
        
        return {
            "total_executions": stats.total_executions or 0,
            "success_count": stats.success_count or 0,
            "failure_count": stats.failure_count or 0,
            "skipped_count": stats.skipped_count or 0,
            "avg_duration": float(stats.avg_duration) if stats.avg_duration else 0,
            "last_execution_time": stats.last_execution_time.isoformat() if stats.last_execution_time else None,
            "success_rate": (stats.success_count / stats.total_executions * 100) if stats.total_executions > 0 else 0
        }