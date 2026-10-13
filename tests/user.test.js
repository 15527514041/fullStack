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

// 默认给一套合法入参(原密码 = 注册时用的 123456),想测异常场景就传字段覆盖
function changePassword(token, body = {}) {
  return request(app)
    .patch('/api/users/me/password')
    .set('Authorization', `Bearer ${token}`)
    .send({ oldPassword: '123456', password: 'newpass123', confirmPassword: 'newpass123', ...body })
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

  const res = await changePassword(token)
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

test('改密码后,改密之前签发的 token 立刻失效', async () => {
  const token = await registerAndLogin()

  // 改密前:老 token 是好用的
  const before = await request(app).get('/api/todos').set('Authorization', `Bearer ${token}`)
  assert.strictEqual(before.status, 200)

  assert.strictEqual((await changePassword(token)).status, 200)

  // 改密后:同一个 token 立刻失效
  const after = await request(app).get('/api/todos').set('Authorization', `Bearer ${token}`)
  assert.strictEqual(after.status, 401)

  // 用新密码重新登录拿到的 token 正常可用(不会因为"刚刚改过密码"被误判)
  const relogin = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'newpass123' })
  assert.strictEqual(relogin.status, 200)
  const fresh = await request(app).get('/api/todos').set('Authorization', `Bearer ${relogin.body.token}`)
  assert.strictEqual(fresh.status, 200)
})

test('原密码不对返回 400,并且密码不变', async () => {
  const token = await registerAndLogin()

  const res = await changePassword(token, { oldPassword: 'wrong123' })
  assert.strictEqual(res.status, 400)
  assert.strictEqual(res.body.message, '原密码不正确')

  // 老密码照样能登,新密码不能登
  const oldLogin = await request(app).post('/api/auth/login').send({ username: 'alice', password: '123456' })
  assert.strictEqual(oldLogin.status, 200)
  const newLogin = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'newpass123' })
  assert.strictEqual(newLogin.status, 401)
})

test('库里存的是新密码的哈希,不是明文', async () => {
  const token = await registerAndLogin()
  await changePassword(token)

  const user = await prisma.user.findUnique({ where: { username: 'alice' } })
  assert.notStrictEqual(user.password, 'newpass123')
  assert.ok(user.password.startsWith('$2')) // bcryptjs 的哈希以 $2a$ / $2b$ 开头
  assert.ok(user.passwordChangedAt instanceof Date) // 改密时间已落库
})

test('两次密码不一致返回 400,并且不改库', async () => {
  const token = await registerAndLogin()

  const res = await changePassword(token, { confirmPassword: 'newpass124' })
  assert.strictEqual(res.status, 400)
  assert.deepStrictEqual(res.body.errors, [{ field: 'confirmPassword', message: '两次输入的密码不一致' }])

  // 校验没过就不该动数据库
  const stillOld = await request(app).post('/api/auth/login').send({ username: 'alice', password: '123456' })
  assert.strictEqual(stillOld.status, 200)
})

test('入参不合法返回 400:旧密码缺失、新密码不符合注册规则、确认密码缺失', async () => {
  const token = await registerAndLogin()

  // 原密码是必填
  assert.strictEqual((await changePassword(token, { oldPassword: undefined })).status, 400)

  // 新密码 6-32 位
  assert.strictEqual((await changePassword(token, { password: '12345', confirmPassword: '12345' })).status, 400)

  const tooLong = 'x'.repeat(33)
  assert.strictEqual((await changePassword(token, { password: tooLong, confirmPassword: tooLong })).status, 400)

  // 确认密码是必填
  assert.strictEqual((await changePassword(token, { confirmPassword: undefined })).status, 400)
})

test('未登录修改密码返回 401', async () => {
  const res = await request(app)
    .patch('/api/users/me/password')
    .send({ oldPassword: '123456', password: 'newpass123', confirmPassword: 'newpass123' })

  assert.strictEqual(res.status, 401)
})

test('只能改自己的密码,别人的账号不受影响', async () => {
  const aliceToken = await registerAndLogin('alice')
  await registerAndLogin('bob')

  await changePassword(aliceToken, { password: 'alice-new-1', confirmPassword: 'alice-new-1' })

  const bobLogin = await request(app).post('/api/auth/login').send({ username: 'bob', password: '123456' })
  assert.strictEqual(bobLogin.status, 200)
})
