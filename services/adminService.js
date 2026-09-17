const { PrismaClient } = require('@prisma/client')
const AppError = require('../errors/AppError')

const prisma = new PrismaClient()

async function listUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      username: true,
      role: true,
      avatarUrl: true,
      createdAt: true,
      _count: {
        select: { todos: true }
      }
    },
    orderBy: {
      id: 'asc'
    }
  })
}

async function updateUserRole(userId, role) {
  const user = await prisma.user.findUnique({ where: { id: userId }})
  if (!user) {
    throw new AppError('User not found', 404)
  }
  return prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, username: true, role: true }
  })
}

module.exports = {
  listUsers,
  updateUserRole
}