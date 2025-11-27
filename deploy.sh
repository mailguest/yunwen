#!/bin/bash

# 智能定时任务控制平台部署脚本

set -e

echo "🚀 开始部署智能定时任务控制平台..."

# 检查Docker和Docker Compose是否已安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

# 创建必要的目录
echo "📁 创建必要的目录..."
mkdir -p scheduler-backend/logs
mkdir -p scheduler-backend/uploads
mkdir -p docker/ssl

# 复制环境配置
echo "⚙️ 配置环境变量..."
if [ ! -f scheduler-backend/.env ]; then
    cp scheduler-backend/.env.example scheduler-backend/.env
    echo "✅ 已创建scheduler-backend/.env文件，请根据需要修改配置"
fi

# 构建和启动服务
echo "🏗️ 构建和启动服务..."
docker-compose down --remove-orphans
docker-compose build --no-cache
docker-compose up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 30

# 检查服务状态
echo "🔍 检查服务状态..."
docker-compose ps

# 健康检查
echo "🏥 执行健康检查..."
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ 后端服务运行正常"
else
    echo "❌ 后端服务未正常运行"
fi

if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ 前端服务运行正常"
else
    echo "❌ 前端服务未正常运行"
fi

# 显示访问信息
echo ""
echo "🎉 部署完成！"
echo "📊 前端访问地址: http://localhost:3000"
echo "🔧 后端API地址: http://localhost:8000"
echo "📖 API文档: http://localhost:8000/docs"
echo "📈 系统监控: http://localhost:8000/monitoring"
echo ""
echo "🔑 默认管理员账号:"
echo "   用户名: admin"
echo "   密码: admin123"
echo ""
echo "📋 常用命令:"
echo "   查看日志: docker-compose logs -f [service_name]"
echo "   停止服务: docker-compose down"
echo "   重启服务: docker-compose restart [service_name]"
echo "   进入容器: docker-compose exec [service_name] bash"