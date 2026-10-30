const { test, beforeEach, afterEach, after } = require('node:test')
const assert = require('node:assert')
const request = require('supertest')
const { PrismaClient } = require('@prisma/client')

const app = require('../app')
const prisma = new PrismaClient()

function auth(token) {
  return { Authorization: `Bearer ${token}` }
}

async function registerAndLogin(username = 'alice') {
  await request(app).post('/api/auth/register').send({ username, password: '123456' })
  const res = await request(app).post('/api/auth/login').send({ username, password: '123456' })
  return res.body.token
}

async function createAccount(token, { name, kind = 'WECHAT', balanceCents = 0 }) {
  const kinds = await request(app).get('/api/dictionaries?kind=ACCOUNT_KIND').set(auth(token))
  const kindItem = kinds.body.find((item) => item.code === kind)
  return request(app)
    .post('/api/ledger/accounts')
    .set(auth(token))
    .send({ name, kindId: kindItem?.id, balanceCents })
}

async function cleanDatabase() {
  // Todo -> User 是 Restrict,必须显式清掉;其它业务记录会随用户级联删除
  await prisma.ledgerRecord.deleteMany()
  await prisma.ledgerAccount.deleteMany()
  await prisma.todo.deleteMany()
  await prisma.user.deleteMany()
}

beforeEach(cleanDatabase)
afterEach(cleanDatabase)

after(async () => {
  await prisma.$disconnect()
})

test('首页总览:需要登录,日期必填且必须是真实日期', async () => {
  const token = await registerAndLogin()

  assert.strictEqual((await request(app).get('/api/overview?date=2026-10-28')).status, 401)

  const missing = await request(app).get('/api/overview').set(auth(token))
  assert.strictEqual(missing.status, 400)

  const invalid = await request(app).get('/api/overview?date=2026-02-31').set(auth(token))
  assert.strictEqual(invalid.status, 400)
  assert.deepStrictEqual(invalid.body.errors, [{ field: 'date', message: '日期不合法' }])
})

test('没有业务数据时返回稳定的零值结构', async () => {
  const token = await registerAndLogin()
  const res = await request(app).get('/api/overview?date=2026-10-28').set(auth(token))

  assert.strictEqual(res.status, 200)
  assert.strictEqual(res.body.date, '2026-10-28')
  assert.deepStrictEqual(res.body.tasks, {
    dueToday: 0,
    overdue: 0,
    focus: []
  })
  assert.deepStrictEqual(res.body.plan, {
    id: null,
    todoTotal: 0,
    todoCompleted: 0,
    plannedCount: 0,
    actualCount: 0,
    noteCount: 0,
    plannedMinutes: 0,
    actualMinutes: 0,
    timeline: []
  })
  assert.deepStrictEqual(res.body.reflection, {
    id: null,
    itemCount: 0,
    updatedAt: null
  })
  assert.strictEqual(res.body.weeklyReview.weekStart, '2026-10-26')
  assert.strictEqual(res.body.weeklyReview.weekEnd, '2026-11-01')
  assert.strictEqual(res.body.weeklyReview.existingReviewId, null)
  assert.strictEqual(res.body.weeklyReview.status, null)
  assert.strictEqual(res.body.weeklyReview.metrics.planDays, 0)
  assert.strictEqual(res.body.weeklyReview.metrics.todoCompletionRate, null)
  assert.deepStrictEqual(res.body.finance, {
    totalAssetsCents: 0,
    totalDebtCents: 0,
    netAssetsCents: 0
  })
})

