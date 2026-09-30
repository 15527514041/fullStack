const AppError = require('../errors/AppError')

const prisma = require('../utils/prisma')

const todoInclude = {
  tags: {
    select: { id: true, name: true }
  }
}

// 标签归属校验:只能关联自己的标签(传了别人的 id 直接 400)
async function normalizeTagIds(userId, tagIds) {
  if (!tagIds || tagIds.length === 0) return []

  const owned = await prisma.tag.findMany({
    where: { id: { in: tagIds }, userId },
    select: { id: true }
  })

  if (owned.length !== new Set(tagIds).size) {
    throw new AppError('标签不存在', 400)
  }

  return owned.map((tag) => tag.id)
}

// deleted=true 时查回收站(已删除的),默认只查未删除的
async function listTodos(userId, query) {
  const { page = 1, pageSize = 10, keyword, completed, tagId, deleted = false } = query

  const where = { userId, deletedAt: deleted ? { not: null } : null }
  if (keyword) {
    where.title = { contains: keyword, mode: 'insensitive' }
  }
  if (completed !== undefined) {
    where.completed = completed
  }
  if (tagId) {
    where.tags = { some: { id: tagId } }
  }

  const [list, total] = await Promise.all([
    prisma.todo.findMany({
      where,
      include: todoInclude,
      orderBy: { id: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.todo.count({ where })
  ])

  return { list, total, page, pageSize }
}

async function getTodoById(id, userId) {
  return prisma.todo.findFirst({
    where: { id, userId, deletedAt: null },
    include: todoInclude
  })
}

async function createTodo(data, userId) {
  const tagIds = await normalizeTagIds(userId, data.tagIds)

  return prisma.todo.create({
    data: {
      title: data.title,
      completed: data.completed ?? false,
      userId,
      tags: tagIds.length ? { connect: tagIds.map((id) => ({ id })) } : undefined
    },
    include: todoInclude
  })
}

async function updateTodo(id, userId, data) {
  const todo = await prisma.todo.findFirst({
    where: { id, userId, deletedAt: null }
  })
  if (!todo) {
    throw new AppError('Todo not found', 404)
  }

  const payload = {}
  if (data.title !== undefined) payload.title = data.title
  if (data.completed !== undefined) payload.completed = data.completed
  if (data.tagIds !== undefined) {
    const tagIds = await normalizeTagIds(userId, data.tagIds)
    payload.tags = { set: tagIds.map((tagId) => ({ id: tagId })) }
  }

  return prisma.todo.update({
    where: { id },
    data: payload,
    include: todoInclude
  })
}

// 软删除:打上 deletedAt 时间戳,记录仍在
async function deleteTodo(id, userId) {
  const todo = await prisma.todo.findFirst({
    where: { id, userId, deletedAt: null }
  })
  if (!todo) {
    throw new AppError('Todo not found', 404)
  }
  return prisma.todo.update({
    where: { id },
    data: { deletedAt: new Date() }
  })
}

async function restoreTodo(id, userId) {
  const todo = await prisma.todo.findFirst({
    where: { id, userId, deletedAt: { not: null } }
  })
  if (!todo) {
    throw new AppError('Todo not found', 404)
  }
  return prisma.todo.update({
    where: { id },
    data: { deletedAt: null },
    include: todoInclude
  })
}

module.exports = {
  listTodos,
  getTodoById,
  createTodo,
  updateTodo,
  deleteTodo,
  restoreTodo
}