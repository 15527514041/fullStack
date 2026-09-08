const authService = require('../services/authService')

// 入参已在 validate 中间件里完成校验,解析结果在 req.validated.body
const register = async (req, res) => {
  const { username, password } = req.validated.body
  const user = await authService.register(username, password)
  res.status(201).json({ id: user.id, username: user.username })
}

const login = async (req, res) => {
  const { username, password } = req.validated.body
  const result = await authService.login(username, password)
  res.json(result)
}

module.exports = {
  register,
  login
}