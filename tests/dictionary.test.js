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

function getItems(token, kind) {
  return request(app).get(`/api/dictionaries?kind=${kind}`).set(auth(token))
}

beforeEach(async () => {
  await prisma.ledgerRecord.deleteMany()
  await prisma.ledgerAccount.deleteMany()
  await prisma.todo.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.user.deleteMany()
})

after(async () => {
  await prisma.$disconnect()
})

test('新用户注册后自带账户类型、支出分类和收入分类', async () => {
  const token = await registerAndLogin()

  const accountKinds = await getItems(token, 'ACCOUNT_KIND')
  const expense = await getItems(token, 'EXPENSE_CATEGORY')
  const income = await getItems(token, 'INCOME_CATEGORY')

  assert.strictEqual(accountKinds.status, 200)
  assert.strictEqual(accountKinds.body.length, 8)
  assert.strictEqual(expense.body.length, 12)
  assert.strictEqual(income.body.length, 7)
  assert.strictEqual(accountKinds.body[0].name, '现金')
  assert.strictEqual(expense.body.find((item) => item.code === 'FOOD').name, '餐饮')
  assert.strictEqual(income.body.find((item) => item.code === 'SALARY').name, '工资薪金')
})

test('英文界面注册时预设项使用英文名称', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({ username: 'english-user', password: '123456', locale: 'en_US' })
  const login = await request(app)
    .post('/api/auth/login')
    .send({ username: 'english-user', password: '123456' })

  const accountKinds = await getItems(login.body.token, 'ACCOUNT_KIND')
  const expense = await getItems(login.body.token, 'EXPENSE_CATEGORY')
  assert.strictEqual(accountKinds.body[0].name, 'Cash')
  assert.strictEqual(expense.body.find((item) => item.code === 'FOOD').name, 'Food')
})

test('字典项支持新增、编辑、删除,同类型内不能重名', async () => {
  const token = await registerAndLogin()

  const created = await request(app)
    .post('/api/dictionaries')
    .set(auth(token))
    .send({ kind: 'ACCOUNT_KIND', name: '数字钱包', icon: 'ALIPAY' })
  assert.strictEqual(created.status, 201)
  assert.strictEqual(created.body.name, '数字钱包')
  assert.strictEqual(created.body.icon, 'ALIPAY')

  const duplicate = await request(app)
    .post('/api/dictionaries')
    .set(auth(token))
    .send({ kind: 'ACCOUNT_KIND', name: '数字钱包' })
  assert.strictEqual(duplicate.status, 409)

  const updated = await request(app)
    .patch(`/api/dictionaries/${created.body.id}`)
    .set(auth(token))
    .send({ name: '数字钱包 2', icon: 'WECHAT' })
  assert.strictEqual(updated.status, 200)
  assert.strictEqual(updated.body.name, '数字钱包 2')
  assert.strictEqual(updated.body.icon, 'WECHAT')

  const removed = await request(app)
    .delete(`/api/dictionaries/${created.body.id}`)
    .set(auth(token))
  assert.strictEqual(removed.status, 204)
})

test('被账户或账单引用的字典项不能删除,也不能跨用户使用', async () => {
  const aliceToken = await registerAndLogin('alice')
  const bobToken = await registerAndLogin('bob')

  const aliceKinds = (await getItems(aliceToken, 'ACCOUNT_KIND')).body
  const aliceExpenses = (await getItems(aliceToken, 'EXPENSE_CATEGORY')).body
  const wechat = aliceKinds.find((item) => item.code === 'WECHAT')
  const food = aliceExpenses.find((item) => item.code === 'FOOD')

  const account = await request(app)
    .post('/api/ledger/accounts')
    .set(auth(aliceToken))
    .send({ name: '微信零钱', kindId: wechat.id })
  assert.strictEqual(account.status, 201)

  const kindUsed = await request(app)
    .delete(`/api/dictionaries/${wechat.id}`)
    .set(auth(aliceToken))
  assert.strictEqual(kindUsed.status, 409)
  assert.strictEqual(kindUsed.body.message, '该账户类型下已有账户，不能删除')

  const record = await request(app)
    .post('/api/ledger/records')
    .set(auth(aliceToken))
    .send({
      source: 'manual_day',
      periodStart: '2026-10-20',
      items: [{ type: 'EXPENSE', categoryId: food.id, accountId: account.body.id, amountCents: 100 }]
    })
  assert.strictEqual(record.status, 201)

  const categoryUsed = await request(app)
    .delete(`/api/dictionaries/${food.id}`)
    .set(auth(aliceToken))
  assert.strictEqual(categoryUsed.status, 409)
  assert.strictEqual(categoryUsed.body.message, '该分类下已有账单，不能删除')

  // Bob 不能拿 Alice 的字典项建账户
  const crossUser = await request(app)
    .post('/api/ledger/accounts')
    .set(auth(bobToken))
    .send({ name: '越权账户', kindId: wechat.id })
  assert.strictEqual(crossUser.status, 400)
})
