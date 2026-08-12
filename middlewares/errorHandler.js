// 兜底 404 + 统一错误处理，必须注册在所有路由之后

const notFound = (req, res) => {
  res.status(404).json({ message: 'Not Found' })
}

const errorHandler = (err, req, res, next) => {
  console.error('[' + new Date().toISOString() + ']', err)
  const status = err.status || err.statusCode || 500
  const message = status >= 500 ? 'Internal Server Error' : err.message
  res.status(status).json({ message })
}

module.exports = {
  notFound,
  errorHandler
}