# 任务调度核心引擎

from datetime import datetime, timedelta
import asyncio
from typing import Dict, Any, Optional, List
from loguru import logger
import httpx
import json
from croniter import croniter

from app.core.config import settings
from app.models import Task, TaskStatus, Execution, ExecutionStatus, TriggerType
from app.core.database import AsyncSessionLocal
from app.core.logging import get_task_logger
from app.services.task_service import TaskService
from app.services.execution_service import ExecutionService

class TaskExecutor:
    """任务执行器"""
    
    def __init__(self):
        self.active_executions: Dict[str, str] = {}  # execution_id -> task_id
        self.semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_TASKS)
    
    async def execute_task(self, task: Task, trigger_type: TriggerType = TriggerType.SCHEDULED, 
                          triggered_by: Optional[str] = None) -> Execution:
        """执行任务"""
        async with AsyncSessionLocal() as session:
            execution_service = ExecutionService(session)
            
            # 检查并发控制
            if task.concurrent_control:
                running_executions = await execution_service.get_running_executions_by_task(str(task.id))
                if running_executions:
                    logger.info(f"任务 {task.name} 正在执行中，跳过本次执行")
                    # 创建跳过的执行记录
                    execution = await execution_service.create_execution(
                        task_id=str(task.id),
                        status=ExecutionStatus.SKIPPED,
                        trigger_type=trigger_type,
                        triggered_by=triggered_by,
                        execution_context={"skip_reason": "concurrent_control"}
                    )
                    return execution
            
            # 创建执行记录
            execution = await execution_service.create_execution(
                task_id=str(task.id),
                status=ExecutionStatus.PENDING,
                trigger_type=trigger_type,
                triggered_by=triggered_by
            )
            
            # 在后台执行任务
            asyncio.create_task(self._run_task_execution(task, execution))
            
            return execution
    
    async def _run_task_execution(self, task: Task, execution: Execution):
        """在后台运行任务执行"""
        async with self.semaphore:
            task_logger = get_task_logger(str(task.id), str(execution.id))
            
            async with AsyncSessionLocal() as session:
                execution_service = ExecutionService(session)
                
                try:
                    # 更新执行状态为运行中
                    await execution_service.update_execution(
                        execution.id,
                        status=ExecutionStatus.RUNNING,
                        start_time=datetime.now()
                    )
                    
                    task_logger.info(f"开始执行任务: {task.name}")
                    
                    # 执行任务
                    result = await self._execute_task_by_type(task, task_logger)
                    
                    # 更新执行结果
                    end_time = datetime.now()
                    duration = int((end_time - execution.start_time).total_seconds()) if execution.start_time else 0
                    
                    await execution_service.update_execution(
                        execution.id,
                        status=ExecutionStatus.SUCCESS,
                        end_time=end_time,
                        duration=duration,
                        output=json.dumps(result) if isinstance(result, dict) else str(result)
                    )
                    
                    task_logger.info(f"任务执行成功，耗时: {duration}秒")
                    
                    # 更新任务最后执行时间
                    task_service = TaskService(session)
                    await task_service.update_task_last_execution(str(task.id), datetime.now())
                    
                except asyncio.TimeoutError:
                    # 任务超时
                    end_time = datetime.now()
                    duration = int((end_time - execution.start_time).total_seconds()) if execution.start_time else 0
                    
                    await execution_service.update_execution(
                        execution.id,
                        status=ExecutionStatus.TIMEOUT,
                        end_time=end_time,
                        duration=duration,
                        error_message="任务执行超时"
                    )
                    
                    task_logger.error(f"任务执行超时，耗时: {duration}秒")
                    
                except Exception as e:
                    # 任务执行失败
                    end_time = datetime.now()
                    duration = int((end_time - execution.start_time).total_seconds()) if execution.start_time else 0
                    
                    await execution_service.update_execution(
                        execution.id,
                        status=ExecutionStatus.FAILED,
                        end_time=end_time,
                        duration=duration,
                        error_message=str(e)
                    )
                    
                    task_logger.error(f"任务执行失败: {e}")
                    
                    # 检查是否需要重试
                    if execution.retry_count < task.retry_count:
                        await self._retry_task(task, execution)
    
    async def _execute_task_by_type(self, task: Task, task_logger: Any) -> Any:
        """根据任务类型执行具体任务"""
        if task.task_type == "http":
            return await self._execute_http_task(task, task_logger)
        elif task.task_type == "rpc":
            return await self._execute_rpc_task(task, task_logger)
        else:
            raise ValueError(f"不支持的任务类型: {task.task_type}")
    
    async def _execute_http_task(self, task: Task, task_logger: Any) -> Dict[str, Any]:
        """执行HTTP任务"""
        config = task.task_config or {}
        
        url = config.get("url")
        method = config.get("method", "GET").upper()
        headers = config.get("headers", {})
        timeout = config.get("timeout", settings.DEFAULT_TASK_TIMEOUT)
        
        if not url:
            raise ValueError("HTTP任务缺少URL配置")
        
        # 构建请求参数
        params = await self._build_task_parameters(task)
        
        task_logger.info(f"执行HTTP请求: {method} {url}")
        
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
                
                task_logger.info(f"HTTP请求成功，状态码: {response.status_code}")
                
                return {
                    "status_code": response.status_code,
                    "output": response.text[:1000],  # 限制输出长度
                    "headers": dict(response.headers),
                    "url": str(response.url)
                }
                
            except httpx.HTTPStatusError as e:
                error_msg = f"HTTP请求失败: {e.response.status_code} - {e.response.text[:500]}"
                task_logger.error(error_msg)
                raise Exception(error_msg)
            except Exception as e:
                error_msg = f"HTTP请求异常: {str(e)}"
                task_logger.error(error_msg)
                raise Exception(error_msg)
    
    async def _execute_rpc_task(self, task: Task, task_logger: Any) -> Dict[str, Any]:
        """执行RPC任务"""
        config = task.task_config or {}
        
        service_name = config.get("service")
        method_name = config.get("method")
        endpoint = config.get("endpoint")
        timeout = config.get("timeout", settings.DEFAULT_TASK_TIMEOUT)
        
        if not all([service_name, method_name, endpoint]):
            raise ValueError("RPC任务缺少必要的配置参数")
        
        # 构建请求参数
        params = await self._build_task_parameters(task)
        
        task_logger.info(f"执行RPC调用: {service_name}.{method_name}")
        
        # 构建RPC请求负载
        rpc_payload = {
            "service": service_name,
            "method": method_name,
            "parameters": params,
            "timestamp": datetime.now().isoformat()
        }
        
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                response = await client.post(endpoint, json=rpc_payload)
                response.raise_for_status()
                
                result = response.json()
                task_logger.info(f"RPC调用成功，返回数据长度: {len(str(result))}")
                
                return {
                    "status_code": response.status_code,
                    "service": service_name,
                    "method": method_name,
                    "result": result,
                    "endpoint": endpoint
                }
                
            except Exception as e:
                error_msg = f"RPC调用失败: {str(e)}"
                task_logger.error(error_msg)
                raise Exception(error_msg)
    
    async def _build_task_parameters(self, task: Task) -> Dict[str, Any]:
        """构建任务参数"""
        params = {}
        
        if task.parameters:
            for param in task.parameters:
                param_value = param.parameter_value
                
                # 处理动态参数
                if param.is_dynamic:
                    param_value = self._resolve_dynamic_parameter(param_value)
                
                # 根据参数类型转换值
                if param.parameter_type == "number":
                    try:
                        param_value = float(param_value) if '.' in str(param_value) else int(param_value)
                    except ValueError:
                        pass
                elif param.parameter_type == "boolean":
                    param_value = str(param_value).lower() in ('true', '1', 'yes', 'on')
                elif param.parameter_type == "json":
                    try:
                        param_value = json.loads(param_value)
                    except json.JSONDecodeError:
                        pass
                
                params[param.parameter_name] = param_value
        
        return params
    
    def _resolve_dynamic_parameter(self, value: str) -> str:
        """解析动态参数"""
        now = datetime.now()
        
        if value == "{{ today }}":
            return now.strftime("%Y-%m-%d")
        elif value == "{{ yesterday }}":
            return (now - timedelta(days=1)).strftime("%Y-%m-%d")
        elif value == "{{ tomorrow }}":
            return (now + timedelta(days=1)).strftime("%Y-%m-%d")
        elif value == "{{ now }}":
            return now.isoformat()
        elif value == "{{ timestamp }}":
            return str(int(now.timestamp()))
        elif value == "{{ year }}":
            return now.strftime("%Y")
        elif value == "{{ month }}":
            return now.strftime("%m")
        elif value == "{{ day }}":
            return now.strftime("%d")
        elif value == "{{ hour }}":
            return now.strftime("%H")
        elif value == "{{ minute }}":
            return now.strftime("%M")
        else:
            return value
    
    async def _retry_task(self, task: Task, failed_execution: Execution):
        """重试任务"""
        if failed_execution.retry_count >= task.retry_count:
            return
        
        # 计算重试延迟时间（指数退避）
        retry_delay = min(2 ** failed_execution.retry_count * 60, 3600)  # 最大1小时
        
        logger.info(f"任务 {task.name} 将在 {retry_delay} 秒后重试（第 {failed_execution.retry_count + 1} 次）")
        
        # 调度重试
        await asyncio.sleep(retry_delay)
        
        async with AsyncSessionLocal() as session:
            execution_service = ExecutionService(session)
            
            # 创建重试执行记录
            retry_execution = await execution_service.create_execution(
                task_id=str(task.id),
                status=ExecutionStatus.PENDING,
                trigger_type=TriggerType.RETRY,
                retry_count=failed_execution.retry_count + 1
            )
            
            # 执行重试
            await self._run_task_execution(task, retry_execution)
    
    async def manual_trigger_task(self, task_id: str, triggered_by: str) -> Execution:
        """手动触发任务"""
        async with AsyncSessionLocal() as session:
            task_service = TaskService(session)
            task = await task_service.get_task_by_id(task_id)
            
            if not task:
                raise ValueError(f"任务 {task_id} 不存在")
            
            if not task.enabled:
                raise ValueError(f"任务 {task.name} 已禁用")
            
            return await self.execute_task(task, TriggerType.MANUAL, triggered_by)
    
    def get_active_executions(self) -> List[Dict[str, Any]]:
        """获取活跃的执行任务"""
        return [
            {
                "execution_id": exec_id,
                "task_id": task_id,
                "start_time": datetime.now().isoformat()
            }
            for exec_id, task_id in self.active_executions.items()
        ]
    
    async def cancel_execution(self, execution_id: str) -> bool:
        """取消执行"""
        # 这里需要实现任务取消逻辑
        # 由于Python的异步任务取消比较复杂，这里只是标记状态
        async with AsyncSessionLocal() as session:
            execution_service = ExecutionService(session)
            execution = await execution_service.get_execution_by_id(execution_id)
            
            if execution and execution.status == ExecutionStatus.RUNNING:
                await execution_service.update_execution(
                    execution_id,
                    status=ExecutionStatus.FAILED,
                    end_time=datetime.now(),
                    error_message="任务被取消"
                )
                return True
            
            return False

# 创建全局任务执行器实例
task_executor = TaskExecutor()