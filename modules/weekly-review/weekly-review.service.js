const AppError = require('../../errors/AppError')
const prisma = require('../../utils/prisma')

// 对外使用四个数组,落库共用一个子表,由 kind 区分
const CONTENT_FIELDS = [
  ['wins', 'WIN'],
  ['challenges', 'CHALLENGE'],
  ['learnings', 'LEARNING'],
  ['nextActions', 'NEXT_ACTION']
]

const reviewInclude = {
  items: { orderBy: { sortOrder: 'asc' } }
}

function toDateValue(date) {
  return new Date(`${date}T00:00:00.000Z`)
}

function toDateString(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
}

function addDays(value, days) {
  const date = new Date(value)
  date.setUTCDate(date.getUTCDate() + days)
  return date
}

function toMinutes(time) {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

// 与每日规划保持相同口径:结束早于开始视为跨零点,补一天
function toDurationMinutes(item) {
  if (!item.startTime || !item.endTime) return 0
  const diff = toMinutes(item.endTime) - toMinutes(item.startTime)
  return diff >= 0 ? diff : diff + 1440
}

function sumDuration(items) {
  return items.reduce((total, item) => total + toDurationMinutes(item), 0)
}

function pickItems(items, kind) {
  return items
    .filter((item) => item.kind === kind)
    .map((item) => ({
      id: item.id,
      content: item.content,
      sortOrder: item.sortOrder
    }))
}

// 只生成入参中明确传入的分区;空数组表示清空该分区
function buildItems(data) {
  const rows = []
  for (const [field, kind] of CONTENT_FIELDS) {
    const list = data[field]
    if (list === undefined) continue
    list.forEach((item, index) => {
      rows.push({
        kind,
        content: item.content,
        sortOrder: index
      })
    })
  }
  return rows
}

function hasItemFields(data) {
  return CONTENT_FIELDS.some(([field]) => data[field] !== undefined)
}

function normalizeSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (!value.metrics || !Array.isArray(value.days)) return null
  return value
}

// 统计只读取每日规划 / 每日反思。全局 Todo 没有 completedAt,无法可靠还原本周完成时间
async function buildContextWithDb(db, userId, weekStart) {
  const start = toDateValue(weekStart)
  const weekEnd = toDateString(addDays(start, 6))
  const end = toDateValue(weekEnd)

  const [plans, reflections] = await Promise.all([
    db.dailyPlan.findMany({
      where: { userId, date: { gte: start, lte: end } },
      include: { items: { orderBy: { sortOrder: 'asc' } } }
    }),
    db.dailyReflection.findMany({
      where: { userId, date: { gte: start, lte: end } },
      include: { items: { orderBy: { sortOrder: 'asc' } } }
    })
  ])

  const plansByDate = new Map(plans.map((plan) => [toDateString(plan.date), plan]))
  const reflectionsByDate = new Map(reflections.map((record) => [toDateString(record.date), record]))

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = toDateString(addDays(start, index))
    const plan = plansByDate.get(date)
    const reflection = reflectionsByDate.get(date)
    const planItems = plan?.items || []
    const reflectionItems = reflection?.items || []

    return {
      date,
      planId: plan?.id ?? null,
      reflectionId: reflection?.id ?? null,
      todoTotal: planItems.filter((item) => item.kind === 'TODO').length,
      todoCompleted: planItems.filter((item) => item.kind === 'TODO' && item.completed).length,
      plannedMinutes: sumDuration(planItems.filter((item) => item.kind === 'PLANNED')),
      actualMinutes: sumDuration(planItems.filter((item) => item.kind === 'ACTUAL')),
      reflectionCount: reflectionItems.length,
      reflectionSummary: reflectionItems[0]?.experience ?? null
    }
  })

  const planDays = days.filter((day) => day.planId !== null).length
  const reflectionDays = days.filter((day) => day.reflectionId !== null).length
  const todoTotal = days.reduce((total, day) => total + day.todoTotal, 0)
  const todoCompleted = days.reduce((total, day) => total + day.todoCompleted, 0)

  return {
    weekStart,
    weekEnd,
    metrics: {
      planDays,
      todoTotal,
      todoCompleted,
      // 没有待办时返回 null,前端应显示 --,不能把「没记录」显示成 0%
      todoCompletionRate: todoTotal ? Number((todoCompleted / todoTotal).toFixed(4)) : null,
      plannedMinutes: days.reduce((total, day) => total + day.plannedMinutes, 0),
      actualMinutes: days.reduce((total, day) => total + day.actualMinutes, 0),
      reflectionDays,
      reflectionCount: days.reduce((total, day) => total + day.reflectionCount, 0)
    },
    days
  }
}

