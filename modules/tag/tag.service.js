const AppError = require('../../errors/AppError')

const prisma = require('../../utils/prisma')

// 标签域:任务用 TODO,记账用 ACCOUNTING
// 业务模块引用这里,别自己写字符串字面量;将来加新域只加一个键
const TAG_SCOPE = {
  TODO: 'TODO',
  ACCOUNTING: 'ACCOUNTING'
}

// 不传 scope 就是全部域的标签(管理页「全部」分类用)
async function listTags(userId, { scope } = {}) {
  return prisma.tag.findMany({
    where: { userId, ...(scope ? { scope } : {}) },
    select: {
      id: true,
      name: true,
      color: true,
      enabled: true,
      sortOrder: true,
      scope: true,
      createdAt: true,
      _count: { select: { todos: true, ledgerItems: true } }
    },
    orderBy: [{ scope: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }]
  })
}

async function nextSortOrder(userId, scope) {
  const last = await prisma.tag.findFirst({
    where: { userId, scope },
    select: { sortOrder: true },
    orderBy: { sortOrder: 'desc' }
  })
  return (last?.sortOrder ?? -1) + 1
}

async function createTag(userId, { name, color, scope, enabled, sortOrder }) {
  // 重名只在同一个域里算重名:不同域可以有同名标签
  const existing = await prisma.tag.findFirst({ where: { userId, scope, name } })
  if (existing) {
    throw new AppError('该分类下已存在同名标签', 409)
  }

  const order = sortOrder === undefined ? await nextSortOrder(userId, scope) : sortOrder
  return prisma.tag.create({
    data: { name, color, enabled: enabled ?? true, scope, sortOrder: order, userId },
    select: {
      id: true,
      name: true,
      color: true,
      enabled: true,
      sortOrder: true,
      scope: true,
      createdAt: true
    }
  })
}

async function updateTag(userId, tagId, { name, color, enabled, sortOrder }) {
  const tag = await prisma.tag.findFirst({ where: { id: tagId, userId } })
  if (!tag) {
    throw new AppError('标签不存在', 404)
  }

  // 改名时校验重名,排除自己;只在同一个域里比,跨域同名是允许的
  if (name !== undefined && name !== tag.name) {
    const existing = await prisma.tag.findFirst({
      where: { userId, scope: tag.scope, name, id: { not: tagId } }
    })
    if (existing) {
      throw new AppError('该分类下已存在同名标签', 409)
    }
  }

  return prisma.tag.update({
    where: { id: tagId },
    data: {
      ...(name === undefined ? {} : { name }),
      ...(color === undefined ? {} : { color }),
      ...(enabled === undefined ? {} : { enabled }),
      ...(sortOrder === undefined ? {} : { sortOrder })
      // scope 故意不在这里:域是标签的身份,建完不能改(接口层也会拦)
    },
    select: {
      id: true,
      name: true,
      color: true,
      enabled: true,
      sortOrder: true,
      scope: true,
      createdAt: true
    }
  })
}

async function deleteTag(userId, tagId) {
  const tag = await prisma.tag.findFirst({
    where: { id: tagId, userId },
    select: {
      id: true,
      _count: { select: { todos: true, ledgerItems: true } }
    }
  })
  if (!tag) {
    throw new AppError('标签不存在', 404)
  }

  const related = tag._count.todos + tag._count.ledgerItems
  if (related > 0) {
    throw new AppError(`该字典已关联 ${related} 条数据，无法删除，可选择禁用`, 409)
  }

  await prisma.tag.delete({ where: { id: tagId } })
  return { id: tagId }
}

// 通用能力:业务模块(任务、以后的记账...)关联标签前都走这里
// 一次把两件事验掉:标签是自己 + 标签属于指定的域(TODO 挂不上记账的标签)
// 返回去重后的标签 id,顺序保持调用方传入的顺序
async function assertOwnedTagIds(userId, tagIds, scope) {
  if (!tagIds || tagIds.length === 0) return []

  const unique = [...new Set(tagIds)]
  const owned = await prisma.tag.findMany({
    where: { id: { in: unique }, userId, scope },
    select: { id: true }
  })

  // 不是自己的 / 不存在 / 域不对,对外都只说「不存在」,不透露别的用户的标签是否存在
  if (owned.length !== unique.length) {
    throw new AppError('标签不存在', 400)
  }

  return unique
}

module.exports = {
  TAG_SCOPE,
  listTags,
  createTag,
  updateTag,
  deleteTag,
  assertOwnedTagIds
}
