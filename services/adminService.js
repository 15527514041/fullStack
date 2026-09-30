const AppError = require('../errors/AppError')

const prisma = require('../utils/prisma')

async function listUsers(query) {
  const { page = 1, pageSize = 10, keyword } = query

  const where = {}
  if (keyword) {
    where.username = { contains: keyword, mode: 'insensitive' }
  }

  const [list, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
        avatarUrl: true,
        createdAt: true,
        _count: { select: { todos: true } }
      },
      orderBy: { id: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.user.count({ where })
  ])

  return { list, total, page, pageSize }
}

async function updateUserRole(userId, role) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new AppError('User not found', 404)
  }
  return prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, username: true, role: true, status: true }
  })
}

async function updateUserStatus(userId, status) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new AppError('User not found', 404)
  }
  return prisma.user.update({
    where: { id: userId },
    data: { status },
    select: { id: true, username: true, role: true, status: true }
  })
}

module.exports = {
  listUsers,
  updateUserRole,
  updateUserStatus
}