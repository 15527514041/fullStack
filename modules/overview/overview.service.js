const prisma = require('../../utils/prisma')
const weeklyReviewService = require('../weekly-review/weekly-review.service')

const FOCUS_LIMIT = 5
const TIMELINE_LIMIT = 5
const STALE_ACCOUNT_DAYS = 30

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

function startOfWeek(date) {
  const start = toDateValue(date)
  const offset = (start.getUTCDay() + 6) % 7
  return toDateString(addDays(start, -offset))
}

function startOfMonth(date) {
  return `${date.slice(0, 7)}-01`
}

function endOfMonth(date) {
  const value = toDateValue(date)
  return toDateString(new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)))
}

function getLedgerPeriod(source, date) {
  if (source === 'manual_week') {
    const periodStart = startOfWeek(date)
    return {
      periodStart,
      periodEnd: toDateString(addDays(toDateValue(periodStart), 6))
    }
  }

  if (source === 'manual_month') {
    return {
      periodStart: startOfMonth(date),
      periodEnd: endOfMonth(date)
    }
  }

  return { periodStart: date, periodEnd: date }
}

function toMinutes(time) {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

// 与每日规划保持一致:结束早于开始表示跨零点
function durationMinutes(item) {
  if (!item.startTime || !item.endTime) return null
  const diff = toMinutes(item.endTime) - toMinutes(item.startTime)
  return diff >= 0 ? diff : diff + 1440
}

function sumDuration(items) {
  return items.reduce((total, item) => total + (durationMinutes(item) ?? 0), 0)
}

async function getTasks(userId, date) {
  const today = toDateValue(date)

  const [dueToday, overdue, focus] = await Promise.all([
    prisma.todo.count({
      where: {
        userId,
        deletedAt: null,
        completed: false,
        dueDate: today
      }
    }),
    prisma.todo.count({
      where: {
        userId,
        deletedAt: null,
        completed: false,
        dueDate: { lt: today }
      }
    }),
    prisma.todo.findMany({
      where: {
        userId,
        deletedAt: null,
        completed: false,
        dueDate: { lte: today }
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        completed: true,
        tags: {
          select: { id: true, name: true, color: true }
        }
      },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      take: FOCUS_LIMIT
    })
  ])

  return {
    dueToday,
    overdue,
    focus: focus.map((todo) => ({
      ...todo,
      dueDate: toDateString(todo.dueDate)
    }))
  }
}

async function getPlan(userId, date) {
  const plan = await prisma.dailyPlan.findUnique({
    where: {
      userId_date: {
        userId,
        date: toDateValue(date)
      }
    },
    include: {
      items: { orderBy: { sortOrder: 'asc' } }
    }
  })

  if (!plan) {
    return {
      id: null,
      todoTotal: 0,
      todoCompleted: 0,
      plannedCount: 0,
      actualCount: 0,
      noteCount: 0,
      plannedMinutes: 0,
      actualMinutes: 0,
      timeline: []
    }
  }

  const todos = plan.items.filter((item) => item.kind === 'TODO')
  const planned = plan.items.filter((item) => item.kind === 'PLANNED')
  const actual = plan.items.filter((item) => item.kind === 'ACTUAL')
  const notes = plan.items.filter((item) => item.kind === 'NOTE')

  return {
    id: plan.id,
    todoTotal: todos.length,
    todoCompleted: todos.filter((item) => item.completed).length,
    plannedCount: planned.length,
    actualCount: actual.length,
    noteCount: notes.length,
    plannedMinutes: sumDuration(planned),
    actualMinutes: sumDuration(actual),
    timeline: planned.slice(0, TIMELINE_LIMIT).map((item) => ({
      id: item.id,
      name: item.name,
      startTime: item.startTime,
      endTime: item.endTime,
      important: item.important,
      durationMinutes: durationMinutes(item)
    }))
  }
}

async function getReflection(userId, date) {
  const reflection = await prisma.dailyReflection.findUnique({
    where: {
      userId_date: {
        userId,
        date: toDateValue(date)
      }
    },
    select: {
      id: true,
      updatedAt: true,
      _count: { select: { items: true } }
    }
  })

  return {
    id: reflection?.id ?? null,
    itemCount: reflection?._count.items ?? 0,
    updatedAt: reflection?.updatedAt ?? null
  }
}

async function getWeeklyReview(userId, date) {
  const weekStart = startOfWeek(date)

  const [context, review] = await Promise.all([
    weeklyReviewService.getWeeklyContext(userId, weekStart),
    prisma.weeklyReview.findUnique({
      where: {
        userId_weekStart: {
          userId,
          weekStart: toDateValue(weekStart)
        }
      },
      select: {
        id: true,
        status: true,
        summary: true,
        completedAt: true
      }
    })
  ])

  return {
    weekStart: context.weekStart,
    weekEnd: context.weekEnd,
    existingReviewId: review?.id ?? null,
    status: review?.status ?? null,
    summary: review?.summary ?? null,
    completedAt: review?.completedAt ?? null,
    metrics: context.metrics
  }
}

async function getFinance(userId, date) {
  const [user, accounts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { ledgerEntrySources: true }
    }),
    prisma.ledgerAccount.findMany({
      where: { userId, enabled: true },
      select: {
        balanceCents: true,
        balanceUpdatedAt: true
      }
    })
  ])

  // 首页只读取用户配置的第一个账单维度,不把三个独立账本相加
  const source = user?.ledgerEntrySources?.[0] ?? 'manual_day'
  const period = getLedgerPeriod(source, date)
  const record = await prisma.ledgerRecord.findUnique({
    where: {
      userId_source_periodStart: {
        userId,
        source,
        periodStart: toDateValue(period.periodStart)
      }
    },
    select: {
      id: true,
      items: {
        select: { type: true, amountCents: true }
      }
    }
  })

  let totalAssetsCents = 0
  let totalDebtCents = 0
  let staleAccountCount = 0
  const staleBefore = Date.now() - STALE_ACCOUNT_DAYS * 24 * 60 * 60 * 1000

  for (const account of accounts) {
    if (account.balanceCents >= 0) {
      totalAssetsCents += account.balanceCents
    } else {
      totalDebtCents -= account.balanceCents
    }
    if (account.balanceUpdatedAt.getTime() < staleBefore) {
      staleAccountCount += 1
    }
  }

  let incomeCents = 0
  let expenseCents = 0
  for (const item of record?.items ?? []) {
    if (item.type === 'INCOME') incomeCents += item.amountCents
    else expenseCents += item.amountCents
  }

  return {
    totalAssetsCents,
    totalDebtCents,
    netAssetsCents: totalAssetsCents - totalDebtCents,
    staleAccountCount,
    source,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    recordId: record?.id ?? null,
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents
  }
}

async function getOverview(userId, date) {
  const [tasks, plan, reflection, weeklyReview, finance] = await Promise.all([
    getTasks(userId, date),
    getPlan(userId, date),
    getReflection(userId, date),
    getWeeklyReview(userId, date),
    getFinance(userId, date)
  ])

  return {
    date,
    tasks,
    plan,
    reflection,
    weeklyReview,
    finance
  }
}

module.exports = { getOverview }
