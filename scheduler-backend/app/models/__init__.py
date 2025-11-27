# 数据模型定义

from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, ForeignKey, JSON, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

from app.core.database import Base

class UserRole(str, enum.Enum):
    """用户角色枚举"""
    ADMIN = "admin"
    USER = "user"
    GUEST = "guest"

class TaskType(str, enum.Enum):
    """任务类型枚举"""
    HTTP = "http"
    RPC = "rpc"

class TaskStatus(str, enum.Enum):
    """任务状态枚举"""
    ENABLED = "enabled"
    DISABLED = "disabled"

class ExecutionStatus(str, enum.Enum):
    """执行状态枚举"""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"
    TIMEOUT = "timeout"

class TriggerType(str, enum.Enum):
    """触发类型枚举"""
    SCHEDULED = "scheduled"
    MANUAL = "manual"
    RETRY = "retry"
    API = "api"

class NotificationType(str, enum.Enum):
    """通知类型枚举"""
    EMAIL = "email"
    WEBHOOK = "webhook"
    DINGTALK = "dingtalk"
    WECHAT = "wechat"

class ParameterType(str, enum.Enum):
    """参数类型枚举"""
    STRING = "string"
    NUMBER = "number"
    BOOLEAN = "boolean"
    JSON = "json"

class User(Base):
    """用户模型"""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.USER, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 关联
    created_tasks = relationship("Task", back_populates="creator")
    created_groups = relationship("TaskGroup", back_populates="creator")
    executions = relationship("Execution", back_populates="triggered_by_user")

class TaskGroup(Base):
    """任务分组模型"""
    __tablename__ = "task_groups"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 关联
    creator = relationship("User", back_populates="created_groups")
    tasks = relationship("Task", back_populates="group")

class Task(Base):
    """任务模型"""
    __tablename__ = "tasks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    group_id = Column(UUID(as_uuid=True), ForeignKey("task_groups.id"), nullable=True)
    cron_expression = Column(String(100), nullable=False)
    task_type = Column(Enum(TaskType), nullable=False, index=True)
    task_config = Column(JSON, default=dict, nullable=False)
    concurrent_control = Column(Boolean, default=True, nullable=False)
    timeout = Column(Integer, default=300, nullable=False)
    retry_count = Column(Integer, default=3, nullable=False)
    enabled = Column(Boolean, default=True, nullable=False, index=True)
    last_execution_at = Column(DateTime(timezone=True))
    next_execution_at = Column(DateTime(timezone=True), index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 关联
    group = relationship("TaskGroup", back_populates="tasks")
    creator = relationship("User", back_populates="created_tasks")
    parameters = relationship("TaskParameter", back_populates="task", cascade="all, delete-orphan")
    executions = relationship("Execution", back_populates="task")
    notifications = relationship("TaskNotification", back_populates="task")

class TaskParameter(Base):
    """任务参数模型"""
    __tablename__ = "task_parameters"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=False)
    parameter_name = Column(String(100), nullable=False)
    parameter_value = Column(Text)
    parameter_type = Column(Enum(ParameterType), default=ParameterType.STRING, nullable=False)
    is_dynamic = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 关联
    task = relationship("Task", back_populates="parameters")
    
    __table_args__ = (Base.metadata.tables['task_parameters'].index_elements(['task_id', 'parameter_name']),)

class Execution(Base):
    """执行记录模型"""
    __tablename__ = "executions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=False)
    status = Column(Enum(ExecutionStatus), nullable=False, index=True)
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    duration = Column(Integer)  # 执行时长（秒）
    output = Column(Text)
    error_message = Column(Text)
    retry_count = Column(Integer, default=0, nullable=False)
    execution_context = Column(JSON, default=dict)
    trigger_type = Column(Enum(TriggerType), default=TriggerType.SCHEDULED, nullable=False)
    triggered_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 关联
    task = relationship("Task", back_populates="executions")
    triggered_by_user = relationship("User", back_populates="executions")

class SystemConfig(Base):
    """系统配置模型"""
    __tablename__ = "system_configs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    config_key = Column(String(100), unique=True, nullable=False, index=True)
    config_value = Column(Text)
    config_type = Column(Enum(ParameterType), default=ParameterType.STRING, nullable=False)
    description = Column(Text)
    is_secret = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class OperationLog(Base):
    """操作日志模型"""
    __tablename__ = "operation_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    operation_type = Column(String(50), nullable=False, index=True)
    resource_type = Column(String(50), nullable=False, index=True)
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    operation_detail = Column(JSON, default=dict)
    ip_address = Column(String(45))  # IPv6支持
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 关联
    user = relationship("User")

class NotificationConfig(Base):
    """通知配置模型"""
    __tablename__ = "notification_configs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    notification_type = Column(Enum(NotificationType), nullable=False)
    config = Column(JSON, default=dict, nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 关联
    creator = relationship("User")
    task_notifications = relationship("TaskNotification", back_populates="notification_config")

class TaskNotification(Base):
    """任务通知关联模型"""
    __tablename__ = "task_notifications"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=False)
    notification_config_id = Column(UUID(as_uuid=True), ForeignKey("notification_configs.id"), nullable=False)
    notify_on_success = Column(Boolean, default=False, nullable=False)
    notify_on_failure = Column(Boolean, default=True, nullable=False)
    notify_on_retry = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 关联
    task = relationship("Task", back_populates="notifications")
    notification_config = relationship("NotificationConfig", back_populates="task_notifications")
    
    __table_args__ = (Base.metadata.tables['task_notifications'].index_elements(['task_id', 'notification_config_id']),)