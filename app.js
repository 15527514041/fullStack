const path = require('path')
// 显式加载 .env:已存在的环境变量不会被覆盖
// (所以测试时 DATABASE_URL=test npm test 依然优先用测试库)
try {
  process.loadEnvFile(path.join(__dirname, '.env'))
} catch {
  // 没有 .env 时忽略(CI 环境用系统环境变量)
}
const express = require('express')
const cors = require('cors')
const todosRouter = require('./routes/todos')
const authRouter = require('./routes/auth')
const statsRouter = require('./routes/stats')
const userRouter = require('./routes/user')
const adminRouter = require('./routes/admin')
const { notFound, errorHandler } = require('./middlewares/errorHandler')
const requestLogger = require('./middlewares/requestLogger')

const app = express()

const helmet = require('helmet')
const rateLimit = require('express-rate-limit')

// 反向代理场景:让 Express 认识真实客户端 IP(否则限流会把所有人当成同一个 IP!)
app.set('trust proxy', 1)

// 安全响应头:X-Frame-Options(防点击劫持)、X-Content-Type-Options 等
app.use(helmet())

// 请求体上限,防超大 JSON 打爆内存
app.use(express.json({ limit: '1mb' }))

// 登录/注册限流:同一 IP 15 分钟最多 20 次
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: '请求过于频繁,请稍后再试' }
})

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
.split(',')
.map((item) => item.trim())
.filter(Boolean)

app.use(cors({
  origin: allowedOrigins
}))
app.use(express.json())
app.use(requestLogger)

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authLimiter, authRouter)
app.use('/api/todos', todosRouter)
app.use('/api/stats', statsRouter)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
app.use('/api/users', userRouter)
app.use('/api/admin', adminRouter)

app.use(notFound)
app.use(errorHandler)

module.exports = app