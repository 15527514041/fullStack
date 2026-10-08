const prisma = require('../utils/prisma')

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

module.exports = {
  findById,
  updateAvatar
}
