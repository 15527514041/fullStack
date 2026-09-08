const { test, beforeEach, after } = require('node:test')
const assert = require('node:assert')
const request = require('supertest')
const { PrismaClient } = require('@prisma/client')

const app = require('../app')
const prisma = new PrismaClient()

// 每个测试前清空数据,保证用例互相独立
beforeEach(async () => {
  await prisma.todo.deleteMany()
  await prisma.user.deleteMany()
})

after(async () => {
  await prisma.$disconnect()
})

test('注册成功返回 201 和用户信息', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username: 'alice', password: '123456' })

  assert.strictEqual(res.status, 201)
  assert.strictEqual(res.body.username, 'alice')
  assert.ok(!res.body.password) // 接口绝不能返回密码
})

test('重复用户名注册返回 409', async () => {
  await request(app).post('/api/auth/register').send({ username: 'alice', password: '123456' })

  const res = await request(app)
    .post('/api/auth/register')
    .send({ username: 'alice', password: '123456' })

  assert.strictEqual(res.status, 409)
})

test('非法入参返回 400', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username: 'x', password: '1' })

  assert.strictEqual(res.status, 400)
})

test('登录成功返回 token', async () => {
  await request(app).post('/api/auth/register').send({ username: 'alice', password: '123456' })

  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'alice', password: '123456' })

  assert.strictEqual(res.status, 200)
  assert.ok(res.body.token)
})

test('密码错误返回 401', async () => {
  await request(app).post('/api/auth/register').send({ username: 'alice', password: '123456' })

  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'alice', password: 'wrong1' })

  assert.strictEqual(res.status, 401)
})