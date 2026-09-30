const AppError = require('../errors/AppError')

const prisma = require('../utils/prisma')

async function listTags(userId) {
  return prisma.tag.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { todos: true } }
    },
    orderBy: { id: 'asc' }
  })
}

async function createTag(userId, name) {
  const existing = await prisma.tag.findFirst({ where: { userId, name } })
  if (existing) {
    throw new AppError('标签已存在', 409)
  }

  return prisma.tag.create({
    data: { name, userId },
    select: { id: true, name: true, createdAt: true }
  })
}

async function deleteTag(userId, tagId) {
  const tag = await prisma.tag.findFirst({ where: { id: tagId, userId } })
  if (!tag) {
    throw new AppError('标签不存在', 404)
  }

  await prisma.tag.delete({ where: { id: tagId } })
  return { id: tagId }
}

module.exports = {
  listTags,
  createTag,
  deleteTag
}