# 认证相关接口

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import timedelta
from loguru import logger

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, verify_password, get_password_hash
from app.models import User
from app.schemas.auth import LoginRequest, LoginResponse, UserResponse, ProfileUpdate, ChangePasswordRequest
from app.services.user_service import UserService

router = APIRouter()
security = HTTPBearer()

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """用户登录"""
    try:
        user_service = UserService(db)
        
        # 验证用户
        user = await user_service.get_user_by_email(request.email)
        if not user or not verify_password(request.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="邮箱或密码错误",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="用户账户已被禁用",
            )
        
        # 创建访问令牌
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id), "email": user.email, "role": user.role},
            expires_delta=access_token_expires
        )
        
        # 记录登录日志
        logger.info(f"用户 {user.email} 登录成功")
        
        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse(
                id=str(user.id),
                email=user.email,
                username=user.username,
                role=user.role,
                is_active=user.is_active,
                created_at=user.created_at
            )
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"登录失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="登录失败，请稍后重试"
        )

@router.post("/logout")
async def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """用户登出"""
    # 在实际应用中，可以将令牌加入黑名单
    # 这里只是返回成功响应
    return {"message": "登出成功"}

@router.get("/me", response_model=UserResponse)
async def get_current_user(current_user: User = Depends(get_current_user)):
    """获取当前用户信息"""
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        username=current_user.username,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at
    )

@router.put("/profile")
async def update_profile(
    profile_data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """更新用户个人信息"""
    try:
        user_service = UserService(db)
        
        # 更新用户信息
        updated_user = await user_service.update_user(
            str(current_user.id),
            profile_data.dict(exclude_unset=True)
        )
        
        logger.info(f"用户 {current_user.email} 更新了个人信息")
        
        return UserResponse(
            id=str(updated_user.id),
            email=updated_user.email,
            username=updated_user.username,
            role=updated_user.role,
            is_active=updated_user.is_active,
            created_at=updated_user.created_at
        )
        
    except Exception as e:
        logger.error(f"更新用户信息失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新用户信息失败"
        )

@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """修改密码"""
    try:
        user_service = UserService(db)
        
        # 验证旧密码
        if not verify_password(body.old_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="旧密码错误"
            )
        
        # 更新密码
        new_password_hash = get_password_hash(body.new_password)
        await user_service.update_user(
            str(current_user.id),
            {"password_hash": new_password_hash}
        )
        
        logger.info(f"用户 {current_user.email} 修改了密码")
        
        return {"message": "密码修改成功"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"修改密码失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="修改密码失败"
        )
