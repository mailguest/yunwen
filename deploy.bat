@echo off
REM 智能定时任务控制平台部署脚本 (Windows)

echo 🚀 开始部署智能定时任务控制平台...

REM 检查Docker是否已安装
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Docker未安装，请先安装Docker
    exit /b 1
)

REM 检查Docker Compose是否已安装
docker-compose version >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Docker Compose未安装，请先安装Docker Compose
    exit /b 1
)

REM 创建必要的目录
echo 📁 创建必要的目录...
if not exist scheduler-backend\logs mkdir scheduler-backend\logs
if not exist scheduler-backend\uploads mkdir scheduler-backend\uploads
if not exist docker\ssl mkdir docker\ssl

REM 复制环境配置
echo ⚙️ 配置环境变量...
if not exist scheduler-backend\.env (
    copy scheduler-backend\.env.example scheduler-backend\.env
    echo ✅ 已创建scheduler-backend\.env文件，请根据需要修改配置
)

REM 构建和启动服务
echo 🏗️ 构建和启动服务...
docker-compose down --remove-orphans
docker-compose build --no-cache
docker-compose up -d

REM 等待服务启动
echo ⏳ 等待服务启动...
timeout /t 30 /nobreak >nul

REM 检查服务状态
echo 🔍 检查服务状态...
docker-compose ps

REM 健康检查
echo 🏥 执行健康检查...
curl -f http://localhost:8000/health >nul 2>nul
if %errorlevel% equ 0 (
    echo ✅ 后端服务运行正常
) else (
    echo ❌ 后端服务未正常运行
)

curl -f http://localhost:3000 >nul 2>nul
if %errorlevel% equ 0 (
    echo ✅ 前端服务运行正常
) else (
    echo ❌ 前端服务未正常运行
)

REM 显示访问信息
echo.
echo 🎉 部署完成！
echo 📊 前端访问地址: http://localhost:3000
echo 🔧 后端API地址: http://localhost:8000
echo 📖 API文档: http://localhost:8000/docs
echo 📈 系统监控: http://localhost:8000/monitoring
echo.
echo 🔑 默认管理员账号:
echo    用户名: admin
echo    密码: admin123
echo.
echo 📋 常用命令:
echo    查看日志: docker-compose logs -f [service_name]
echo    停止服务: docker-compose down
echo    重启服务: docker-compose restart [service_name]
echo    进入容器: docker-compose exec [service_name] bash

pause