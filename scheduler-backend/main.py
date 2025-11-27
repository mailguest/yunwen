# 智能定时任务控制平台 - 后端应用

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.requests import Request
import uuid
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
import uvicorn
from loguru import logger

from app.core.config import settings
from app.core.database import init_db
from app.core.scheduler import scheduler_manager
from app.api.v1.router import api_router
from app.core.logging import setup_logging

security = HTTPBearer()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时执行
    logger.info("正在启动智能定时任务调度平台...")
    
    # 初始化数据库
    await init_db()
    logger.info("数据库初始化完成")
    
    # 启动调度器
    scheduler_manager.start()
    logger.info("任务调度器启动完成")
    
    yield
    
    # 关闭时执行
    logger.info("正在关闭智能定时任务调度平台...")
    scheduler_manager.shutdown()
    logger.info("任务调度器已关闭")

# 创建FastAPI应用
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_HOSTS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 设置日志
setup_logging()

# 注册路由
app.include_router(api_router, prefix="/api/v1")

# 请求ID中间件
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    rid = request.headers.get("X-Request-ID") or uuid.uuid4().hex
    response = await call_next(request)
    response.headers["X-Request-ID"] = rid
    request.state.request_id = rid
    return response

# 全局异常处理器
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "code": exc.status_code, "message": exc.detail, "requestId": getattr(request.state, "request_id", None)},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"success": False, "code": 422, "message": "请求参数校验失败", "errors": exc.errors(), "requestId": getattr(request.state, "request_id", None)},
    )

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(f"未处理异常: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"success": False, "code": 500, "message": "服务器内部错误", "requestId": getattr(request.state, "request_id", None)},
    )

@app.get("/")
async def root():
    """根路径"""
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "description": settings.DESCRIPTION,
        "status": "running",
        "debug": settings.DEBUG,
    }

@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy", "service": settings.PROJECT_NAME}

@app.get("/ready")
async def readiness_check():
    """就绪检查"""
    # 检查数据库连接
    # 检查调度器状态
    # 检查Redis连接
    return {"status": "ready", "service": settings.PROJECT_NAME}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info" if settings.DEBUG else "warning",
    )