function toReviewDTO(record, context) {
  const { items = [], snapshot: _snapshot, ...rest } = record
  const data = normalizeSnapshot(record.snapshot) || context

  return {
    id: rest.id,
    weekStart: toDateString(rest.weekStart),
    weekEnd: data.weekEnd,
    summary: rest.summary ?? null,
    status: rest.status,
    completedAt: rest.completedAt ?? null,
    createdAt: rest.createdAt,
    updatedAt: rest.updatedAt,
    wins: pickItems(items, 'WIN'),
    challenges: pickItems(items, 'CHALLENGE'),
    learnings: pickItems(items, 'LEARNING'),
    nextActions: pickItems(items, 'NEXT_ACTION'),
    metrics: data.metrics,
    days: data.days,
    snapshotFrozen: Boolean(normalizeSnapshot(record.snapshot))
  }
}

function toReviewListDTO(record, context) {
  const data = normalizeSnapshot(record.snapshot) || context
  return {
    id: record.id,
    weekStart: toDateString(record.weekStart),
    weekEnd: data.weekEnd,
    summary: record.summary ?? null,
    status: record.status,
    completedAt: record.completedAt ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    metrics: data.metrics,
    snapshotFrozen: Boolean(normalizeSnapshot(record.snapshot))
  }
}

function assertHasContent(summary, itemsByField) {
  const hasSummary = Boolean(summary?.trim())
  const hasItems = CONTENT_FIELDS.some(([field]) => itemsByField[field]?.length)
  if (!hasSummary && !hasItems) {
    throw new AppError('至少填写一项复盘内容', 400)
  }
}

async function getWeeklyContext(userId, weekStart) {
  const [context, existing] = await Promise.all([
    buildContextWithDb(prisma, userId, weekStart),
    prisma.weeklyReview.findUnique({
      where: { userId_weekStart: { userId, weekStart: toDateValue(weekStart) } },
      select: { id: true }
    })
  ])

  return {
    ...context,
    existingReviewId: existing?.id ?? null
  }
}

