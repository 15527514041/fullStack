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
  const kinds = await request(app)
    .get('/api/dictionaries?kind=ACCOUNT_KIND')
    .set(auth(token))
  const kindItem = kinds.body.find((item) => item.code === kind)
  return request(app)
    .post('/api/ledger/accounts')
    .set(auth(token))
    .send({ name: '微信零钱', kindId: kindItem.id, ...rest })
}

async function saveSnapshot(token, body = {}) {
  return request(app)
    .post('/api/ledger/asset-snapshots')
    .set(auth(token))
    .send({ snapshotDate: '2026-11-06', ...body })
}

beforeEach(async () => {
  await prisma.ledgerAssetSnapshot.deleteMany()
  await prisma.ledgerRecord.deleteMany()
  await prisma.ledgerAccount.deleteMany()
  await prisma.todo.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.user.deleteMany()
})

after(async () => {
  await prisma.$disconnect()
})

test('预览回显全部账户:停用账户保留,但不计入汇总', async () => {
  const token = await registerAndLogin()
  await createAccount(token, { name: '现金', kind: 'CASH', balanceCents: 10000 })
  await createAccount(token, { name: '信用卡', kind: 'CREDIT_CARD', balanceCents: -3000 })
  const disabled = await createAccount(token, {
    name: '旧储蓄卡',
    kind: 'DEBIT_CARD',
    balanceCents: 50000
  })
  await request(app)
    .patch(`/api/ledger/accounts/${disabled.body.id}`)
    .set(auth(token))
    .send({ enabled: false })

  const preview = await request(app)
    .get('/api/ledger/asset-snapshots/preview')
    .set(auth(token))

  assert.strictEqual(preview.status, 200)
  assert.strictEqual(preview.body.accounts.length, 3)
  assert.strictEqual(preview.body.accounts.find((item) => item.name === '旧储蓄卡').enabled, false)
  assert.deepStrictEqual(preview.body.stats, {
    totalAssetsCents: 10000,
    totalDebtCents: 3000,
    netAssetsCents: 7000,
    accountCount: 3,
    enabledAccountCount: 2
  })
})

test('保存快照冻结全部账户与统计,且不修改当前账户', async () => {
  const token = await registerAndLogin()
  const cash = await createAccount(token, {
    name: '现金',
    kind: 'CASH',
    balanceCents: 120000,
    note: '钱包'
  })
  await createAccount(token, {
    name: '信用卡',
    kind: 'CREDIT_CARD',
    balanceCents: -20000
  })

  const saved = await saveSnapshot(token, { note: '  十一月核对  ' })
  assert.strictEqual(saved.status, 201)
  assert.strictEqual(saved.body.snapshotDate, '2026-11-06')
  assert.strictEqual(saved.body.note, '十一月核对')
  assert.strictEqual(saved.body.totalAssetsCents, 120000)
  assert.strictEqual(saved.body.totalDebtCents, 20000)
  assert.strictEqual(saved.body.netAssetsCents, 100000)
  assert.strictEqual(saved.body.accountCount, 2)
  assert.strictEqual(saved.body.enabledAccountCount, 2)
  assert.strictEqual(saved.body.items.length, 2)
  assert.strictEqual(saved.body.items[0].accountName, '现金')
  assert.strictEqual(saved.body.items[0].kindCode, 'CASH')

  const current = await request(app).get('/api/ledger/accounts').set(auth(token))
  assert.strictEqual(current.body.find((item) => item.id === cash.body.id).balanceCents, 120000)
})

