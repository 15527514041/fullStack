const prisma = require('../utils/prisma')

async function findById(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      role: true
    }
  })
}

async function updateAvatar(userId, avatarUrl) {
  return prisma.user.update({
    where: { id: userId },
    data: { avatarUrl }
  })
}

module.exports = {
  findById,
  updateAvatar
}