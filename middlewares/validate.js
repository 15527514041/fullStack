// 通用验证中间件：用 zod schema 校验 body 、 query 、 params

const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source])
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message
      }))
      return res.status(400).json({ message: 'Validation failed', errors})
    }
    req.validated = req.validated || {}
    req.validated[source] = result.data
    next()
  }
}

module.exports = validate