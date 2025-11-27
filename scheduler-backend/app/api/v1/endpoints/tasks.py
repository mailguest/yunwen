# 任务管理相关接口

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID
from loguru import logger

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User
from app.schemas.task import (
    TaskCreate, TaskUpdate, TaskResponse, TaskListResponse,
    TaskTriggerResponse, TaskBatchUpdate
)
from app.services.task_service import TaskService
from app.core.task_executor import task_executor
from app.models import TriggerType

router = APIRouter()

@router.get("/", response_model=TaskListResponse)
async def get_tasks(
    skip: int = Query(0, ge=0, description="跳过的记录数"),
    limit: int = Query(10, ge=1, le=100, description="每页记录数"),
    group_id: Optional[UUID] = Query(None, description="分组ID"),
    enabled: Optional[bool] = Query(None, description="是否启用"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取任务列表"""
    try:
        task_service = TaskService(db)
        
        # 构建过滤条件
        filters = {}
        if group_id:
            filters["group_id"] = str(group_id)
        if enabled is not None:
            filters["enabled"] = enabled
        if search:
            filters["search"] = search
        
        tasks, total = await task_service.get_tasks(
            skip=skip,
            limit=limit,
            filters=filters
        )
        
        return TaskListResponse(
            items=[TaskResponse.from_orm(task) for task in tasks],
            total=total,
            skip=skip,
            limit=limit
        )
        
    except Exception as e:
        logger.error(f"获取任务列表失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取任务列表失败"
        )

@router.post("/", response_model=TaskResponse)
async def create_task(
    task_data: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """创建新任务"""
    try:
        task_service = TaskService(db)
        
        # 创建任务
        task = await task_service.create_task(task_data, str(current_user.id))
        
        logger.info(f"用户 {current_user.email} 创建了任务: {task.name}")
        
        return TaskResponse.from_orm(task)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"创建任务失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建任务失败"
        )

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取任务详情"""
    try:
        task_service = TaskService(db)
        task = await task_service.get_task_by_id(str(task_id))
        
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="任务不存在"
            )
        
        return TaskResponse.from_orm(task)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取任务详情失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取任务详情失败"
        )

@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    task_data: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """更新任务"""
    try:
        task_service = TaskService(db)
        
        # 检查任务是否存在
        existing_task = await task_service.get_task_by_id(str(task_id))
        if not existing_task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="任务不存在"
            )
        
        # 更新任务
        task = await task_service.update_task(str(task_id), task_data)
        
        logger.info(f"用户 {current_user.email} 更新了任务: {task.name}")
        
        return TaskResponse.from_orm(task)
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"更新任务失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新任务失败"
        )

@router.delete("/{task_id}")
async def delete_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """删除任务"""
    try:
        task_service = TaskService(db)
        
        # 检查任务是否存在
        task = await task_service.get_task_by_id(str(task_id))
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="任务不存在"
            )
        
        # 删除任务
        await task_service.delete_task(str(task_id))
        
        logger.info(f"用户 {current_user.email} 删除了任务: {task.name}")
        
        return {"message": "任务删除成功"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除任务失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除任务失败"
        )

@router.post("/{task_id}/trigger", response_model=TaskTriggerResponse)
async def trigger_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """手动触发任务"""
    try:
        task_service = TaskService(db)
        
        # 检查任务是否存在且启用
        task = await task_service.get_task_by_id(str(task_id))
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="任务不存在"
            )
        
        if not task.enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="任务已禁用，无法手动触发"
            )
        
        # 手动触发任务
        execution = await task_executor.manual_trigger_task(
            str(task_id), 
            str(current_user.id)
        )
        
        logger.info(f"用户 {current_user.email} 手动触发了任务: {task.name}")
        
        return TaskTriggerResponse(
            execution_id=str(execution.id),
            task_id=str(task_id),
            status=execution.status,
            message="任务已手动触发，正在执行中"
        )
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"手动触发任务失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="手动触发任务失败"
        )

@router.post("/{task_id}/enable")
async def enable_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """启用任务"""
    try:
        task_service = TaskService(db)
        
        # 检查任务是否存在
        task = await task_service.get_task_by_id(str(task_id))
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="任务不存在"
            )
        
        # 启用任务
        updated_task = await task_service.update_task_status(str(task_id), True)
        
        logger.info(f"用户 {current_user.email} 启用了任务: {task.name}")
        
        return {"message": "任务已启用"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"启用任务失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="启用任务失败"
        )

@router.post("/{task_id}/disable")
async def disable_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """禁用任务"""
    try:
        task_service = TaskService(db)
        
        # 检查任务是否存在
        task = await task_service.get_task_by_id(str(task_id))
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="任务不存在"
            )
        
        # 禁用任务
        updated_task = await task_service.update_task_status(str(task_id), False)
        
        logger.info(f"用户 {current_user.email} 禁用了任务: {task.name}")
        
        return {"message": "任务已禁用"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"禁用任务失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="禁用任务失败"
        )

@router.post("/batch-update")
async def batch_update_tasks(
    batch_data: TaskBatchUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """批量更新任务"""
    try:
        task_service = TaskService(db)
        
        # 批量更新任务
        updated_count = await task_service.batch_update_tasks(
            batch_data.task_ids,
            batch_data.update_data
        )
        
        logger.info(f"用户 {current_user.email} 批量更新了 {updated_count} 个任务")
        
        return {
            "message": f"成功更新 {updated_count} 个任务",
            "updated_count": updated_count
        }
        
    except Exception as e:
        logger.error(f"批量更新任务失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="批量更新任务失败"
        )