test('聚合当天任务、规划、反思、周复盘和财务快照,并隔离其他用户', async () => {
  const aliceToken = await registerAndLogin('alice')
  const bobToken = await registerAndLogin('bob')

  const addTodo = (token, body) =>
    request(app).post('/api/todos').set(auth(token)).send(body)

  const overdue = await addTodo(aliceToken, { title: '补交材料', dueDate: '2026-10-27' })
  const today = await addTodo(aliceToken, { title: '完成首页接口', dueDate: '2026-10-28' })
  await addTodo(aliceToken, { title: '未来任务', dueDate: '2026-10-29' })
  const completed = await addTodo(aliceToken, { title: '今天已完成', dueDate: '2026-10-28' })
  await request(app)
    .patch(`/api/todos/${completed.body.id}`)
    .set(auth(aliceToken))
    .send({ completed: true })
  const deleted = await addTodo(aliceToken, { title: '已删除任务', dueDate: '2026-10-28' })
  await request(app).delete(`/api/todos/${deleted.body.id}`).set(auth(aliceToken))

  await request(app).post('/api/plans').set(auth(aliceToken)).send({
    date: '2026-10-28',
    todos: [{ name: '写代码', completed: true }, { name: '做验证' }],
    planned: [
      { name: '写代码', startTime: '09:00', endTime: '10:00', important: true },
      { name: '做验证', startTime: '10:00', endTime: '10:30' }
    ],
    actual: [{ name: '写代码', startTime: '09:10', endTime: '09:55' }],
    notes: [{ name: '下午继续' }]
  })

  await request(app).post('/api/reflections').set(auth(aliceToken)).send({
    date: '2026-10-28',
    items: [
      { experience: '接口拆清楚了' },
      { experience: '测试还要补', measure: '明天先写边界用例' }
    ]
  })

  const review = await request(app).post('/api/weekly-reviews').set(auth(aliceToken)).send({
    weekStart: '2026-10-26',
    summary: '完成首页数据层'
  })

  await createAccount(aliceToken, {
    name: '现金',
    kind: 'CASH',
    balanceCents: 100000
  })
  await createAccount(aliceToken, {
    name: '信用卡',
    kind: 'CREDIT_CARD',
    balanceCents: -30000
  })
  await createAccount(aliceToken, {
    name: '停用账户',
    kind: 'OTHER',
    balanceCents: 500000
  }).then((res) =>
    request(app)
      .patch(`/api/ledger/accounts/${res.body.id}`)
      .set(auth(aliceToken))
      .send({ enabled: false })
  )

  // Bob 的同日数据不能进入 Alice 的总览
  await addTodo(bobToken, { title: 'Bob 的任务', dueDate: '2026-10-28' })
  await request(app).post('/api/plans').set(auth(bobToken)).send({
    date: '2026-10-28',
    todos: [{ name: 'Bob 的规划' }]
  })

  const res = await request(app).get('/api/overview?date=2026-10-28').set(auth(aliceToken))

  assert.strictEqual(res.status, 200)
  assert.deepStrictEqual(
    {
      dueToday: res.body.tasks.dueToday,
      overdue: res.body.tasks.overdue
    },
    { dueToday: 1, overdue: 1 }
  )
  assert.deepStrictEqual(
    res.body.tasks.focus.map((item) => item.title),
    [overdue.body.title, today.body.title]
  )

  assert.deepStrictEqual(res.body.plan, {
    id: res.body.plan.id,
    todoTotal: 2,
    todoCompleted: 1,
    plannedCount: 2,
    actualCount: 1,
    noteCount: 1,
    plannedMinutes: 90,
    actualMinutes: 45,
    timeline: [
      {
        id: res.body.plan.timeline[0].id,
        name: '写代码',
        startTime: '09:00',
        endTime: '10:00',
        important: true,
        durationMinutes: 60
      },
      {
        id: res.body.plan.timeline[1].id,
        name: '做验证',
        startTime: '10:00',
        endTime: '10:30',
        important: false,
        durationMinutes: 30
      }
    ]
  })
  assert.strictEqual(res.body.reflection.itemCount, 2)

  assert.strictEqual(res.body.weeklyReview.existingReviewId, review.body.id)
  assert.strictEqual(res.body.weeklyReview.status, 'DRAFT')
  assert.strictEqual(res.body.weeklyReview.summary, '完成首页数据层')
  assert.deepStrictEqual(res.body.weeklyReview.metrics, {
    planDays: 1,
    todoTotal: 2,
    todoCompleted: 1,
    todoCompletionRate: 0.5,
    plannedMinutes: 90,
    actualMinutes: 45,
    reflectionDays: 1,
    reflectionCount: 2
  })

  assert.deepStrictEqual(res.body.finance, {
    totalAssetsCents: 100000,
    totalDebtCents: 30000,
    netAssetsCents: 70000
  })
})

test('今日重点和今日安排都返回完整列表', async () => {
  const token = await registerAndLogin()

  for (let index = 1; index <= 6; index += 1) {
    await request(app).post('/api/todos').set(auth(token)).send({
      title: `待办 ${index}`,
      dueDate: '2026-10-30'
    })
  }

  const planned = Array.from({ length: 7 }, (_, index) => ({
    name: `安排 ${index + 1}`,
    startTime: `${String(9 + index).padStart(2, '0')}:00`,
    endTime: `${String(10 + index).padStart(2, '0')}:00`
  }))

  await request(app).post('/api/plans').set(auth(token)).send({
    date: '2026-10-30',
    planned
  })

  const res = await request(app).get('/api/overview?date=2026-10-30').set(auth(token))

  assert.strictEqual(res.status, 200)
  assert.strictEqual(res.body.tasks.focus.length, 6)
  assert.strictEqual(res.body.plan.timeline.length, planned.length)
  assert.deepStrictEqual(
    res.body.plan.timeline.map((item) => item.name),
    planned.map((item) => item.name)
  )
})
