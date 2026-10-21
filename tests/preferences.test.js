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

function updatePreferences(token, ledgerEntrySources) {
  return request(app)
    .patch('/api/users/me/preferences')
    .set(auth(token))
    .send({ ledgerEntrySources })
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

test('新用户默认启用日、周、月三个账单维度', async () => {
  const token = await registerAndLogin()
  const res = await request(app).get('/api/users/me/preferences').set(auth(token))

  assert.strictEqual(res.status, 200)
  assert.deepStrictEqual(res.body.ledgerEntrySources, ['manual_day', 'manual_week', 'manual_month'])
})

test('可以保存一至三个维度,并读取最新配置', async () => {
  const token = await registerAndLogin()
  const updated = await updatePreferences(token, ['manual_day', 'manual_month'])

  assert.strictEqual(updated.status, 200)
  assert.deepStrictEqual(updated.body.ledgerEntrySources, ['manual_day', 'manual_month'])

  const fetched = await request(app).get('/api/users/me/preferences').set(auth(token))
  assert.deepStrictEqual(fetched.body.ledgerEntrySources, ['manual_day', 'manual_month'])

  const single = await updatePreferences(token, ['manual_month'])
  assert.strictEqual(single.status, 200)
  assert.deepStrictEqual(single.body.ledgerEntrySources, ['manual_month'])
})

test('至少保留一个维度,重复和非法维度都会被拒绝', async () => {
  const token = await registerAndLogin()

  assert.strictEqual((await updatePreferences(token, [])).status, 400)
  assert.strictEqual(
    (await updatePreferences(token, ['manual_day', 'manual_day'])).status,
    400
  )
  assert.strictEqual((await updatePreferences(token, ['invalid'])).status, 400)

  const fetched = await request(app).get('/api/users/me/preferences').set(auth(token))
  assert.deepStrictEqual(fetched.body.ledgerEntrySources, ['manual_day', 'manual_week', 'manual_month'])
})

test('偏好配置按用户隔离,未登录不能访问', async () => {
  const aliceToken = await registerAndLogin('alice')
  const bobToken = await registerAndLogin('bob')

  await updatePreferences(aliceToken, ['manual_month'])
  const bob = await request(app).get('/api/users/me/preferences').set(auth(bobToken))

  assert.deepStrictEqual(bob.body.ledgerEntrySources, ['manual_day', 'manual_week', 'manual_month'])
  assert.strictEqual((await request(app).get('/api/users/me/preferences')).status, 401)
})
