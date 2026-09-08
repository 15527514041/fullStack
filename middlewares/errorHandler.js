const AppError = require('../errors/AppError')

// 兜底 404 + 统一错误处理,必须注册在所有路由之后
const notFound = (req, res) => {
  res.status(404).json({ message: 'Not Found' })
}

const errorHandler = (err, req, res, next) => {
  const status = err instanceof AppError ? err.status : err.status || 500

  // 日志分级:5xx 是我们的 bug,打 error 带堆栈;4xx 是用户问题,打 warn 只记消息
  if (status >= 500) {
    console.error('[' + new Date().toISOString() + '] [unhandled]', err)
  } else {
    console.warn('[' + new Date().toISOString() + '] [' + status + ']', err.message)
  }

  const message = status >= 500 ? 'Internal Server Error' : err.message
  res.status(status).json({ message })
}

module.exports = {
  notFound,
  errorHandler
}