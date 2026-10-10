const AppError = require('../errors/AppError')

const prisma = require('../utils/prisma')

const todoInclude = {
  tags: {
    // type 要带上:前端标签按类型着色(漏了就会全部回落到默认色)
    select: { id: true, name: true, type: true }
  },
  // 附件走关联表,按 sortOrder 排序;只回传元信息,地址由前端按 ossId 换
  attachments: {
    orderBy: { sortOrder: 'asc' },
    select: {
      ossId: true,
      sortOrder: true,
      upload: { select: { id: true, key: true, originalName: true, mime: true, size: true, visibility: true } }
    }
  }
}

// 关联表结构比较深,统一拍平成前端好用的数组
function toTodoDTO(todo) {
  if (!todo) return todo
  const { attachments = [], ...rest } = todo

  return {
    ...rest,
    attachments: attachments.map((item) => ({
      ossId: item.ossId,
      sortOrder: item.sortOrder,
      key: item.upload?.key,
      originalName: item.upload?.originalName ?? null,
      mime: item.upload?.mime,
      size: item.upload?.size,
      visibility: item.upload?.visibility
    }))
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

// 附件归属校验:只能挂自己上传的文件(传了别人的 id 直接 400);去重并保持顺序
async function normalizeAttachmentIds(userId, ossIds) {
  if (!ossIds || ossIds.length === 0) return []

  const unique = [...new Set(ossIds)]
  const owned = await prisma.upload.findMany({
    where: { id: { in: unique }, uploaderId: userId },
    select: { id: true }
  })
  if (owned.length !== unique.length) {
    throw new AppError('附件不存在', 400)
  }

  return unique
}

// 备注:空字符串统一存 null
function normalizeRemark(value) {
  if (value === undefined) return undefined
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || null
}

// deleted=true 时查回收站(已删除的),默认只查未删除的
async function listTodos(userId, query) {
  const { page = 1, pageSize = 10, keyword, completed, tagId, deleted = false, from, to } = query

  const where = { userId, deletedAt: deleted ? { not: null } : null }
  // 创建时间范围:前端传的是按用户本地时区算好的 UTC 时刻(ISO 字符串)
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {})
    }
  }
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

  return { list: list.map(toTodoDTO), total, page, pageSize }
}

async function getTodoById(id, userId) {
  const todo = await prisma.todo.findFirst({
    where: { id, userId, deletedAt: null },
    include: todoInclude
  })
  return toTodoDTO(todo)
}

async function createTodo(data, userId) {
  const tagIds = await normalizeTagIds(userId, data.tagIds)
  const attachmentIds = await normalizeAttachmentIds(userId, data.attachmentOssIds)

  const todo = await prisma.todo.create({
    data: {
      title: data.title,
      remark: normalizeRemark(data.remark) ?? null,
      completed: data.completed ?? false,
      userId,
      tags: tagIds.length ? { connect: tagIds.map((id) => ({ id })) } : undefined,
      attachments: attachmentIds.length
        ? { create: attachmentIds.map((ossId, index) => ({ ossId, sortOrder: index })) }
        : undefined
    },
    include: todoInclude
  })
  return toTodoDTO(todo)
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
  if (data.remark !== undefined) payload.remark = normalizeRemark(data.remark)
  if (data.attachmentOssIds !== undefined) {
    // 传空数组表示清空附件;整体替换(先删后建,顺序即数组顺序)
    const attachmentIds = await normalizeAttachmentIds(userId, data.attachmentOssIds)
    payload.attachments = {
      deleteMany: {},
      create: attachmentIds.map((ossId, index) => ({ ossId, sortOrder: index }))
    }
  }
  if (data.completed !== undefined) payload.completed = data.completed
  if (data.tagIds !== undefined) {
    const tagIds = await normalizeTagIds(userId, data.tagIds)
    payload.tags = { set: tagIds.map((tagId) => ({ id: tagId })) }
  }

  const updated = await prisma.todo.update({
    where: { id },
    data: payload,
    include: todoInclude
  })
  return toTodoDTO(updated)
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
  const restored = await prisma.todo.update({
    where: { id },
    data: { deletedAt: null },
    include: todoInclude
  })
  return toTodoDTO(restored)
}

module.exports = {
  listTodos,
  getTodoById,
  createTodo,
  updateTodo,
  deleteTodo,
  restoreTodo
}
