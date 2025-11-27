# 日志配置

import sys
import os
from pathlib import Path
from loguru import logger
from pythonjsonlogger import jsonlogger
from app.core.config import settings

def setup_logging():
    """设置日志配置"""
    
    # 确保日志目录存在
    log_dir = Path(settings.LOG_DIR)
    log_dir.mkdir(exist_ok=True)
    
    # 移除默认的日志处理器
    logger.remove()
    
    # 控制台日志
    logger.add(
        sys.stdout,
        level=settings.LOG_LEVEL,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        colorize=True,
        backtrace=True,
        diagnose=True,
    )
    
    # 文件日志 - 按天分割
    logger.add(
        log_dir / "scheduler_{time:YYYY-MM-DD}.log",
        level=settings.LOG_LEVEL,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        rotation="00:00",  # 每天凌晨分割
        retention=f"{settings.LOG_RETENTION_DAYS} days",  # 保留天数
        compression="zip",  # 压缩旧日志
        encoding="utf-8",
        backtrace=True,
        diagnose=True,
    )
    
    # JSON格式日志 - 用于日志分析
    logger.add(
        log_dir / "scheduler_json_{time:YYYY-MM-DD}.log",
        level=settings.LOG_LEVEL,
        format=lambda record: jsonlogger.JsonFormatter().format(record),
        rotation="00:00",
        retention=f"{settings.LOG_RETENTION_DAYS} days",
        compression="zip",
        encoding="utf-8",
        serialize=True,
    )
    
    # 错误日志单独文件
    logger.add(
        log_dir / "errors_{time:YYYY-MM-DD}.log",
        level="ERROR",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}\n{exception}",
        rotation="00:00",
        retention=f"{settings.LOG_RETENTION_DAYS} days",
        compression="zip",
        encoding="utf-8",
        backtrace=True,
        diagnose=True,
    )
    
    # 任务执行日志单独文件
    logger.add(
        log_dir / "executions_{time:YYYY-MM-DD}.log",
        level="INFO",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | 任务执行: {message}",
        rotation="00:00",
        retention=f"{settings.LOG_RETENTION_DAYS} days",
        compression="zip",
        encoding="utf-8",
        filter=lambda record: "task_execution" in record["extra"],
    )
    
    logger.info("日志系统初始化完成")

class TaskExecutionLogger:
    """任务执行专用日志记录器"""
    
    def __init__(self, task_id: str, execution_id: str):
        self.task_id = task_id
        self.execution_id = execution_id
        self.logger = logger.bind(
            task_execution=True,
            task_id=task_id,
            execution_id=execution_id
        )
    
    def info(self, message: str, **kwargs):
        """记录信息日志"""
        self.logger.info(message, **kwargs)
    
    def error(self, message: str, **kwargs):
        """记录错误日志"""
        self.logger.error(message, **kwargs)
    
    def warning(self, message: str, **kwargs):
        """记录警告日志"""
        self.logger.warning(message, **kwargs)
    
    def debug(self, message: str, **kwargs):
        """记录调试日志"""
        self.logger.debug(message, **kwargs)

def get_task_logger(task_id: str, execution_id: str) -> TaskExecutionLogger:
    """获取任务执行日志记录器"""
    return TaskExecutionLogger(task_id, execution_id)