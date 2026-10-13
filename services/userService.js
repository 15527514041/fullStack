const prisma = require('../utils/prisma')
const bcrypt = require('bcryptjs')

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

// 修改自己的密码:入参里的明文密码到这里才加密,库里永远只存哈希
// 只改 password 一个字段,头像/角色/状态都不碰
async function changePassword(userId, password) {
  const hashedPassword = await bcrypt.hash(password, 10)

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword }
  })
}

module.exports = {
  findById,
  updateAvatar,
  changePassword
}
