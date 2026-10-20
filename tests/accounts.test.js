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

async function getAccountKinds(token) {
  const res = await request(app).get('/api/dictionaries?kind=ACCOUNT_KIND').set(auth(token))
  return res.body
}

// 账户名/类型/余额都合法的最小入参,想测异常场景就传字段覆盖
async function createAccount(token, body = {}) {
  const { kind = 'WECHAT', ...rest } = body
  const kindItem = (await getAccountKinds(token)).find((item) => item.code === kind)
  return request(app)
    .post('/api/ledger/accounts')
    .set(auth(token))
    .send({ name: '微信零钱', kindId: kindItem?.id, ...rest })
}

// 账户对 User 是 CASCADE,但先清干净更省心(脏库上不留历史数据)
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

test('创建账户成功:默认余额 0、默认启用;重名返回 409', async () => {
  const token = await registerAndLogin()

  const created = await createAccount(token, { name: '微信零钱', balanceCents: 23580, note: '常用' })
  assert.strictEqual(created.status, 201)
  assert.strictEqual(created.body.name, '微信零钱')
  assert.strictEqual(created.body.kind.name, '微信零钱')
  assert.strictEqual(created.body.balanceCents, 23580)
  assert.strictEqual(created.body.note, '常用')
  assert.strictEqual(created.body.enabled, true)
  assert.ok(created.body.balanceUpdatedAt, '要有「上次更新时间」')

  const noBalance = await createAccount(token, { name: '现金', kind: 'CASH' })
  assert.strictEqual(noBalance.body.balanceCents, 0)

  const again = await createAccount(token, { name: '微信零钱' })
  assert.strictEqual(again.status, 409)
  assert.strictEqual(again.body.message, '账户名已存在')
})

test('八种账户类型都能建(校验器和库里的枚举不许对不上)', async () => {
  const token = await registerAndLogin()
  const kinds = ['CASH', 'WECHAT', 'ALIPAY', 'DEBIT_CARD', 'CREDIT_CARD', 'INVESTMENT', 'LIABILITY', 'OTHER']
  const kindItems = await getAccountKinds(token)

  for (const kind of kinds) {
    const created = await createAccount(token, { name: `账户-${kind}`, kind })
    assert.strictEqual(created.status, 201, `${kind} 应该能建`)
    assert.strictEqual(created.body.kind.id, kindItems.find((item) => item.code === kind).id)
  }
})

test('余额可以是负数(信用卡欠款)', async () => {
  const token = await registerAndLogin()

  const created = await createAccount(token, { name: '招行信用卡', kind: 'CREDIT_CARD', balanceCents: -320000 })
  assert.strictEqual(created.status, 201)
  assert.strictEqual(created.body.balanceCents, -320000)
})

test('改余额刷新「上次更新时间」,金额没变则不刷新;改名/停用都不动它', async () => {
  const token = await registerAndLogin()
  const created = await createAccount(token, { name: '支付宝', kind: 'ALIPAY', balanceCents: 10000 })
  const id = created.body.id

  // 先把时间戳改成很久以前,这样断言不受「毫秒级同秒」影响
  const old = new Date('2020-01-01T00:00:00.000Z')
  await prisma.ledgerAccount.update({ where: { id }, data: { balanceUpdatedAt: old } })

  const sameAmount = await request(app)
    .patch(`/api/ledger/accounts/${id}/balance`)
    .set(auth(token))
    .send({ balanceCents: 10000 })
  assert.strictEqual(sameAmount.status, 200)
  assert.strictEqual(sameAmount.body.balanceUpdatedAt, old.toISOString())

  const renamed = await request(app)
    .patch(`/api/ledger/accounts/${id}`)
    .set(auth(token))
    .send({ name: '支付宝(主)', enabled: false })
  assert.strictEqual(renamed.status, 200)
  assert.strictEqual(renamed.body.balanceCents, 10000)
  assert.strictEqual(renamed.body.balanceUpdatedAt, old.toISOString())

  const changed = await request(app)
    .patch(`/api/ledger/accounts/${id}/balance`)
    .set(auth(token))
    .send({ balanceCents: 25000 })
  assert.strictEqual(changed.status, 200)
  assert.strictEqual(changed.body.balanceCents, 25000)
  assert.notStrictEqual(changed.body.balanceUpdatedAt, old.toISOString())
})

test('启用开关:默认列表全都在,?enabled= 只看启用/停用的', async () => {
  const token = await registerAndLogin()
  await createAccount(token, { name: '在用账户' })
  const disabled = await createAccount(token, { name: '停用账户', kind: 'DEBIT_CARD' })

  const off = await request(app)
    .patch(`/api/ledger/accounts/${disabled.body.id}`)
    .set(auth(token))
    .send({ enabled: false })
  assert.strictEqual(off.status, 200)
  assert.strictEqual(off.body.enabled, false)

  const all = await request(app).get('/api/ledger/accounts').set(auth(token))
  assert.strictEqual(all.body.length, 2)

  const enabledOnly = await request(app).get('/api/ledger/accounts?enabled=true').set(auth(token))
  assert.strictEqual(enabledOnly.body.length, 1)
  assert.strictEqual(enabledOnly.body[0].name, '在用账户')

  const disabledOnly = await request(app).get('/api/ledger/accounts?enabled=false').set(auth(token))
  assert.strictEqual(disabledOnly.body.length, 1)
  assert.strictEqual(disabledOnly.body[0].name, '停用账户')
})

