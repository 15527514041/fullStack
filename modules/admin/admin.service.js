const AppError = require('../../errors/AppError')

const prisma = require('../../utils/prisma')

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

// 管理员删除用户:账号连同它的数据一起清掉,不可恢复
//
// 删除顺序有讲究:TODO / 标签对 User 是 RESTRICT(数据库不允许直接删有数据的用户),
// 必须先删;每日反思 / 每日规划对 User 是 Cascade,删用户时自动带走。
// 上传记录不删:Upload.uploaderId 是 SetNull,记录留着(OSS 里的文件也不会因为删账号被清理)。
async function deleteUser(operatorId, targetId) {
  // 防止管理员把自己删掉(和"不能改自己的角色/状态"同一个道理)
  if (operatorId === targetId) {
    throw new AppError('不能删除自己', 400)
  }

  const user = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      username: true,
      // 删之前先数一遍,返回给前端提示"顺手清掉了多少数据"
      _count: { select: { todos: true, tags: true, reflections: true, plans: true } }
    }
  })

  if (!user) {
    throw new AppError('用户不存在', 404)
  }

  // 三条语句放在一个事务里:中途失败就整体回滚,不会留下"删了一半"的账号
  await prisma.$transaction([
    prisma.todo.deleteMany({ where: { userId: targetId } }),
    prisma.tag.deleteMany({ where: { userId: targetId } }),
    prisma.user.delete({ where: { id: targetId } })
  ])

  return {
    username: user.username,
    removed: {
      todos: user._count.todos,
      tags: user._count.tags,
      reflections: user._count.reflections,
      plans: user._count.plans
    }
  }
}

module.exports = {
  listUsers,
  updateUserRole,
  updateUserStatus,
  deleteUser
}
