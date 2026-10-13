const prisma = require('../utils/prisma')
const bcrypt = require('bcryptjs')
const AppError = require('../errors/AppError')

async function findById(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      avatarOssId: true,
      role: true
    }
  })
}

async function updateAvatar(userId, avatarOssId) {
  return prisma.user.update({
    where: { id: userId },
    data: { avatarOssId }
  })
}

// 修改自己的密码:先验原密码,再把新密码加密写库(库里永远只存哈希)
// 同时更新 passwordChangedAt —— 鉴权中间件靠它作废"改密之前签发"的所有 token
// 只碰 password / passwordChangedAt 两个字段,头像/角色/状态都不动
async function changePassword(userId, oldPassword, password) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true }
  })

  // 鉴权中间件已经查过一次用户,这里只是兜底
  if (!user) {
    throw new AppError('User not found', 401)
  }

  const valid = await bcrypt.compare(oldPassword, user.password)
  if (!valid) {
    // 这里必须是 400 不能是 401:前端拦截器把 401 当"登录过期",会直接把用户踢回登录页
    throw new AppError('原密码不正确', 400)
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword, passwordChangedAt: new Date() }
  })
}

module.exports = {
  findById,
  updateAvatar,
  changePassword
}
