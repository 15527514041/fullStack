# Fullstack 20h Frontend

企业级前端脚手架:Vite + Vue 3 + TypeScript + Element Plus + Pinia + Axios。

## 快速开始

npm install
npm run dev

开发环境由 Vite 代理将 /auth、/todos 转发到 http://localhost:3008,无需处理跨域。

## 常用命令

- npm run dev —— 本地开发(默认 http://localhost:5173)
- npm run build —— 类型检查 + 生产构建(输出 dist/)
- npm run preview —— 预览生产构建

## 目录结构

src/
  api/         axios 实例封装(拦截器)与接口模块
  router/      路由与全局守卫
  stores/      Pinia 状态(登录态)
  types/       全局类型
  utils/       工具(本地 token 存取)
  views/       页面(登录、TODO 列表)

## 环境变量

- .env.development —— VITE_API_BASE_URL 留空,走 Vite 代理
- .env.production —— 部署时改成真实后端地址