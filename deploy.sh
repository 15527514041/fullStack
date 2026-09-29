#!/usr/bin/env bash
set -euo pipefail      # 任何一步失败立即退出,不掩盖错误

cd /root/fullStack

echo "==> 1/5 拉取最新代码"
git pull --ff-only

echo "==> 2/5 后端依赖 + 数据库迁移"
npm ci --omit=dev
npx prisma migrate deploy

echo "==> 3/5 重启后端(pm2 reload)"
pm2 reload fullstack-backend

echo "==> 4/5 前端构建 + 发布"
cd frontend
npm ci
npm run build
cp -r dist/* /var/www/fullstack/

echo "==> 5/5 健康检查"
cd /root/fullStack
sleep 2
curl -fsS http://127.0.0.1:3008/health
echo
echo "✅ 部署完成"