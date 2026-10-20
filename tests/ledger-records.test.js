const { test, beforeEach, after } = require('node:test')
const assert = require('node:assert')
const request = require('supertest')
const { PrismaClient } = require('@prisma/client')

const app = require('../app')
const prisma = new PrismaClient()

async function registerAndLogin(username = 'alice') {
  await request(app).post('/api/auth/register').send({ username, password: '123456' })
  const res = await request(app).post('/api/auth/login').send({ username, password: '123456' })
  return res.body.token
}

function auth(token) {
  return { Authorization: `Bearer ${token}` }
}

async function createAccount(token, body = {}) {
  const { kind = 'WECHAT', ...rest } = body
  const kinds = await request(app).get('/api/dictionaries?kind=ACCOUNT_KIND').set(auth(token))
  const kindItem = kinds.body.find((item) => item.code === kind)
  const res = await request(app)
    .post('/api/ledger/accounts')
    .set(auth(token))
    .send({ name: '微信零钱', kindId: kindItem?.id, ...rest })
  return res
}

async function getCategoryIds(token) {
  const [income, expense] = await Promise.all([
    request(app).get('/api/dictionaries?kind=INCOME_CATEGORY').set(auth(token)),
    request(app).get('/api/dictionaries?kind=EXPENSE_CATEGORY').set(auth(token))
  ])
  const toMap = (items) => Object.fromEntries(items.map((item) => [item.code, item.id]))
  return { INCOME: toMap(income.body), EXPENSE: toMap(expense.body) }
}

async function createAccountingTag(token, body = {}) {
  const res = await request(app)
    .post('/api/tags')
    .set(auth(token))
    .send({ name: '日常', type: 'info', scope: 'ACCOUNTING', ...body })
  return res
}

function createRecord(token, body) {
  return request(app).post('/api/ledger/records').set(auth(token)).send(body)
}

function item(accountId, categoryId, overrides = {}) {
  return {
    type: 'EXPENSE',
    categoryId,
    accountId,
    amountCents: 3500,
    ...overrides
  }
}

beforeEach(async () => {
  // LedgerItem 对 LedgerAccount 是 RESTRICT,先删记录再删账户
  await prisma.ledgerRecord.deleteMany()
  await prisma.ledgerAccount.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.user.deleteMany()
})

after(async () => {
  await prisma.$disconnect()
})

test('创建日账单:一条记录多条明细,合计、条数、账户和标签都正确', async () => {
  const token = await registerAndLogin()
  const cats = await getCategoryIds(token)
  const account = await createAccount(token)
  const tag = await createAccountingTag(token)

  const created = await createRecord(token, {
    source: 'manual_day',
    periodStart: '2026-10-19',
    items: [
      item(account.body.id, cats.EXPENSE.FOOD, { amountCents: 3500, tagIds: [tag.body.id], remark: ' 午饭 ' }),
      { type: 'INCOME', categoryId: cats.INCOME.SALARY, accountId: account.body.id, amountCents: 800000 }
    ]
  })

  assert.strictEqual(created.status, 201)
  assert.strictEqual(created.body.source, 'manual_day')
  assert.strictEqual(created.body.periodStart, '2026-10-19')
  assert.strictEqual(created.body.periodEnd, '2026-10-19')
  assert.strictEqual(created.body.expenseCents, 3500)
  assert.strictEqual(created.body.incomeCents, 800000)
  assert.strictEqual(created.body.netCents, 796500)
  assert.strictEqual(created.body.itemCount, 2)

  assert.deepStrictEqual(
    created.body.items.map((entry) => entry.sortOrder),
    [0, 1]
  )
  assert.strictEqual(created.body.items[0].remark, '午饭')
  assert.strictEqual(created.body.items[0].accountId, account.body.id)
  assert.strictEqual(created.body.items[0].account.name, '微信零钱')
  assert.deepStrictEqual(
    created.body.items[0].tags.map((entry) => entry.name),
    ['日常']
  )

  assert.strictEqual(await prisma.ledgerRecord.count(), 1)
  assert.strictEqual(await prisma.ledgerItem.count(), 2)
})

