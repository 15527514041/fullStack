const path = require('path')

// 显式加载 .env(必须在其它 require 之前)
// 已存在的环境变量不会被覆盖,所以测试时 DATABASE_URL=test npm test 依然优先用测试库
try {
  process.loadEnvFile(path.join(__dirname, '.env'))
} catch {
  // 没有 .env 时忽略(CI 环境用系统环境变量)
}

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')

const authRouter = require('./routes/auth')
const todosRouter = require('./routes/todos')
const tagsRouter = require('./routes/tags')
const userRouter = require('./routes/user')
const statsRouter = require('./routes/stats')
const adminRouter = require('./routes/admin')
const uploadRouter = require('./routes/upload')
const reflectionsRouter = require('./routes/reflections')
const plansRouter = require('./routes/plans')
const { notFound, errorHandler } = require('./middlewares/errorHandler')
const requestLogger = require('./middlewares/requestLogger')

const app = express()

// 反向代理场景:让 Express 认识真实客户端 IP(限流依赖它,否则所有人共用一个配额)
app.set('trust proxy', 1)

// 安全响应头 + 请求体上限
app.use(helmet())
app.use(express.json({ limit: '1mb' }))

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

app.use(cors({ origin: allowedOrigins }))
app.use(requestLogger)

// 测试环境关掉限流:用例会反复注册/登录(光 plans.test.js 一个文件就要 22 次),
// 不关的话会被自己的配额挡住,报一堆看不懂的 401/429。
// node --test 会在每个测试子进程里设置 NODE_TEST_CONTEXT,拿它判断"正在跑测试"
const isTestRun = Boolean(process.env.NODE_TEST_CONTEXT) || process.env.NODE_ENV === 'test'

// 登录/注册限流:同一 IP 15 分钟最多 20 次
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTestRun,
  message: { message: '请求过于频繁,请稍后再试' }
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authLimiter, authRouter)
app.use('/api/todos', todosRouter)
app.use('/api/tags', tagsRouter)
app.use('/api/users', userRouter)
app.use('/api/uploads', uploadRouter)
app.use('/api/stats', statsRouter)
app.use('/api/admin', adminRouter)
app.use('/api/reflections', reflectionsRouter)
app.use('/api/plans', plansRouter)

app.use(notFound)
app.use(errorHandler)

module.exports = app
