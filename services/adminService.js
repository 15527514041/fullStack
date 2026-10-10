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
        avatarOssId: true,
        createdAt: true,
        lastLoginAt: true,
        // 列表里展示三类内容的数量:待办 / 反思 / 每日规划
        // 待办要排除回收站(软删除)里的,和列表口径一致;反思 / 规划没有软删除,直接计数
        _count: {
          select: {
            todos: { where: { deletedAt: null } },
            reflections: true,
            plans: true
          }
        }
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
