FROM node:20-slim

WORKDIR /app

# Prisma 引擎依赖 openssl
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# 第 1 层:依赖清单 → 依赖没变就不重装
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 第 2 层:schema → 只有 schema 变了才重新生成 client
COPY prisma ./prisma
RUN npx prisma generate

# 第 3 层:业务源码 → 改代码只影响这一层及之后
COPY app.js server.js ./
COPY routes ./routes
COPY controllers ./controllers
COPY services ./services
COPY middlewares ./middlewares
COPY errors ./errors
COPY validators ./validators
COPY utils ./utils

ENV NODE_ENV=production
EXPOSE 3008

# 非 root 用户运行,并保证 uploads 目录可写
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

CMD ["node", "server.js"]