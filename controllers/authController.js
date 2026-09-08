const authService = require('../services/authService')

const register = async (req, res) => {
  const { username, password } = req.body || {}

  const user = await authService.register(username, password)
  res.status(201).json({ id: user.id, username: user.username })
}

const login = async (req, res) => {
  const { username, password } = req.body || {}

  const result = await authService.login(username, password)
  res.json(result)
}

module.exports = {
  register,
  login
}