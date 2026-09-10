const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateAvatar(userId, avatarUrl) {
  return prisma.user.update({
    where: { id: userId },
    data: { avatarUrl }
  })
}

module.exports = {
  updateAvatar
}