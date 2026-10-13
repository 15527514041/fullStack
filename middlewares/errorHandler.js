const AppError = require('../errors/AppError')
const logger = require('../utils/logger')

// 兜底 404 + 统一错误处理,必须注册在所有路由之后
const notFound = (req, res) => {
  res.status(404).json({ message: 'Not Found' })
}

const errorHandler = (err, req, res, next) => {
  const status = err instanceof AppError ? err.status : err.status || 500

  // req.log 是 requestLogger 挂上的子 logger,自带 requestId —— 出问题时能用它把
  // "这条错误日志"和"触发它的那次请求日志"对上(没有就退回全局 logger)
  // 分级:5xx 是我们的 bug,打 error 带堆栈;4xx 是调用方问题,打 warn 只记消息
  const log = req.log || logger
  if (status >= 500) {
    log.error({ err, statusCode: status }, 'unhandled error')
  } else {
    log.warn({ statusCode: status }, err.message)
  }

  const message = status >= 500 ? 'Internal Server Error' : err.message
  res.status(status).json({ message })
}

module.exports = {
  notFound,
  errorHandler
}
