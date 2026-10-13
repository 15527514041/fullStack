const { randomUUID } = require('crypto')
const { pinoHttp } = require('pino-http')

const logger = require('../utils/logger')

// 每个请求一条结构化日志:方法 / 路径 / 状态码 / 耗时 / requestId
// pino-http 会把子 logger 挂到 req.log 上,后面 errorHandler 用它记错误,
// 于是"这次请求"和"这次请求里出的错"共享同一个 requestId —— 这就是链路追踪的最小版本
const requestLogger = pinoHttp({
  logger,

  // 客户端/网关带了 X-Request-Id 就沿用(前后端联调时能直接对上),没有就生成一个
  // 同时写回响应头:浏览器 Network 面板里能看到,报错时可以直接把 id 报出来
  genReqId: (req, res) => {
    const id = req.headers['x-request-id'] || randomUUID()
    res.setHeader('x-request-id', id)
    return id
  },

  // 只记关心的字段:pino-http 默认会把整个 headers 打进去(含 Authorization),这里收窄
  // 注意 id 必须自己带上 —— 覆盖了默认序列化器,不写它 requestId 就丢了(链路追踪就断了)
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.originalUrl || req.url, ip: req.ip }),
    res: (res) => ({ statusCode: res.statusCode })
  },

  // 日志分级:5xx 是我们的 bug、4xx 是调用方问题、2xx/3xx 正常
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error'
    if (res.statusCode >= 400) return 'warn'
    return 'info'
  },

  // 健康检查每次部署都会被探,不记它,免得刷屏
  autoLogging: { ignore: (req) => req.url === '/health' }
})

module.exports = requestLogger
