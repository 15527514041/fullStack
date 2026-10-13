const pino = require('pino')

// 结构化日志:一行一条 JSON,方便被日志系统采集/检索(不再是拼给人看的字符串)
//
// 级别策略:LOG_LEVEL 环境变量优先,否则按环境给默认值
// - 测试: warn  —— 只留问题,不把几十条正常请求刷满 CI 输出
// - 生产: info  —— 请求 + 业务事件都记
// - 本地: debug —— 最详细,且用 pino-pretty 转成彩色单行,便于阅读
//
// 怎么判断"是不是本地":除了看 NODE_ENV,还看 pino-pretty 装没装 ——
// 它是开发依赖,服务器上 `npm ci --omit=dev` 不会有它。这样即使服务器忘了设
// NODE_ENV,也不会误开 debug 级别、也不会去找一个不存在的 transport。
const isTest = Boolean(process.env.NODE_TEST_CONTEXT) || process.env.NODE_ENV === 'test'

function resolvePinoPretty() {
  try {
    require.resolve('pino-pretty')
    return true
  } catch {
    return false
  }
}

const hasPretty = resolvePinoPretty()
const isProd = process.env.NODE_ENV === 'production' || !hasPretty

const defaultLevel = isTest ? 'warn' : isProd ? 'info' : 'debug'

// 本地才启用美化输出(服务器上没有 pino-pretty,直接用 transport 会启动失败)
function resolveTransport() {
  if (isProd || isTest) return undefined
  return {
    target: 'pino-pretty',
    options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' }
  }
}

const logger = pino({
  level: process.env.LOG_LEVEL || defaultLevel,
  transport: resolveTransport(),
  // 时间戳用 ISO:和浏览器、pm2 日志的时间能直接对上
  timestamp: pino.stdTimeFunctions.isoTime,
  // 兜底:token / cookie / 密码永远不进日志
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'password', 'token'],
    censor: '[REDACTED]'
  }
})

module.exports = logger
