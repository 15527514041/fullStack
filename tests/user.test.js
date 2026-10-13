const { test, beforeEach, after } = require('node:test')
const assert = require('node:assert')
const request = require('supertest')
const { PrismaClient } = require('@prisma/client')

const app = require('../app')
const prisma = new PrismaClient()

async function registerAndLogin(username = 'alice', password = '123456') {
  await request(app).post('/api/auth/register').send({ username, password })
  const res = await request(app).post('/api/auth/login').send({ username, password })
  return res.body.token
}

function changePassword(token, body) {
  return request(app).patch('/api/users/me/password').set('Authorization', `Bearer ${token}`).send(body)
}

// 先删 todo/tag 再删 user:这两个表对 User 是 RESTRICT,脏库上直接删用户会报外键错误
beforeEach(async () => {
  await prisma.todo.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.user.deleteMany()
})

after(async () => {
  await prisma.$disconnect()
})

test('修改密码成功后,旧密码登不进去,新密码能登进去', async () => {
  const token = await registerAndLogin()

  const res = await changePassword(token, { password: 'newpass123', confirmPassword: 'newpass123' })
  assert.strictEqual(res.status, 200)
  assert.strictEqual(res.body.message, '密码修改成功')
  assert.strictEqual(res.body.password, undefined) // 接口绝不回传密码

  const oldLogin = await request(app).post('/api/auth/login').send({ username: 'alice', password: '123456' })
  assert.strictEqual(oldLogin.status, 401)

  const newLogin = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'newpass123' })
  assert.strictEqual(newLogin.status, 200)
  assert.ok(newLogin.body.token)
  assert.strictEqual(newLogin.body.user.username, 'alice')
})

test('库里存的是新密码的哈希,不是明文', async () => {
  const token = await registerAndLogin()
  await changePassword(token, { password: 'newpass123', confirmPassword: 'newpass123' })

  const user = await prisma.user.findUnique({ where: { username: 'alice' } })
  assert.notStrictEqual(user.password, 'newpass123')
  assert.ok(user.password.startsWith('$2')) // bcryptjs 的哈希以 $2a$ / $2b$ 开头
})

test('两次密码不一致返回 400,并且不改库', async () => {
  const token = await registerAndLogin()

  const res = await changePassword(token, { password: 'newpass123', confirmPassword: 'newpass124' })
  assert.strictEqual(res.status, 400)
  assert.deepStrictEqual(res.body.errors, [{ field: 'confirmPassword', message: '两次输入的密码不一致' }])

  // 校验没过就不该动数据库
  const stillOld = await request(app).post('/api/auth/login').send({ username: 'alice', password: '123456' })
  assert.strictEqual(stillOld.status, 200)
})

test('新密码要符合注册时的密码规则(6-32 位),缺字段也返回 400', async () => {
  const token = await registerAndLogin()

  assert.strictEqual((await changePassword(token, { password: '12345', confirmPassword: '12345' })).status, 400)

  const tooLong = 'x'.repeat(33)
  assert.strictEqual((await changePassword(token, { password: tooLong, confirmPassword: tooLong })).status, 400)

  assert.strictEqual((await changePassword(token, { password: 'newpass123' })).status, 400)
})

test('未登录修改密码返回 401', async () => {
  const res = await request(app)
    .patch('/api/users/me/password')
    .send({ password: 'newpass123', confirmPassword: 'newpass123' })

  assert.strictEqual(res.status, 401)
})

test('只能改自己的密码,别人的账号不受影响', async () => {
  const aliceToken = await registerAndLogin('alice')
  await registerAndLogin('bob')

  await changePassword(aliceToken, { password: 'alice-new-1', confirmPassword: 'alice-new-1' })

  const bobLogin = await request(app).post('/api/auth/login').send({ username: 'bob', password: '123456' })
  assert.strictEqual(bobLogin.status, 200)
})
