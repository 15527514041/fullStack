const AppError = require('../errors/AppError')

const prisma = require('../utils/prisma')

// 四类列表项与入参字段的对应关系:一行代码说清"哪个字段进哪个 kind"
const KINDS = [
  ['todos', 'TODO'],
  ['planned', 'PLANNED'],
  ['actual', 'ACTUAL'],
  ['notes', 'NOTE']
]

function toDateValue(date) {
  return new Date(`${date}T00:00:00.000Z`)
}

function toDateString(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
}

function isUniqueViolation(error) {
  return error?.code === 'P2002'
}

// 同一天只能有一条:先查一次给出明确的 409,并发时再由唯一索引 + P2002 兜底
async function assertDateAvailable(userId, date, excludeId) {
  const existing = await prisma.dailyPlan.findFirst({
    where: {
      userId,
      date: toDateValue(date),
      ...(excludeId ? { id: { not: excludeId } } : {})
    },
    select: { id: true }
  })

  if (existing) {
    throw new AppError('该日期已有日程规划', 409)
  }
}

function toMinutes(time) {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

// 用时 = 起止时间差(分钟):不存库、不用前端填
// TODO 类没有时间 → null;PLANNED / ACTUAL 起止都必填,一定算得出
function toDurationMinutes(item) {
  if (!item.startTime || !item.endTime) return null
  return toMinutes(item.endTime) - toMinutes(item.startTime)
}

// 只有待办和随写备注没有时间范围
const NO_TIME_KINDS = ['TODO', 'NOTE']

// 把四类入参摊平成一张子表的行;没传的类别不生成行(传空数组 = 清空该类)
function buildItems(data) {
  const rows = []

  for (const [field, kind] of KINDS) {
    const list = data[field]
    if (list === undefined) continue

    list.forEach((item, index) => {
      rows.push({
        kind,
        name: item.name,
        startTime: NO_TIME_KINDS.includes(kind) ? null : item.startTime,
        endTime: NO_TIME_KINDS.includes(kind) ? null : item.endTime,
        sortOrder: index
      })
    })
  }

  return rows
}

const planInclude = {
  items: { orderBy: { sortOrder: 'asc' } }
}

function pickItems(items, kind) {
  return items
    .filter((item) => item.kind === kind)
    .map((item) => ({
      id: item.id,
      name: item.name,
      startTime: item.startTime ?? null,
      endTime: item.endTime ?? null,
      durationMinutes: toDurationMinutes(item),
      sortOrder: item.sortOrder
    }))
}

// 子表结构比较深,统一拍平成前端好用的四个数组
function toPlanDetailDTO(record) {
  if (!record) return record
  const { items = [], ...rest } = record

  return {
    ...rest,
    date: toDateString(record.date),
    todos: pickItems(items, 'TODO'),
    planned: pickItems(items, 'PLANNED'),
    actual: pickItems(items, 'ACTUAL'),
    notes: pickItems(items, 'NOTE')
  }
}

async function listPlans(userId, query) {
  const { page = 1, pageSize = 10, from, to } = query

  const where = { userId }
  if (from || to) {
    where.date = {
      ...(from ? { gte: toDateValue(from) } : {}),
      ...(to ? { lte: toDateValue(to) } : {})
    }
  }

  const [list, total] = await Promise.all([
    prisma.dailyPlan.findMany({
      where,
      // 列表只要计数:只取 kind,不把三类明细全捞出来
      include: { items: { select: { kind: true } } },
      orderBy: { date: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.dailyPlan.count({ where })
  ])

  return {
    list: list.map((plan) => {
      const counts = { TODO: 0, PLANNED: 0, ACTUAL: 0, NOTE: 0 }
      plan.items.forEach((item) => {
        counts[item.kind] += 1
      })

      return {
        id: plan.id,
        date: toDateString(plan.date),
        todoCount: counts.TODO,
        plannedCount: counts.PLANNED,
        actualCount: counts.ACTUAL,
        noteCount: counts.NOTE,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt
      }
    }),
    total,
    page,
    pageSize
  }
}

async function getPlanById(id, userId) {
  const record = await prisma.dailyPlan.findFirst({
    where: { id, userId },
    include: planInclude
  })
  return toPlanDetailDTO(record)
}

async function createPlan(data, userId) {
  await assertDateAvailable(userId, data.date)

  try {
    const record = await prisma.dailyPlan.create({
      data: {
        userId,
        date: toDateValue(data.date),
        items: { create: buildItems(data) }
      },
      include: planInclude
    })
    return toPlanDetailDTO(record)
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError('该日期已有日程规划', 409)
    }
    throw error
  }
}

async function updatePlan(id, userId, data) {
  const existing = await prisma.dailyPlan.findFirst({
    where: { id, userId },
    select: { id: true }
  })
  if (!existing) {
    throw new AppError('日程规划不存在', 404)
  }
  if (data.date !== undefined) {
    await assertDateAvailable(userId, data.date, id)
  }

  try {
    const record = await prisma.$transaction(async (tx) => {
      // 只重写传入的那一类,其它两类保持不动
      for (const [field, kind] of KINDS) {
        if (data[field] !== undefined) {
          await tx.dailyPlanItem.deleteMany({ where: { planId: id, kind } })
        }
      }

      return tx.dailyPlan.update({
        where: { id },
        data: {
          ...(data.date === undefined ? {} : { date: toDateValue(data.date) }),
          items: { create: buildItems(data) }
        },
        include: planInclude
      })
    })
    return toPlanDetailDTO(record)
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError('该日期已有日程规划', 409)
    }
    throw error
  }
}

async function deletePlan(id, userId) {
  const existing = await prisma.dailyPlan.findFirst({
    where: { id, userId },
    select: { id: true }
  })
  if (!existing) {
    throw new AppError('日程规划不存在', 404)
  }

  await prisma.dailyPlan.delete({ where: { id } })
}

module.exports = {
  listPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan
}
