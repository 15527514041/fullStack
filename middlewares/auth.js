const authService = require('../services/authService')
const prisma = require('../utils/prisma')
const AppError = require('../errors/AppError')

// 鉴权:验证 token → 从数据库取当前用户(拿最新角色和状态)→ 挂到 req.user
// 角色/状态不写进 JWT:管理员改动后立即生效,不用等用户重新登录
const auth = async (req, res, next) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    return next(new AppError('Authentication required', 401))
  }

  let payload
  try {
    payload = await authService.verifyToken(token)
  } catch {
    return next(new AppError('Invalid or expired token', 401))
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, username: true, role: true, status: true, avatarUrl: true }
  })

  if (!user) {
    return next(new AppError('User not found', 401))
  }

  // 被封禁的用户即使持有旧 token 也不能访问
  if (user.status === 'BANNED') {
    return next(new AppError('账号已被禁用', 403))
  }

  req.user = user
  next()
}

module.exports = auth