# 核心配置模块

from typing import List, Optional
from pydantic import BaseSettings, validator
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    """应用配置"""
    
    # 基础配置
    PROJECT_NAME: str = "智能定时任务调度平台"
    VERSION: str = "0.1.0"
    DESCRIPTION: str = "企业级智能定时任务调度管理系统"
    DEBUG: bool = True
    
    # 服务器配置
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # 安全配置
    SECRET_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    ALGORITHM: str = "HS256"
    
    # 数据库配置
    DATABASE_URL: str = ""
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    
    # Redis配置
    REDIS_URL: str = ""
    REDIS_POOL_SIZE: int = 10
    
    # CORS配置
    ALLOWED_HOSTS: List[str] = ["http://localhost:3000", "http://localhost:5173"]
    
    # 调度器配置
    SCHEDULER_MAX_WORKERS: int = 10
    SCHEDULER_TIMEZONE: str = "Asia/Shanghai"
    SCHEDULER_COALESCE: bool = True
    SCHEDULER_MAX_INSTANCES: int = 1
    
    # 任务执行配置
    DEFAULT_TASK_TIMEOUT: int = 300  # 5分钟
    DEFAULT_RETRY_COUNT: int = 3
    MAX_CONCURRENT_TASKS: int = 10
    
    # 日志配置
    LOG_LEVEL: str = "INFO"
    LOG_DIR: str = "logs"
    LOG_RETENTION_DAYS: int = 30

    # 数据库语句超时（毫秒）
    STATEMENT_TIMEOUT_MS: int = 5000
    
    # 通知配置
    ENABLE_EMAIL_NOTIFICATIONS: bool = True
    SMTP_SERVER: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    
    # 文件上传配置
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    
    @validator("SECRET_KEY", pre=True)
    def validate_secret_key(cls, v):
        if not v and not os.getenv("DEBUG"):
            raise ValueError("请在生产环境中设置SECRET_KEY")
        return v
    
    @validator("DATABASE_URL", pre=True)
    def validate_database_url(cls, v):
        if not v:
            raise ValueError("DATABASE_URL不能为空")
        return v
    
    @validator("REDIS_URL", pre=True)
    def validate_redis_url(cls, v):
        if not v:
            raise ValueError("REDIS_URL不能为空")
        return v
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

# 创建配置实例
settings = Settings()

# 确保必要的目录存在
Path(settings.LOG_DIR).mkdir(exist_ok=True)
Path(settings.UPLOAD_DIR).mkdir(exist_ok=True)
