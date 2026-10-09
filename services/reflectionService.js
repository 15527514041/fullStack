const AppError = require('../errors/AppError')

const prisma = require('../utils/prisma')

// 库里是 DATE 类型:接口收发都用 YYYY-MM-DD,落库固定 UTC 零点,避免时区把日期挪一天
function toDateValue(date) {
  return new Date(`${date}T00:00:00.000Z`)
}

function toDateString(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
}

// 唯一索引 (userId, date) 是最后一道防线:并发插入时靠它兜底
function isUniqueViolation(error) {
  return error?.code === 'P2002'
}

// 同一天只能有一条:先查一次给出明确的 409,并发时再由唯一索引 + P2002 兜底
async function assertDateAvailable(userId, date, excludeId) {
  const existing = await prisma.dailyReflection.findFirst({
    where: {
      userId,
      date: toDateValue(date),
      ...(excludeId ? { id: { not: excludeId } } : {})
    },
    select: { id: true }
  })

  if (existing) {
    throw new AppError('该日期已有反思记录', 409)
  }
}

// 数组顺序即展示顺序,序号由后端生成
function buildItems(items) {
  return items.map((item, index) => ({
    experience: item.experience,
    reason: item.reason || null,
    measure: item.measure || null,
    sortOrder: index
  }))
}

const reflectionInclude = {
  items: { orderBy: { sortOrder: 'asc' } }
}

// 出参统一在这里拍平:前端只认 date 字符串 + items 数组
function toReflectionDTO(record) {
  if (!record) return record
  const { items = [], ...rest } = record

  return {
    ...rest,
    date: toDateString(record.date),
    items: items.map((item) => ({
      id: item.id,
      experience: item.experience,
      reason: item.reason ?? null,
      measure: item.measure ?? null,
      sortOrder: item.sortOrder
    }))
  }
}

async function listReflections(userId, query) {
  const { page = 1, pageSize = 10, from, to } = query

  const where = { userId }
  if (from || to) {
    where.date = {
      ...(from ? { gte: toDateValue(from) } : {}),
      ...(to ? { lte: toDateValue(to) } : {})
    }
  }

  const [list, total] = await Promise.all([
    prisma.dailyReflection.findMany({
      where,
      include: reflectionInclude,
      orderBy: { date: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.dailyReflection.count({ where })
  ])

  return { list: list.map(toReflectionDTO), total, page, pageSize }
}

async function getReflectionById(id, userId) {
  const record = await prisma.dailyReflection.findFirst({
    where: { id, userId },
    include: reflectionInclude
  })
  return toReflectionDTO(record)
}

async function createReflection(data, userId) {
  await assertDateAvailable(userId, data.date)

  try {
    const record = await prisma.dailyReflection.create({
      data: {
        userId,
        date: toDateValue(data.date),
        items: { create: buildItems(data.items) }
      },
      include: reflectionInclude
    })
    return toReflectionDTO(record)
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError('该日期已有反思记录', 409)
    }
    throw error
  }
}

async function updateReflection(id, userId, data) {
  const existing = await prisma.dailyReflection.findFirst({
    where: { id, userId },
    select: { id: true }
  })
  if (!existing) {
    throw new AppError('反思记录不存在', 404)
  }
  if (data.date !== undefined) {
    await assertDateAvailable(userId, data.date, id)
  }

  try {
    // 整体替换 items 必须在一个事务里:删到一半失败要整体回滚
    const record = await prisma.$transaction(async (tx) => {
      if (data.items !== undefined) {
        await tx.reflectionItem.deleteMany({ where: { reflectionId: id } })
      }

      return tx.dailyReflection.update({
        where: { id },
        data: {
          ...(data.date === undefined ? {} : { date: toDateValue(data.date) }),
          ...(data.items === undefined ? {} : { items: { create: buildItems(data.items) } })
        },
        include: reflectionInclude
      })
    })
    return toReflectionDTO(record)
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError('该日期已有反思记录', 409)
    }
    throw error
  }
}

async function deleteReflection(id, userId) {
  const existing = await prisma.dailyReflection.findFirst({
    where: { id, userId },
    select: { id: true }
  })
  if (!existing) {
    throw new AppError('反思记录不存在', 404)
  }

  await prisma.dailyReflection.delete({ where: { id } })
}

module.exports = {
  listReflections,
  getReflectionById,
  createReflection,
  updateReflection,
  deleteReflection
}
