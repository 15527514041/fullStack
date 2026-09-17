const { test, beforeEach, after } = require('node:test')
const assert = require('node:assert')
const request = require('supertest')
const { PrismaClient } = require('@prisma/client')

const app = require('../app')
const prisma = new PrismaClient()

async function createUser(username) {
  await request(app).post('/api/auth/register').send({ username, password: '123456' })
  const res = await request(app).post('/api/auth/login').send({ username, password: '123456' })
  return res.body.token
}

beforeEach(async () => {
  await prisma.todo.deleteMany()
  await prisma.user.deleteMany()
})

after(async () => {
  await prisma.$disconnect()
})

test('未登录访问管理接口返回 401', async () => {
  const res = await request(app).get('/api/admin/users')
  assert.strictEqual(res.status, 401)
})

test('普通用户访问管理接口返回 403', async () => {
  const token = await createUser('alice')
  const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`)
  assert.strictEqual(res.status, 403)
})

test('管理员可以获取用户列表', async () => {
  await createUser('alice')
  const adminToken = await createUser('boss')
  await prisma.user.update({ where: { username: 'boss' }, data: { role: 'ADMIN' } })

  const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${adminToken}`)
  assert.strictEqual(res.status, 200)
  assert.strictEqual(res.body.length, 2)
  assert.ok(!res.body[0].password) // 列表不返回密码
})

test('管理员改角色后,原 token 立即生效(角色读数据库)', async () => {
  const aliceToken = await createUser('alice')
  const adminToken = await createUser('boss')
  await prisma.user.update({ where: { username: 'boss' }, data: { role: 'ADMIN' } })

  const before = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${aliceToken}`)
  assert.strictEqual(before.status, 403)

  const alice = await prisma.user.findUnique({ where: { username: 'alice' } })
  const promote = await request(app)
    .patch(`/api/admin/users/${alice.id}/role`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ role: 'ADMIN' })
  assert.strictEqual(promote.status, 200)

  const after = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${aliceToken}`)
  assert.strictEqual(after.status, 200) // 不用重新登录
})