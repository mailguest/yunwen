# 任务调度器管理器

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.executors.pool import ThreadPoolExecutor, ProcessPoolExecutor
from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR, EVENT_JOB_MISSED
from datetime import datetime, timedelta
import asyncio
from typing import Dict, Any, Optional
from loguru import logger
import httpx
import json

from app.core.config import settings
from app.models.task import Task, TaskStatus
from app.models.execution import Execution, ExecutionStatus
from app.core.database import AsyncSessionLocal
from app.services.task_service import TaskService
from app.services.execution_service import ExecutionService

class SchedulerManager:
    """任务调度器管理器"""
    
    def __init__(self):
        self.scheduler: Optional[AsyncIOScheduler] = None
        self.jobstores = {
            'default': SQLAlchemyJobStore(url=settings.DATABASE_URL)
        }
        self.executors = {
            'default': ThreadPoolExecutor(max_workers=settings.SCHEDULER_MAX_WORKERS),
            'processpool': ProcessPoolExecutor(max_workers=5)
        }
        self.job_defaults = {
            'coalesce': settings.SCHEDULER_COALESCE,
            'max_instances': settings.SCHEDULER_MAX_INSTANCES,
            'misfire_grace_time': 300
        }
        
    def start(self):
        """启动调度器"""
        if self.scheduler and self.scheduler.running:
            logger.warning("调度器已经在运行中")
            return
            
        self.scheduler = AsyncIOScheduler(
            jobstores=self.jobstores,
            executors=self.executors,
            job_defaults=self.job_defaults,
            timezone=settings.SCHEDULER_TIMEZONE
        )
        
        # 添加事件监听器
        self.scheduler.add_listener(
            self.job_executed_listener, 
            EVENT_JOB_EXECUTED | EVENT_JOB_ERROR | EVENT_JOB_MISSED
        )
        
        self.scheduler.start()
        logger.info(f"任务调度器已启动，时区: {settings.SCHEDULER_TIMEZONE}")
        
    def shutdown(self):
        """关闭调度器"""
        if self.scheduler and self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("任务调度器已关闭")
    
    def job_executed_listener(self, event):
        """任务执行事件监听器"""
        if event.exception:
            logger.error(f"任务 {event.job_id} 执行失败: {event.exception}")
        else:
            logger.info(f"任务 {event.job_id} 执行成功，耗时: {event.retval}")
    
    async def add_task(self, task: Task):
        """添加任务到调度器"""
        if not self.scheduler:
            raise RuntimeError("调度器未启动")
            
        job_id = f"task_{task.id}"
        
        # 如果任务已存在，先删除
        if self.scheduler.get_job(job_id):
            self.scheduler.remove_job(job_id)
            
        # 添加新任务
        self.scheduler.add_job(
            func=self.execute_task,
            trigger="cron",
            id=job_id,
            name=task.name,
            **self.parse_cron_expression(task.cron_expression),
            args=[task.id],
            coalesce=True,
            max_instances=1,
            misfire_grace_time=300
        )
        
        logger.info(f"任务 {task.name} 已添加到调度器，cron: {task.cron_expression}")
    
    async def remove_task(self, task_id: str):
        """从调度器移除任务"""
        if not self.scheduler:
            return
            
        job_id = f"task_{task_id}"
        if self.scheduler.get_job(job_id):
            self.scheduler.remove_job(job_id)
            logger.info(f"任务 {task_id} 已从调度器移除")
    
    async def pause_task(self, task_id: str):
        """暂停任务"""
        if not self.scheduler:
            return
            
        job_id = f"task_{task_id}"
        if self.scheduler.get_job(job_id):
            self.scheduler.pause_job(job_id)
            logger.info(f"任务 {task_id} 已暂停")
    
    async def resume_task(self, task_id: str):
        """恢复任务"""
        if not self.scheduler:
            return
            
        job_id = f"task_{task_id}"
        if self.scheduler.get_job(job_id):
            self.scheduler.resume_job(job_id)
            logger.info(f"任务 {task_id} 已恢复")
    
    async def execute_task(self, task_id: str):
        """执行任务"""
        async with AsyncSessionLocal() as session:
            task_service = TaskService(session)
            execution_service = ExecutionService(session)
            
            try:
                # 获取任务信息
                task = await task_service.get_task_by_id(task_id)
                if not task:
                    logger.error(f"任务 {task_id} 不存在")
                    return
                
                if not task.enabled:
                    logger.info(f"任务 {task.name} 已禁用，跳过执行")
                    return
                
                # 检查并发控制
                if task.concurrent_control:
                    running_executions = await execution_service.get_running_executions_by_task(task_id)
                    if running_executions:
                        logger.info(f"任务 {task.name} 正在执行中，跳过本次执行")
                        # 创建跳过的执行记录
                        await execution_service.create_execution(
                            task_id=task_id,
                            status=ExecutionStatus.SKIPPED,
                            trigger_type="scheduled",
                            execution_context={"skip_reason": "concurrent_control"}
                        )
                        return
                
                # 创建执行记录
                execution = await execution_service.create_execution(
                    task_id=task_id,
                    status=ExecutionStatus.RUNNING,
                    trigger_type="scheduled"
                )
                
                start_time = datetime.now()
                
                try:
                    # 执行任务
                    result = await self._execute_task_impl(task)
                    
                    # 更新执行记录
                    end_time = datetime.now()
                    duration = int((end_time - start_time).total_seconds())
                    
                    await execution_service.update_execution(
                        execution.id,
                        status=ExecutionStatus.SUCCESS,
                        end_time=end_time,
                        duration=duration,
                        output=result.get("output", "") if isinstance(result, dict) else str(result)
                    )
                    
                    # 更新任务最后执行时间
                    await task_service.update_task_last_execution(task_id, start_time)
                    
                    logger.info(f"任务 {task.name} 执行成功，耗时: {duration}秒")
                    return duration
                    
                except Exception as e:
                    # 任务执行失败
                    end_time = datetime.now()
                    duration = int((end_time - start_time).total_seconds())
                    
                    await execution_service.update_execution(
                        execution.id,
                        status=ExecutionStatus.FAILED,
                        end_time=end_time,
                        duration=duration,
                        error_message=str(e)
                    )
                    
                    logger.error(f"任务 {task.name} 执行失败: {e}")
                    raise
                    
            except Exception as e:
                logger.error(f"执行任务 {task_id} 时发生错误: {e}")
                raise
    
    async def _execute_task_impl(self, task: Task) -> Dict[str, Any]:
        """实际执行任务"""
        if task.task_type == "http":
            return await self._execute_http_task(task)
        elif task.task_type == "rpc":
            return await self._execute_rpc_task(task)
        else:
            raise ValueError(f"不支持的任务类型: {task.task_type}")
    
    async def _execute_http_task(self, task: Task) -> Dict[str, Any]:
        """执行HTTP任务"""
        config = task.task_config or {}
        
        url = config.get("url")
        method = config.get("method", "GET").upper()
        headers = config.get("headers", {})
        timeout = config.get("timeout", settings.DEFAULT_TASK_TIMEOUT)
        
        if not url:
            raise ValueError("HTTP任务缺少URL配置")
        
        # 构建请求参数
        params = {}
        if task.parameters:
            for param in task.parameters:
                if param.is_dynamic:
                    # 处理动态参数
                    params[param.parameter_name] = self._resolve_dynamic_parameter(param.parameter_value)
                else:
                    params[param.parameter_name] = param.parameter_value
        
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                if method == "GET":
                    response = await client.get(url, headers=headers, params=params)
                elif method == "POST":
                    response = await client.post(url, headers=headers, json=params)
                elif method == "PUT":
                    response = await client.put(url, headers=headers, json=params)
                elif method == "DELETE":
                    response = await client.delete(url, headers=headers, params=params)
                else:
                    raise ValueError(f"不支持的HTTP方法: {method}")
                
                response.raise_for_status()
                
                return {
                    "status_code": response.status_code,
                    "output": response.text[:1000],  # 限制输出长度
                    "headers": dict(response.headers)
                }
                
            except httpx.HTTPStatusError as e:
                raise Exception(f"HTTP请求失败: {e.response.status_code} - {e.response.text}")
            except Exception as e:
                raise Exception(f"HTTP请求异常: {str(e)}")
    
    async def _execute_rpc_task(self, task: Task) -> Dict[str, Any]:
        """执行RPC任务"""
        config = task.task_config or {}
        
        service_name = config.get("service")
        method_name = config.get("method")
        endpoint = config.get("endpoint")
        timeout = config.get("timeout", settings.DEFAULT_TASK_TIMEOUT)
        
        if not all([service_name, method_name, endpoint]):
            raise ValueError("RPC任务缺少必要的配置参数")
        
        # 构建请求参数
        params = {}
        if task.parameters:
            for param in task.parameters:
                if param.is_dynamic:
                    params[param.parameter_name] = self._resolve_dynamic_parameter(param.parameter_value)
                else:
                    params[param.parameter_name] = param.parameter_value
        
        # 这里应该集成具体的RPC框架，如gRPC、Dubbo等
        # 暂时使用HTTP模拟RPC调用
        rpc_payload = {
            "service": service_name,
            "method": method_name,
            "parameters": params
        }
        
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                response = await client.post(endpoint, json=rpc_payload)
                response.raise_for_status()
                
                return {
                    "status_code": response.status_code,
                    "output": response.text[:1000],
                    "service": service_name,
                    "method": method_name
                }
                
            except Exception as e:
                raise Exception(f"RPC调用失败: {str(e)}")
    
    def _resolve_dynamic_parameter(self, value: str) -> str:
        """解析动态参数"""
        if value == "{{ today }}":
            return datetime.now().strftime("%Y-%m-%d")
        elif value == "{{ yesterday }}":
            return (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        elif value == "{{ tomorrow }}":
            return (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        elif value == "{{ now }}":
            return datetime.now().isoformat()
        else:
            return value
    
    def parse_cron_expression(self, cron_expr: str) -> Dict[str, str]:
        """解析cron表达式"""
        # 这里应该使用专业的cron解析库，如croniter
        # 暂时返回简单的解析结果
        parts = cron_expr.split()
        if len(parts) != 5:
            raise ValueError("无效的cron表达式，应该是5个字段")
        
        return {
            "minute": parts[0],
            "hour": parts[1],
            "day": parts[2],
            "month": parts[3],
            "day_of_week": parts[4]
        }

# 创建全局调度器管理器实例
scheduler_manager = SchedulerManager()