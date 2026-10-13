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
    select: { id: true, username: true, role: true, status: true, avatarOssId: true, passwordChangedAt: true }
  })

  if (!user) {
    return next(new AppError('User not found', 401))
  }

  // 改过密码后,「改密之前签发」的 token 全部作废(改完密码立刻踢下线)
  // 用签发时写进 token 的毫秒时间戳判断:JWT 自带的 iat 只有秒级精度,
  // 拿它比会把"改密后 1 秒内重新登录"的新 token 也误判成失效
  // 老 token 没有 iatMs(视为 0),所以改过密码的用户,它们一律失效
  if (user.passwordChangedAt && (payload.iatMs ?? 0) < user.passwordChangedAt.getTime()) {
    return next(new AppError('Invalid or expired token', 401))
  }

  // 被封禁的用户即使持有旧 token 也不能访问
  if (user.status === 'BANNED') {
    return next(new AppError('账号已被禁用', 403))
  }

  req.user = user
  next()
}

module.exports = auth
