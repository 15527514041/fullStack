const prisma = require('../../utils/prisma')
const weeklyReviewService = require('../weekly-review/weekly-review.service')

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
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }]
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
    timeline: planned.map((item) => ({
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

async function getFinance(userId) {
  const accounts = await prisma.ledgerAccount.findMany({
    where: { userId, enabled: true },
    select: { balanceCents: true }
  })

  let totalAssetsCents = 0
  let totalDebtCents = 0

  for (const account of accounts) {
    if (account.balanceCents >= 0) {
      totalAssetsCents += account.balanceCents
    } else {
      totalDebtCents -= account.balanceCents
    }
  }

  return {
    totalAssetsCents,
    totalDebtCents,
    netAssetsCents: totalAssetsCents - totalDebtCents
  }
}

async function getOverview(userId, date) {
  const [tasks, plan, reflection, weeklyReview, finance] = await Promise.all([
    getTasks(userId, date),
    getPlan(userId, date),
    getReflection(userId, date),
    getWeeklyReview(userId, date),
    getFinance(userId)
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
