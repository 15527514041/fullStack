const authService = require('../services/authService')

const register = async (req, res) => {
  const { username, password } = req.body || {}

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' })
  }

  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' })
  }

  const user = await authService.register(username, password)
  res.status(201).json({ id: user.id, username: user.username })
}

const login = async (req, res) => {
  const { username, password } = req.body || {}

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' })
  }

  const result = await authService.login(username, password)
  res.json(result)
}

module.exports = {
  register,
  login
}