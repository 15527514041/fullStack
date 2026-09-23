# 用 debian-slim 而不是 alpine:Prisma 需要 openssl,alpine 上经常要额外折腾
FROM node:20-slim

WORKDIR /app

# Prisma 引擎依赖 openssl
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# 先拷依赖清单,利用层缓存:依赖没变时这层不用重装
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npx prisma generate

# 再拷源码:源码改动只影响后面的层
COPY app.js server.js ./
COPY routes ./routes
COPY controllers ./controllers
COPY services ./services
COPY middlewares ./middlewares
COPY errors ./errors
COPY validators ./validators
COPY utils ./utils
COPY prisma ./prisma

ENV NODE_ENV=production
EXPOSE 3008

# 以非 root 用户运行(镜像自带 node 用户),并保证 uploads 可写
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

CMD ["node", "server.js"]