test('周账单从周一到周日;月账单从 1 日到月末', async () => {
  const token = await registerAndLogin()
  const cats = await getCategoryIds(token)
  const account = await createAccount(token)

  const week = await createRecord(token, {
    source: 'manual_week',
    periodStart: '2026-10-12',
    items: [item(account.body.id, cats.EXPENSE.FOOD)]
  })
  assert.strictEqual(week.status, 201)
  assert.strictEqual(week.body.periodEnd, '2026-10-18')

  const month = await createRecord(token, {
    source: 'manual_month',
    periodStart: '2026-09-01',
    items: [item(account.body.id, cats.EXPENSE.FOOD)]
  })
  assert.strictEqual(month.status, 201)
  assert.strictEqual(month.body.periodEnd, '2026-09-30')

  // 同一天可以同时存在于日账本和月账本,它们不是同一种来源
  const day = await createRecord(token, {
    source: 'manual_day',
    periodStart: '2026-09-01',
    items: [item(account.body.id, cats.EXPENSE.FOOD)]
  })
  assert.strictEqual(day.status, 201)
})

test('周期粒度不合法返回 400:周不是周一、月不是 1 日、日期不存在', async () => {
  const token = await registerAndLogin()
  const cats = await getCategoryIds(token)
  const account = await createAccount(token)

  const badWeek = await createRecord(token, {
    source: 'manual_week',
    periodStart: '2026-10-13',
    items: [item(account.body.id, cats.EXPENSE.FOOD)]
  })
  assert.strictEqual(badWeek.status, 400)

  const badMonth = await createRecord(token, {
    source: 'manual_month',
    periodStart: '2026-09-02',
    items: [item(account.body.id, cats.EXPENSE.FOOD)]
  })
  assert.strictEqual(badMonth.status, 400)

  const badDate = await createRecord(token, {
    source: 'manual_day',
    periodStart: '2026-02-31',
    items: [item(account.body.id, cats.EXPENSE.FOOD)]
  })
  assert.strictEqual(badDate.status, 400)
})

test('同一周期重复创建返回 409;列表可按周期查询是否已存在', async () => {
  const token = await registerAndLogin()
  const cats = await getCategoryIds(token)
  const account = await createAccount(token)
  const payload = {
    source: 'manual_day',
    periodStart: '2026-10-18',
    items: [item(account.body.id, cats.EXPENSE.FOOD)]
  }

  const first = await createRecord(token, payload)
  assert.strictEqual(first.status, 201)

  const again = await createRecord(token, payload)
  assert.strictEqual(again.status, 409)
  assert.strictEqual(again.body.message, '该日期已有账单记录')

  const existed = await request(app)
    .get('/api/ledger/records?source=manual_day&from=2026-10-18&to=2026-10-18')
    .set(auth(token))
  assert.strictEqual(existed.status, 200)
  assert.strictEqual(existed.body.total, 1)
  assert.strictEqual(existed.body.list[0].id, first.body.id)
})

test('编辑整条记录:整体替换明细、周期和来源保持不变', async () => {
  const token = await registerAndLogin()
  const cats = await getCategoryIds(token)
  const account = await createAccount(token)

  const created = await createRecord(token, {
    source: 'manual_day',
    periodStart: '2026-10-17',
    items: [
      item(account.body.id, cats.EXPENSE.FOOD, { amountCents: 1000 }),
      item(account.body.id, cats.EXPENSE.TRANSPORT, { amountCents: 2000 })
    ]
  })
  assert.strictEqual(created.body.itemCount, 2)

  const updated = await request(app)
    .patch(`/api/ledger/records/${created.body.id}`)
    .set(auth(token))
    .send({
      items: [{ type: 'EXPENSE', categoryId: cats.EXPENSE.HOUSING, accountId: account.body.id, amountCents: 300000 }]
    })

  assert.strictEqual(updated.status, 200)
  assert.strictEqual(updated.body.id, created.body.id)
  assert.strictEqual(updated.body.source, 'manual_day')
  assert.strictEqual(updated.body.periodStart, '2026-10-17')
  assert.strictEqual(updated.body.itemCount, 1)
  assert.strictEqual(updated.body.expenseCents, 300000)
  assert.strictEqual(updated.body.items[0].category.name, '住房')
  assert.strictEqual(await prisma.ledgerItem.count({ where: { recordId: created.body.id } }), 1)

  // 编辑接口不允许改周期/来源;空明细也不合法
  const changeSource = await request(app)
    .patch(`/api/ledger/records/${created.body.id}`)
    .set(auth(token))
    .send({ source: 'manual_month', items: [] })
  assert.strictEqual(changeSource.status, 400)

  const emptyItems = await request(app)
    .patch(`/api/ledger/records/${created.body.id}`)
    .set(auth(token))
    .send({ items: [] })
  assert.strictEqual(emptyItems.status, 400)
})

