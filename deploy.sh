#!/usr/bin/env bash
set -euo pipefail      # 任何一步失败立即退出,不掩盖错误

# ============ 用法: bash deploy.sh prod | bash deploy.sh dev ============
# 两个环境的差异全部集中在这一个 case 里,下面的步骤完全复用
TARGET="${1:-}"
case "$TARGET" in
  prod)
    DIR=/root/fullStack
    PM2_NAME=fullstack-backend
    BRANCH=master
    DB_NAME=fullstack
    PORT=3008
    WEB_DIR=/var/www/fullstack
    ;;
  dev)
    DIR=/root/fullStack-dev
    PM2_NAME=fullstack-dev
    BRANCH=dev
    DB_NAME=fullstack_dev
    PORT=3010
    WEB_DIR=/var/www/fullstack-dev
    ;;
  *)
    echo "用法: bash deploy.sh prod|dev"
    exit 1
    ;;
esac

echo "==> 目标环境:$TARGET | 目录 $DIR | 进程 $PM2_NAME | 端口 $PORT | 库 $DB_NAME"

cd "$DIR"

# ---------- 防呆 1:分支必须匹配(防止把 dev 的代码部署成生产) ----------
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  echo "❌ 分支不匹配:$DIR 当前在 $CURRENT_BRANCH,期望 $BRANCH"
  exit 1
fi

# ---------- 防呆 2:.env 指向的库必须是这个环境的库 ----------
# 从 DATABASE_URL 里取出末尾的库名(顺便去掉可能存在的引号)
DB_URL=$(grep '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')
ENV_DB="${DB_URL##*/}"
if [ "$ENV_DB" != "$DB_NAME" ]; then
  echo "❌ 库名不匹配:.env 里是 $ENV_DB,期望 $DB_NAME"
  exit 1
fi

# ---------- 防呆 3:pm2 进程必须已存在(reload 只重启,不会创建) ----------
if ! pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  echo "❌ 进程 $PM2_NAME 不存在,请先执行:"
  echo "   cd $DIR && pm2 start server.js --name $PM2_NAME && pm2 save"
  exit 1
fi

echo "==> 1/5 拉取最新代码"
git pull --ff-only

echo "==> 2/5 后端依赖 + 数据库迁移"
npm ci --omit=dev
npx prisma migrate deploy

echo "==> 3/5 重启后端(pm2 reload)"
pm2 reload "$PM2_NAME"

echo "==> 4/5 前端构建 + 发布"
cd frontend
npm ci
npm run build
mkdir -p "$WEB_DIR"
cp -r dist/* "$WEB_DIR/"

echo "==> 5/5 健康检查"
cd "$DIR"
sleep 2
curl -fsS "http://127.0.0.1:$PORT/health"
echo
echo "✅ [$TARGET] 部署完成"