const { test, beforeEach, after } = require('node:test')
const assert = require('node:assert')
const request = require('supertest')
const { PrismaClient } = require('@prisma/client')

const app = require('../app')
const prisma = new PrismaClient()

// 注册 + 登录,返回 token
async function registerAndLogin(username = 'alice') {
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

test('未登录访问 /api/todos 返回 401', async () => {
  const res = await request(app).get('/api/todos')
  assert.strictEqual(res.status, 401)
})

test('创建 TODO 返回 201', async () => {
  const token = await registerAndLogin()

  const res = await request(app)
    .post('/api/todos')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: '写测试' })

  assert.strictEqual(res.status, 201)
  assert.strictEqual(res.body.title, '写测试')
  assert.strictEqual(res.body.completed, false)
})

test('列表返回分页结构', async () => {
  const token = await registerAndLogin()
  await request(app).post('/api/todos').set('Authorization', `Bearer ${token}`).send({ title: 'A' })
  await request(app).post('/api/todos').set('Authorization', `Bearer ${token}`).send({ title: 'B' })

  const res = await request(app).get('/api/todos').set('Authorization', `Bearer ${token}`)

  assert.strictEqual(res.status, 200)
  assert.strictEqual(res.body.total, 2)
  assert.strictEqual(res.body.list.length, 2)
})

test('用户之间数据隔离:看不到别人的 TODO', async () => {
  const aliceToken = await registerAndLogin('alice')
  const bobToken = await registerAndLogin('bob')
  await request(app).post('/api/todos').set('Authorization', `Bearer ${aliceToken}`).send({ title: 'Alice 的' })

  const res = await request(app).get('/api/todos').set('Authorization', `Bearer ${bobToken}`)

  assert.strictEqual(res.status, 200)
  assert.strictEqual(res.body.total, 0)
})

test('能更新自己的 TODO,改别人的返回 404', async () => {
  const aliceToken = await registerAndLogin('alice')
  const bobToken = await registerAndLogin('bob')
  const created = await request(app)
    .post('/api/todos')
    .set('Authorization', `Bearer ${aliceToken}`)
    .send({ title: 'A' })

  const ok = await request(app)
    .patch(`/api/todos/${created.body.id}`)
    .set('Authorization', `Bearer ${aliceToken}`)
    .send({ completed: true })
  assert.strictEqual(ok.status, 200)
  assert.strictEqual(ok.body.completed, true)

  const denied = await request(app)
    .patch(`/api/todos/${created.body.id}`)
    .set('Authorization', `Bearer ${bobToken}`)
    .send({ completed: true })
  assert.strictEqual(denied.status, 404) // 查不到=不暴露别人的数据存在
})

test('软删除后列表消失,恢复后回来', async () => {
  const token = await registerAndLogin()
  const created = await request(app)
    .post('/api/todos')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'A' })
  const id = created.body.id

  const del = await request(app).delete(`/api/todos/${id}`).set('Authorization', `Bearer ${token}`)
  assert.strictEqual(del.status, 204)

  let res = await request(app).get('/api/todos').set('Authorization', `Bearer ${token}`)
  assert.strictEqual(res.body.total, 0)

  await request(app).post(`/api/todos/${id}/restore`).set('Authorization', `Bearer ${token}`)
  res = await request(app).get('/api/todos').set('Authorization', `Bearer ${token}`)
  assert.strictEqual(res.body.total, 1)
})