const { test, beforeEach, after } = require('node:test')
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

async function getCategories(token) {
  const [income, expense] = await Promise.all([
    request(app).get('/api/dictionaries?kind=INCOME_CATEGORY').set(auth(token)),
    request(app).get('/api/dictionaries?kind=EXPENSE_CATEGORY').set(auth(token))
  ])
  const asMap = (items) => Object.fromEntries(items.map((item) => [item.code, item.id]))
  return { income: asMap(income.body), expense: asMap(expense.body) }
}

beforeEach(async () => {
  // Todo -> User 是 Restrict,必须显式清掉;其它业务记录会随用户级联删除
  await prisma.ledgerRecord.deleteMany()
  await prisma.ledgerAccount.deleteMany()
  await prisma.todo.deleteMany()
  await prisma.user.deleteMany()
})

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
    netAssetsCents: 0,
    staleAccountCount: 0,
    source: 'manual_day',
    periodStart: '2026-10-28',
    periodEnd: '2026-10-28',
    recordId: null,
    incomeCents: 0,
    expenseCents: 0,
    netCents: 0
  })
})

test('聚合当天任务、规划、反思、周复盘和当前维度财务,并隔离其他用户', async () => {
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

  const cash = await createAccount(aliceToken, {
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

  // 让一个启用账户进入“超过 30 天未对账”状态
  await prisma.ledgerAccount.update({
    where: { id: cash.body.id },
    data: { balanceUpdatedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) }
  })

  const categories = await getCategories(aliceToken)
  await request(app).post('/api/ledger/records').set(auth(aliceToken)).send({
    source: 'manual_day',
    periodStart: '2026-10-28',
    items: [
      {
        type: 'INCOME',
        categoryId: categories.income.SALARY,
        accountId: cash.body.id,
        amountCents: 50000
      },
      {
        type: 'EXPENSE',
        categoryId: categories.expense.FOOD,
        accountId: cash.body.id,
        amountCents: 1200
      }
    ]
  })

  // 周/月账本独立存在,首页默认只读第一个偏好维度,不能被它们影响
  await request(app).post('/api/ledger/records').set(auth(aliceToken)).send({
    source: 'manual_week',
    periodStart: '2026-10-26',
    items: [{ type: 'EXPENSE', categoryId: categories.expense.FOOD, accountId: cash.body.id, amountCents: 9999 }]
  })
  await request(app).post('/api/ledger/records').set(auth(aliceToken)).send({
    source: 'manual_month',
    periodStart: '2026-10-01',
    items: [{ type: 'INCOME', categoryId: categories.income.SALARY, accountId: cash.body.id, amountCents: 999999 }]
  })

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
    netAssetsCents: 70000,
    staleAccountCount: 1,
    source: 'manual_day',
    periodStart: '2026-10-28',
    periodEnd: '2026-10-28',
    recordId: res.body.finance.recordId,
    incomeCents: 50000,
    expenseCents: 1200,
    netCents: 48800
  })
})

test('财务快照读取偏好中的第一个维度,周维度使用周一到周日', async () => {
  const token = await registerAndLogin()
  const account = await createAccount(token, { name: '现金', kind: 'CASH' })
  const categories = await getCategories(token)

  const prefs = await request(app)
    .patch('/api/users/me/preferences')
    .set(auth(token))
    .send({ ledgerEntrySources: ['manual_week', 'manual_day'] })
  assert.strictEqual(prefs.status, 200)

  await request(app).post('/api/ledger/records').set(auth(token)).send({
    source: 'manual_day',
    periodStart: '2026-10-28',
    items: [{ type: 'EXPENSE', categoryId: categories.expense.FOOD, accountId: account.body.id, amountCents: 100 }]
  })
  await request(app).post('/api/ledger/records').set(auth(token)).send({
    source: 'manual_week',
    periodStart: '2026-10-26',
    items: [{ type: 'EXPENSE', categoryId: categories.expense.FOOD, accountId: account.body.id, amountCents: 2500 }]
  })

  const res = await request(app).get('/api/overview?date=2026-10-28').set(auth(token))

  assert.strictEqual(res.status, 200)
  assert.strictEqual(res.body.finance.source, 'manual_week')
  assert.strictEqual(res.body.finance.periodStart, '2026-10-26')
  assert.strictEqual(res.body.finance.periodEnd, '2026-11-01')
  assert.strictEqual(res.body.finance.expenseCents, 2500)
  assert.strictEqual(res.body.finance.incomeCents, 0)
})