test('列表只返回周期摘要,按周期倒序,支持分页和日期范围', async () => {
  const token = await registerAndLogin()
  const cats = await getCategoryIds(token)
  const account = await createAccount(token)

  for (const [periodStart, amountCents] of [
    ['2026-10-17', 1000],
    ['2026-10-18', 2000],
    ['2026-10-19', 3000]
  ]) {
    await createRecord(token, {
      source: 'manual_day',
      periodStart,
      items: [item(account.body.id, cats.EXPENSE.FOOD, { amountCents })]
    })
  }

  // 周账本不混进日账本列表
  await createRecord(token, {
    source: 'manual_week',
    periodStart: '2026-10-12',
    items: [item(account.body.id, cats.EXPENSE.FOOD, { amountCents: 9999 })]
  })

  const list = await request(app)
    .get('/api/ledger/records?source=manual_day&page=1&pageSize=2')
    .set(auth(token))

  assert.strictEqual(list.status, 200)
  assert.strictEqual(list.body.total, 3)
  assert.strictEqual(list.body.list.length, 2)
  assert.deepStrictEqual(
    list.body.list.map((record) => record.periodStart),
    ['2026-10-19', '2026-10-18']
  )
  assert.strictEqual(list.body.list[0].expenseCents, 3000)
  assert.strictEqual(list.body.list[0].itemCount, 1)
  assert.strictEqual(list.body.list[0].items, undefined)

  const range = await request(app)
    .get('/api/ledger/records?source=manual_day&from=2026-10-18&to=2026-10-18')
    .set(auth(token))
  assert.strictEqual(range.body.total, 1)
  assert.strictEqual(range.body.list[0].periodStart, '2026-10-18')
})

test('明细校验:金额、分类与类型、账户归属、标签域', async () => {
  const aliceToken = await registerAndLogin('alice')
  const bobToken = await registerAndLogin('bob')
  const aliceCats = await getCategoryIds(aliceToken)
  const bobCats = await getCategoryIds(bobToken)
  const aliceAccount = await createAccount(aliceToken)
  const bobAccount = await createAccount(bobToken, { name: 'Bob 的账户' })
  const todoTag = await request(app)
    .post('/api/tags')
    .set(auth(aliceToken))
    .send({ name: '任务标签', type: 'primary', scope: 'TODO' })

  const zeroAmount = await createRecord(aliceToken, {
    source: 'manual_day',
    periodStart: '2026-10-16',
    items: [item(aliceAccount.body.id, aliceCats.EXPENSE.FOOD, { amountCents: 0 })]
  })
  assert.strictEqual(zeroAmount.status, 400)

  const wrongCategory = await createRecord(aliceToken, {
    source: 'manual_day',
    periodStart: '2026-10-16',
    items: [item(aliceAccount.body.id, aliceCats.EXPENSE.FOOD, { type: 'INCOME' })]
  })
  assert.strictEqual(wrongCategory.status, 400)
  assert.strictEqual(wrongCategory.body.message, '分类与收支类型不匹配')

  const otherCategory = await createRecord(aliceToken, {
    source: 'manual_day',
    periodStart: '2026-10-16',
    items: [item(aliceAccount.body.id, bobCats.EXPENSE.FOOD)]
  })
  assert.strictEqual(otherCategory.status, 400)
  assert.strictEqual(otherCategory.body.message, '分类不存在')

  const otherAccount = await createRecord(aliceToken, {
    source: 'manual_day',
    periodStart: '2026-10-16',
    items: [item(bobAccount.body.id, aliceCats.EXPENSE.FOOD)]
  })
  assert.strictEqual(otherAccount.status, 400)
  assert.strictEqual(otherAccount.body.message, '账户不存在')

  const wrongTagScope = await createRecord(aliceToken, {
    source: 'manual_day',
    periodStart: '2026-10-16',
    items: [item(aliceAccount.body.id, aliceCats.EXPENSE.FOOD, { tagIds: [todoTag.body.id] })]
  })
  assert.strictEqual(wrongTagScope.status, 400)
  assert.strictEqual(wrongTagScope.body.message, '标签不存在')
})

