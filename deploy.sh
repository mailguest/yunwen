#!/bin/bash

set -e

echo "🚀 开始部署到本地 Docker..."

# 检查Docker是否已安装
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker未安装，请先安装Docker"
    exit 1
fi

# 优先使用 docker compose (v2)
compose_cmd="docker compose"
if ! docker compose version &> /dev/null; then
  if command -v docker-compose &> /dev/null; then
    compose_cmd="docker-compose"
  else
    echo "ERROR: 未检测到 docker compose 或 docker-compose"
    exit 1
  fi
fi

# 构建和启动服务（使用根目录 .env）
echo "构建和启动服务..."
$compose_cmd down --remove-orphans
$compose_cmd build --no-cache
$compose_cmd up -d

# 等待服务稳定
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo "检查服务状态..."
$compose_cmd ps

# 健康检查
echo "🏥 执行健康检查..."
if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "API 服务运行正常"
else
    echo "API 服务未正常运行"
fi

if curl -f http://localhost:3000/ > /dev/null 2>&1; then
    echo "前端服务运行正常"
else
    echo "前端服务未正常运行"
fi

echo "\n部署完成！"
echo "📊 前端访问地址: http://localhost:3000"
echo "🔧 后端API地址: http://localhost:3001"
echo "📖 API文档: http://localhost:3001/api/docs"
echo "\n📋 常用命令:"
echo "   查看日志: docker-compose logs -f [service_name]"
echo "   停止服务: docker-compose down"
echo "   重启服务: docker-compose restart [service_name]"
echo "   进入容器: docker-compose exec [service_name] sh"
