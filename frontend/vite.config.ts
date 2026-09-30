import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// 本地开发默认把 /api、/uploads 代理到线上环境,方便直接用真实数据预览
// 想连本地后端:在 .env.development 里把 VITE_PROXY_TARGET 改成 http://localhost:3008
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_PROXY_TARGET || 'http://112.74.35.140'

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      port: 5173,
      host: true, // 允许局域网访问,手机可用 http://本机IP:5173 预览
      proxy: {
        '/api': {
          target,
          changeOrigin: true
        },
        '/uploads': {
          target,
          changeOrigin: true
        }
      }
    }
  }
})