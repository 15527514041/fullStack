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

async function makeAdmin(username) {
  await prisma.user.update({ where: { username }, data: { role: 'ADMIN' } })
}

beforeEach(async () => {
  await prisma.todo.deleteMany()
  await prisma.tag.deleteMany()
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

test('管理员可以分页获取用户列表', async () => {
  await createUser('alice')
  const adminToken = await createUser('boss')
  await makeAdmin('boss')

  const res = await request(app)
    .get('/api/admin/users?page=1&pageSize=10')
    .set('Authorization', `Bearer ${adminToken}`)

  assert.strictEqual(res.status, 200)
  assert.strictEqual(res.body.total, 2)
  assert.strictEqual(res.body.list.length, 2)
  assert.ok(!res.body.list[0].password) // 列表不返回密码
})

test('管理员搜索用户名', async () => {
  await createUser('alice')
  const adminToken = await createUser('boss')
  await makeAdmin('boss')

  const res = await request(app)
    .get('/api/admin/users?keyword=ali')
    .set('Authorization', `Bearer ${adminToken}`)

  assert.strictEqual(res.status, 200)
  assert.strictEqual(res.body.total, 1)
  assert.strictEqual(res.body.list[0].username, 'alice')
})

test('管理员改角色后,原 token 立即生效(角色读数据库)', async () => {
  const aliceToken = await createUser('alice')
  const adminToken = await createUser('boss')
  await makeAdmin('boss')

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

test('管理员禁用用户后,该用户无法登录且旧 token 失效', async () => {
  const aliceToken = await createUser('alice')
  const adminToken = await createUser('boss')
  await makeAdmin('boss')

  const alice = await prisma.user.findUnique({ where: { username: 'alice' } })
  const banned = await request(app)
    .patch(`/api/admin/users/${alice.id}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'BANNED' })
  assert.strictEqual(banned.status, 200)

  const login = await request(app)
    .post('/api/auth/login')
    .send({ username: 'alice', password: '123456' })
  assert.strictEqual(login.status, 403)

  const withOldToken = await request(app).get('/api/todos').set('Authorization', `Bearer ${aliceToken}`)
  assert.strictEqual(withOldToken.status, 403)
})

test('管理员删除用户:账号连它的数据一起清掉', async () => {
  const aliceToken = await createUser('alice')
  const adminToken = await createUser('boss')
  await makeAdmin('boss')

  // 给 alice 造点各类数据:标签 / 待办(挂标签)/ 反思 / 规划
  const tag = await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${aliceToken}`)
    .send({ name: '工作', type: 'primary' })
  await request(app)
    .post('/api/todos')
    .set('Authorization', `Bearer ${aliceToken}`)
    .send({ title: '写周报', tagIds: [tag.body.id] })
  await request(app)
    .post('/api/reflections')
    .set('Authorization', `Bearer ${aliceToken}`)
    .send({ date: '2026-10-13', items: [{ experience: '今天效率不错' }] })
  await request(app)
    .post('/api/plans')
    .set('Authorization', `Bearer ${aliceToken}`)
    .send({ date: '2026-10-13', todos: [{ name: '写周报' }] })

  const alice = await prisma.user.findUnique({ where: { username: 'alice' } })
  const res = await request(app).delete(`/api/admin/users/${alice.id}`).set('Authorization', `Bearer ${adminToken}`)

  assert.strictEqual(res.status, 200)
  assert.strictEqual(res.body.message, '用户已删除')
  assert.deepStrictEqual(res.body.removed, { todos: 1, tags: 1, reflections: 1, plans: 1 })

  // 库里的数据确实都没了(否则外键 RESTRICT 根本删不掉用户,这里再确认一遍)
  assert.strictEqual(await prisma.user.count({ where: { username: 'alice' } }), 0)
  assert.strictEqual(await prisma.todo.count({ where: { userId: alice.id } }), 0)
  assert.strictEqual(await prisma.tag.count({ where: { userId: alice.id } }), 0)
  assert.strictEqual(await prisma.dailyReflection.count({ where: { userId: alice.id } }), 0)
  assert.strictEqual(await prisma.dailyPlan.count({ where: { userId: alice.id } }), 0)

  // 用户列表里也查不到了
  const list = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${adminToken}`)
  assert.strictEqual(list.body.total, 1)
  assert.strictEqual(list.body.list[0].username, 'boss')
})

test('管理员不能删除自己', async () => {
  const adminToken = await createUser('boss')
  await makeAdmin('boss')
  const boss = await prisma.user.findUnique({ where: { username: 'boss' } })

  const res = await request(app).delete(`/api/admin/users/${boss.id}`).set('Authorization', `Bearer ${adminToken}`)

  assert.strictEqual(res.status, 400)
  assert.strictEqual(res.body.message, '不能删除自己')
  assert.strictEqual(await prisma.user.count({ where: { username: 'boss' } }), 1)
})

test('删除用户:不存在的 id 返回 404,普通用户 403,未登录 401', async () => {
  const aliceToken = await createUser('alice')
  const adminToken = await createUser('boss')
  await makeAdmin('boss')
  const alice = await prisma.user.findUnique({ where: { username: 'alice' } })

  const notFound = await request(app).delete('/api/admin/users/999999').set('Authorization', `Bearer ${adminToken}`)
  assert.strictEqual(notFound.status, 404)

  const forbidden = await request(app)
    .delete(`/api/admin/users/${alice.id}`)
    .set('Authorization', `Bearer ${aliceToken}`)
  assert.strictEqual(forbidden.status, 403)

  const anonymous = await request(app).delete(`/api/admin/users/${alice.id}`)
  assert.strictEqual(anonymous.status, 401)

  assert.strictEqual(await prisma.user.count({ where: { username: 'alice' } }), 1) // 一个都没删掉
})
