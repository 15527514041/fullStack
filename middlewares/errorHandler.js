// 兜底 404 + 统一错误处理，必须注册在所有路由之后

const notFound = (req, res) => {
  res.status(404).json({ message: 'Not Found' })
}

const errorHandler = (err, req, res, next) => {
  const status = err instanceof AppError ? err.status : err.status || 500
  if (status >= 500) {
    console.log('[' + new Date().toISOString() + '][ unhandled]', err)
  } else {
    console.log('[' + new Date().toISOString() + '] [' + status + ']', err.message)
  }

  const message = status >=500 ? 'Internal Server Error' : err.message
  res.status(status).json({ message })
}

module.exports = {
  notFound,
  errorHandler
}