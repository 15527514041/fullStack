const authService = require('../services/authService')
const { PrismaClient } = require('@prisma/client')
const AppError = require('../errors/AppError')

const auth = async (req, res, next) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    return next(new AppError('Authentication required', 401))
  }

  let payload
  try {
    payload = await authService.verifyToken(token)
  } catch (error) {
    return next(new AppError('Invalid or expired token', 401))
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, username: true, role: true, avatarUrl: true }
  })

  if (!user) {
    return next(new AppError('User not found', 401))
  }

  req.user = user
  next()
}

module.exports = auth