async function listWeeklyReviews(userId, query) {
  const { page = 1, pageSize = 10, status, from, to } = query
  const where = {
    userId,
    ...(status ? { status } : {}),
    ...(from || to
      ? {
          weekStart: {
            ...(from ? { gte: toDateValue(from) } : {}),
            ...(to ? { lte: toDateValue(to) } : {})
          }
        }
      : {})
  }

  const [list, total] = await Promise.all([
    prisma.weeklyReview.findMany({
      where,
      orderBy: { weekStart: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.weeklyReview.count({ where })
  ])

  // 已完成记录直接使用快照;草稿需要按当前每日数据实时计算
  const enriched = await Promise.all(
    list.map(async (record) => {
      if (normalizeSnapshot(record.snapshot)) return toReviewListDTO(record)
      const context = await buildContextWithDb(prisma, userId, toDateString(record.weekStart))
      return toReviewListDTO(record, context)
    })
  )

  return { list: enriched, total, page, pageSize }
}

async function getWeeklyReviewById(id, userId) {
  const record = await prisma.weeklyReview.findFirst({
    where: { id, userId },
    include: reviewInclude
  })
  if (!record) return null

  const context = normalizeSnapshot(record.snapshot)
    ? null
    : await buildContextWithDb(prisma, userId, toDateString(record.weekStart))
  return toReviewDTO(record, context)
}

async function toReviewResponse(record, userId) {
  const context = normalizeSnapshot(record.snapshot)
    ? null
    : await buildContextWithDb(prisma, userId, toDateString(record.weekStart))
  return toReviewDTO(record, context)
}

async function createWeeklyReview(data, userId) {
  const weekStart = toDateValue(data.weekStart)

  try {
    const record = await prisma.$transaction(async (tx) => {
      const existing = await tx.weeklyReview.findUnique({
        where: { userId_weekStart: { userId, weekStart } },
        select: { id: true }
      })
      if (existing) {
        throw new AppError('该周已有周复盘', 409)
      }

      const isCompleting = data.status === 'COMPLETED'
      const context = isCompleting
        ? await buildContextWithDb(tx, userId, data.weekStart)
        : null

      const items = buildItems(data)
      return tx.weeklyReview.create({
        data: {
          userId,
          weekStart,
          summary: data.summary || null,
          status: isCompleting ? 'COMPLETED' : 'DRAFT',
          snapshot: context || undefined,
          completedAt: isCompleting ? new Date() : null,
          items: items.length ? { create: items } : undefined
        },
        include: reviewInclude
      })
    })
    return toReviewResponse(record, userId)
  } catch (error) {
    // 并发创建时唯一索引兜底
    if (error?.code === 'P2002') {
      throw new AppError('该周已有周复盘', 409)
    }
    throw error
  }
}

async function updateWeeklyReview(id, userId, data) {
  const existing = await prisma.weeklyReview.findFirst({
    where: { id, userId },
    include: reviewInclude
  })
  if (!existing) {
    throw new AppError('周复盘不存在', 404)
  }

  const existingItems = Object.fromEntries(
    CONTENT_FIELDS.map(([field, kind]) => [field, pickItems(existing.items, kind)])
  )
  const finalSummary = data.summary === undefined ? existing.summary : data.summary
  const finalItems = Object.fromEntries(
    CONTENT_FIELDS.map(([field]) => [
      field,
      data[field] === undefined ? existingItems[field] : data[field]
    ])
  )
  const isCompleting = data.status === 'COMPLETED' && existing.status !== 'COMPLETED'
  const finalStatus = isCompleting ? 'COMPLETED' : existing.status

  assertHasContent(finalSummary, finalItems)
  if (finalStatus === 'COMPLETED' && !finalSummary?.trim()) {
    throw new AppError('完成复盘前请填写本周总结', 400)
  }

  const record = await prisma.$transaction(async (tx) => {
    for (const [field, kind] of CONTENT_FIELDS) {
      if (data[field] !== undefined) {
        await tx.weeklyReviewItem.deleteMany({ where: { reviewId: id, kind } })
      }
    }

    const context = isCompleting
      ? await buildContextWithDb(tx, userId, toDateString(existing.weekStart))
      : null

    const items = buildItems(data)
    return tx.weeklyReview.update({
      where: { id },
      data: {
        updatedAt: new Date(),
        ...(data.summary === undefined ? {} : { summary: data.summary || null }),
        ...(isCompleting
          ? { status: 'COMPLETED', completedAt: new Date(), snapshot: context }
          : {}),
        ...(hasItemFields(data) && items.length ? { items: { create: items } } : {})
      },
      include: reviewInclude
    })
  })

  return toReviewResponse(record, userId)
}

async function deleteWeeklyReview(id, userId) {
  const existing = await prisma.weeklyReview.findFirst({
    where: { id, userId },
    select: { id: true }
  })
  if (!existing) {
    throw new AppError('周复盘不存在', 404)
  }
  await prisma.weeklyReview.delete({ where: { id } })
}

module.exports = {
  getWeeklyContext,
  listWeeklyReviews,
  getWeeklyReviewById,
  createWeeklyReview,
  updateWeeklyReview,
  deleteWeeklyReview
}
