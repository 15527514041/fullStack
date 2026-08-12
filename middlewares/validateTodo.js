// middleware 层：校验、日志、鉴权这类横切逻辑放这里

function validateTodo({ requireTitle = false } = {}) {
  return (req, res, next) => {
    const body = req.body || {}

    if (requireTitle && (typeof body.title !== 'string' || body.title.trim() === '')) {
      return res.status(400).json( { message: 'Title is required' })
    }

    if (body.title !== undefined && (typeof body.title !== 'string' || body.title.trim() === '')) {
      return res.status(400).json( { message: 'Title must be a non-empty string' })
    }

    if (body.completed !== undefined && typeof body.completed !== 'boolean') {
      return res.status(400).json( { message: 'Completed must be a boolean' })
    }

    next()
  }
}

module.exports = validateTodo