test('快照保存后改名、改余额、停用或删除当前账户,历史仍保持原样', async () => {
  const token = await registerAndLogin()
  const cash = await createAccount(token, {
    name: '现金',
    kind: 'CASH',
    balanceCents: 10000
  })
  const removable = await createAccount(token, {
    name: '待删除卡',
    kind: 'DEBIT_CARD',
    balanceCents: 5000
  })

  const saved = await saveSnapshot(token)
  await request(app)
    .patch(`/api/ledger/accounts/${cash.body.id}/balance`)
    .set(auth(token))
    .send({ balanceCents: 99999 })
  await request(app)
    .patch(`/api/ledger/accounts/${cash.body.id}`)
    .set(auth(token))
    .send({ name: '现金改名', enabled: false })
  await request(app)
    .delete(`/api/ledger/accounts/${removable.body.id}`)
    .set(auth(token))

  const detail = await request(app)
    .get(`/api/ledger/asset-snapshots/${saved.body.id}`)
    .set(auth(token))

  assert.strictEqual(detail.status, 200)
  assert.strictEqual(detail.body.totalAssetsCents, 15000)
  assert.strictEqual(detail.body.items.length, 2)
  const frozenCash = detail.body.items.find((item) => item.accountId === cash.body.id)
  assert.strictEqual(frozenCash.accountName, '现金')
  assert.strictEqual(frozenCash.balanceCents, 10000)
  assert.strictEqual(frozenCash.enabled, true)
  assert.ok(detail.body.items.find((item) => item.accountId === removable.body.id))
})

test('同一天重复保存返回 409;确认覆盖后仍只有一个批次', async () => {
  const token = await registerAndLogin()
  await createAccount(token, { name: '现金', kind: 'CASH', balanceCents: 10000 })

  const first = await saveSnapshot(token)
  assert.strictEqual(first.status, 201)

  await createAccount(token, { name: '支付宝', kind: 'ALIPAY', balanceCents: 20000 })
  const duplicate = await saveSnapshot(token, { note: '不应保存' })
  assert.strictEqual(duplicate.status, 409)
  assert.strictEqual(duplicate.body.message, '该日期已有资产快照')

  const overwritten = await saveSnapshot(token, {
    note: '覆盖后的快照',
    overwrite: true
  })
  assert.strictEqual(overwritten.status, 201)
  assert.strictEqual(overwritten.body.id, first.body.id)
  assert.strictEqual(overwritten.body.note, '覆盖后的快照')
  assert.strictEqual(overwritten.body.accountCount, 2)
  assert.strictEqual(overwritten.body.totalAssetsCents, 30000)
  assert.strictEqual(overwritten.body.items.length, 2)

  const list = await request(app)
    .get('/api/ledger/asset-snapshots')
    .set(auth(token))
  assert.strictEqual(list.body.length, 1)
})

test('批次列表按日期倒序,详情只返回批次数据', async () => {
  const token = await registerAndLogin()
  await createAccount(token, { name: '现金', kind: 'CASH', balanceCents: 10000 })
  await saveSnapshot(token, { snapshotDate: '2026-10-06' })
  await saveSnapshot(token, { snapshotDate: '2026-11-06' })

  const list = await request(app)
    .get('/api/ledger/asset-snapshots')
    .set(auth(token))
  assert.strictEqual(list.status, 200)
  assert.deepStrictEqual(
    list.body.map((item) => item.snapshotDate),
    ['2026-11-06', '2026-10-06']
  )
  assert.strictEqual(list.body[0].items, undefined)
})

test('单条删除快照:校验归属,成功后连同冻结明细一起删除', async () => {
  const token = await registerAndLogin()
  await createAccount(token, { name: '现金', kind: 'CASH', balanceCents: 10000 })
  const first = await saveSnapshot(token, { snapshotDate: '2026-10-06' })
  const second = await saveSnapshot(token, { snapshotDate: '2026-11-06' })
  assert.strictEqual(await prisma.ledgerAssetSnapshotItem.count({ where: { snapshotId: first.body.id } }), 1)

  const bobToken = await registerAndLogin('bob')
  const forbidden = await request(app)
    .delete(`/api/ledger/asset-snapshots/${second.body.id}`)
    .set(auth(bobToken))
  assert.strictEqual(forbidden.status, 404)

  const removed = await request(app)
    .delete(`/api/ledger/asset-snapshots/${first.body.id}`)
    .set(auth(token))
  assert.strictEqual(removed.status, 204)
  assert.strictEqual(await prisma.ledgerAssetSnapshotItem.count({ where: { snapshotId: first.body.id } }), 0)

  const list = await request(app)
    .get('/api/ledger/asset-snapshots')
    .set(auth(token))
  assert.deepStrictEqual(list.body.map((item) => item.id), [second.body.id])

  const deletedDetail = await request(app)
    .get(`/api/ledger/asset-snapshots/${first.body.id}`)
    .set(auth(token))
  assert.strictEqual(deletedDetail.status, 404)
})

