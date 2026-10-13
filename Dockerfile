# 后端镜像 —— 容器化路线用(Dockerfile + docker-compose.yml)
# 注意:生产实际跑的是 pm2 + Nginx(deploy.sh),这个镜像用于「干净环境验证」和容器化备选,
# 两条路线互不依赖,只是都从同一份源码构建
FROM node:20-slim

WORKDIR /app

# Prisma 引擎依赖 openssl,slim 镜像里不带
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# 第 1 层:依赖清单 → 依赖没变就不重装
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 第 2 层:schema → 只有 schema 变了才重新生成 client
COPY prisma ./prisma
RUN npx prisma generate

# 第 3 层:业务源码 → 改代码只影响这一层及之后
COPY app.js server.js ./
COPY modules ./modules
COPY middlewares ./middlewares
COPY errors ./errors
COPY validators ./validators
COPY utils ./utils

ENV NODE_ENV=production
EXPOSE 3008

# 非 root 用户运行(文件都存 OSS,容器内没有需要写的目录)
# 注:这一行会把整个 /app 再落一层;想省这层可以让每条 COPY 带 --chown=node:node,
# 但 node_modules 是 root 装的、仍要单独 chown,这里保持一行搞定
RUN chown -R node:node /app
USER node

# 健康检查:用 node 自带的 fetch(slim 镜像里没有 curl/wget),失败时容器状态变 unhealthy
# 用 exec 形式避免 shell 解析,也不需要额外装工具
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3008) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "server.js"]