test('明细最多 50 条', async () => {
  const token = await registerAndLogin()
  const cats = await getCategoryIds(token)
  const account = await createAccount(token)

  const created = await createRecord(token, {
    source: 'manual_day',
    periodStart: '2026-10-15',
    items: Array.from({ length: 51 }, () => item(account.body.id, cats.EXPENSE.FOOD))
  })
  assert.strictEqual(created.status, 400)
})

test('只能查看、编辑、删除自己的账单记录;未登录返回 401', async () => {
  const aliceToken = await registerAndLogin('alice')
  const bobToken = await registerAndLogin('bob')
  const aliceCats = await getCategoryIds(aliceToken)
  const aliceAccount = await createAccount(aliceToken)

  const alice = await createRecord(aliceToken, {
    source: 'manual_day',
    periodStart: '2026-10-14',
    items: [item(aliceAccount.body.id, aliceCats.EXPENSE.FOOD)]
  })
  const id = alice.body.id

  assert.strictEqual(
    (await request(app).get(`/api/ledger/records/${id}`).set(auth(bobToken))).status,
    404
  )
  assert.strictEqual(
    (await request(app).patch(`/api/ledger/records/${id}`).set(auth(bobToken)).send({
      items: [item(aliceAccount.body.id, aliceCats.EXPENSE.FOOD)]
    })).status,
    404
  )
  assert.strictEqual(
    (await request(app).delete(`/api/ledger/records/${id}`).set(auth(bobToken))).status,
    404
  )

  const bobList = await request(app).get('/api/ledger/records?source=manual_day').set(auth(bobToken))
  assert.strictEqual(bobList.body.total, 0)

  assert.strictEqual((await request(app).get('/api/ledger/records?source=manual_day')).status, 401)
})

test('删除账单返回 204;有账单的账户不能删除,改为停用', async () => {
  const token = await registerAndLogin()
  const cats = await getCategoryIds(token)
  const account = await createAccount(token)

  const created = await createRecord(token, {
    source: 'manual_day',
    periodStart: '2026-10-13',
    items: [item(account.body.id, cats.EXPENSE.FOOD)]
  })

  const blocked = await request(app).delete(`/api/ledger/accounts/${account.body.id}`).set(auth(token))
  assert.strictEqual(blocked.status, 409)
  assert.strictEqual(blocked.body.message, '该账户下已有账单,请改为停用')

  const removed = await request(app).delete(`/api/ledger/records/${created.body.id}`).set(auth(token))
  assert.strictEqual(removed.status, 204)
  assert.strictEqual(await prisma.ledgerItem.count({ where: { recordId: created.body.id } }), 0)

  const detail = await request(app).get(`/api/ledger/records/${created.body.id}`).set(auth(token))
  assert.strictEqual(detail.status, 404)

  const accountRemoved = await request(app).delete(`/api/ledger/accounts/${account.body.id}`).set(auth(token))
  assert.strictEqual(accountRemoved.status, 204)
})

test('删除标签后账单保留,只是不再关联该标签', async () => {
  const token = await registerAndLogin()
  const cats = await getCategoryIds(token)
  const account = await createAccount(token)
  const tag = await createAccountingTag(token)

  const created = await createRecord(token, {
    source: 'manual_day',
    periodStart: '2026-10-12',
    items: [item(account.body.id, cats.EXPENSE.FOOD, { tagIds: [tag.body.id] })]
  })

  const tagRemoved = await request(app).delete(`/api/tags/${tag.body.id}`).set(auth(token))
  assert.strictEqual(tagRemoved.status, 204)

  const detail = await request(app).get(`/api/ledger/records/${created.body.id}`).set(auth(token))
  assert.strictEqual(detail.status, 200)
  assert.deepStrictEqual(detail.body.items[0].tags, [])
  assert.strictEqual(detail.body.itemCount, 1)
})

test('删除用户时账单记录和明细一起清掉(CASCADE)', async () => {
  const token = await registerAndLogin()
  const cats = await getCategoryIds(token)
  const account = await createAccount(token)

  await createRecord(token, {
    source: 'manual_day',
    periodStart: '2026-10-11',
    items: [item(account.body.id, cats.EXPENSE.FOOD)]
  })
  assert.strictEqual(await prisma.ledgerRecord.count(), 1)
  assert.strictEqual(await prisma.ledgerItem.count(), 1)

  await prisma.user.delete({ where: { username: 'alice' } })
  assert.strictEqual(await prisma.ledgerRecord.count(), 0)
  assert.strictEqual(await prisma.ledgerItem.count(), 0)
})