test('列表排序:启用的在前,同组内按 sortOrder', async () => {
  const token = await registerAndLogin()
  await createAccount(token, { name: '丙', sortOrder: 0 })
  await createAccount(token, { name: '甲', sortOrder: 2 })
  const second = await createAccount(token, { name: '乙', sortOrder: 1 })

  const list = await request(app).get('/api/ledger/accounts').set(auth(token))
  assert.deepStrictEqual(
    list.body.map((item) => item.name),
    ['丙', '乙', '甲']
  )

  // 停用后沉到最后
  await request(app).patch(`/api/ledger/accounts/${second.body.id}`).set(auth(token)).send({ enabled: false })
  const sorted = await request(app).get('/api/ledger/accounts').set(auth(token))
  assert.deepStrictEqual(
    sorted.body.map((item) => item.name),
    ['丙', '甲', '乙']
  )
})

test('入参不合法返回 400:类型、金额、空更新、未知字段', async () => {
  const token = await registerAndLogin()
  const created = await createAccount(token, { name: '校验账户' })

  const badKind = await createAccount(token, { name: '类型不对', kind: 'BITCOIN' })
  assert.strictEqual(badKind.status, 400)

  const tooLarge = await createAccount(token, { name: '金额超大', balanceCents: 1000000000 })
  assert.strictEqual(tooLarge.status, 400)

  const notInt = await createAccount(token, { name: '金额是小数', balanceCents: 12.34 })
  assert.strictEqual(notInt.status, 400)

  const emptyUpdate = await request(app)
    .patch(`/api/ledger/accounts/${created.body.id}`)
    .set(auth(token))
    .send({})
  assert.strictEqual(emptyUpdate.status, 400)

  // 未知字段直接拒掉,而不是被静默忽略
  const unknownField = await request(app)
    .patch(`/api/ledger/accounts/${created.body.id}`)
    .set(auth(token))
    .send({ balanceCents: 100 })
  assert.strictEqual(unknownField.status, 400)

  const badId = await request(app)
    .patch('/api/ledger/accounts/abc')
    .set(auth(token))
    .send({ name: 'ID 不是数字' })
  assert.strictEqual(badId.status, 400)
})

test('备注空串归一成 null', async () => {
  const token = await registerAndLogin()
  const created = await createAccount(token, { name: '带备注', note: '  尾号 1234  ' })
  assert.strictEqual(created.body.note, '尾号 1234')

  const cleared = await request(app)
    .patch(`/api/ledger/accounts/${created.body.id}`)
    .set(auth(token))
    .send({ note: '   ' })
  assert.strictEqual(cleared.body.note, null)
})

test('只能看到和改自己的账户', async () => {
  const aliceToken = await registerAndLogin('alice')
  const bobToken = await registerAndLogin('bob')
  const aliceAccount = await createAccount(aliceToken, { name: 'alice 的账户' })

  const bobList = await request(app).get('/api/ledger/accounts').set(auth(bobToken))
  assert.strictEqual(bobList.body.length, 0)

  const bobUpdate = await request(app)
    .patch(`/api/ledger/accounts/${aliceAccount.body.id}`)
    .set(auth(bobToken))
    .send({ name: '改别人的' })
  assert.strictEqual(bobUpdate.status, 404)

  const bobBalance = await request(app)
    .patch(`/api/ledger/accounts/${aliceAccount.body.id}/balance`)
    .set(auth(bobToken))
    .send({ balanceCents: 0 })
  assert.strictEqual(bobBalance.status, 404)

  const bobDelete = await request(app)
    .delete(`/api/ledger/accounts/${aliceAccount.body.id}`)
    .set(auth(bobToken))
  assert.strictEqual(bobDelete.status, 404)
})

test('未登录一律 401', async () => {
  const list = await request(app).get('/api/ledger/accounts')
  assert.strictEqual(list.status, 401)

  const created = await request(app).post('/api/ledger/accounts').send({ name: 'x', kindId: 1 })
  assert.strictEqual(created.status, 401)
})

test('删除账户成功', async () => {
  const token = await registerAndLogin()
  const created = await createAccount(token, { name: '待删除' })

  const removed = await request(app).delete(`/api/ledger/accounts/${created.body.id}`).set(auth(token))
  assert.strictEqual(removed.status, 204)

  const list = await request(app).get('/api/ledger/accounts').set(auth(token))
  assert.strictEqual(list.body.length, 0)
})

test('删用户时账户跟着一起清掉(CASCADE)', async () => {
  const token = await registerAndLogin()
  await createAccount(token, { name: '跟着用户走' })
  assert.strictEqual(await prisma.ledgerAccount.count(), 1)

  await prisma.user.delete({ where: { username: 'alice' } })
  assert.strictEqual(await prisma.ledgerAccount.count(), 0)
})