test('两个快照对比只返回批次汇总与差值', async () => {
  const token = await registerAndLogin()
  const cash = await createAccount(token, {
    name: '现金',
    kind: 'CASH',
    balanceCents: 10000
  })
  await createAccount(token, {
    name: '信用卡',
    kind: 'CREDIT_CARD',
    balanceCents: -2000
  })
  const first = await saveSnapshot(token, { snapshotDate: '2026-10-06' })

  await request(app)
    .patch(`/api/ledger/accounts/${cash.body.id}/balance`)
    .set(auth(token))
    .send({ balanceCents: 25000 })
  await createAccount(token, { name: '支付宝', kind: 'ALIPAY', balanceCents: 30000 })
  const second = await saveSnapshot(token, { snapshotDate: '2026-11-06' })

  const comparison = await request(app)
    .get(
      `/api/ledger/asset-snapshots/compare?fromId=${first.body.id}&toId=${second.body.id}`
    )
    .set(auth(token))

  assert.strictEqual(comparison.status, 200)
  assert.strictEqual(comparison.body.from.id, first.body.id)
  assert.strictEqual(comparison.body.to.id, second.body.id)
  assert.strictEqual(comparison.body.from.items, undefined)
  assert.deepStrictEqual(comparison.body.delta, {
    totalAssetsCents: 45000,
    totalDebtCents: 0,
    netAssetsCents: 45000,
    accountCount: 1,
    enabledAccountCount: 1
  })
})

test('用户不能查看或对比别人的快照', async () => {
  const aliceToken = await registerAndLogin('alice')
  const bobToken = await registerAndLogin('bob')
  await createAccount(aliceToken, { name: 'alice 现金', kind: 'CASH', balanceCents: 10000 })
  await createAccount(bobToken, { name: 'bob 现金', kind: 'CASH', balanceCents: 20000 })

  const aliceOne = await saveSnapshot(aliceToken, { snapshotDate: '2026-10-06' })
  const aliceTwo = await saveSnapshot(aliceToken, { snapshotDate: '2026-11-06' })
  const bobOne = await saveSnapshot(bobToken, { snapshotDate: '2026-11-06' })

  const bobList = await request(app)
    .get('/api/ledger/asset-snapshots')
    .set(auth(bobToken))
  assert.deepStrictEqual(bobList.body.map((item) => item.id), [bobOne.body.id])

  const bobDetail = await request(app)
    .get(`/api/ledger/asset-snapshots/${aliceOne.body.id}`)
    .set(auth(bobToken))
  assert.strictEqual(bobDetail.status, 404)

  const bobCompare = await request(app)
    .get(
      `/api/ledger/asset-snapshots/compare?fromId=${aliceOne.body.id}&toId=${aliceTwo.body.id}`
    )
    .set(auth(bobToken))
  assert.strictEqual(bobCompare.status, 404)
})

test('参数、空账户和登录校验', async () => {
  const noAccountsToken = await registerAndLogin()
  const empty = await saveSnapshot(noAccountsToken)
  assert.strictEqual(empty.status, 409)
  assert.strictEqual(empty.body.message, '暂无可保存的资产账户')

  const badDate = await saveSnapshot(noAccountsToken, { snapshotDate: '2026-02-31' })
  assert.strictEqual(badDate.status, 400)

  const extraField = await saveSnapshot(noAccountsToken, { unknown: true })
  assert.strictEqual(extraField.status, 400)

  const sameSnapshot = await request(app)
    .get('/api/ledger/asset-snapshots/compare?fromId=1&toId=1')
    .set(auth(noAccountsToken))
  assert.strictEqual(sameSnapshot.status, 400)

  const unauthorized = await request(app)
    .get('/api/ledger/asset-snapshots/preview')
  assert.strictEqual(unauthorized.status, 401)
})
