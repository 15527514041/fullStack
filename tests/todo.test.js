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
  await prisma.upload.deleteMany()
  await prisma.tag.deleteMany()
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

test('创建 TODO 可带备注与多个附件(附件必须是自己上传的)', async () => {
  const aliceToken = await registerAndLogin('alice')
  const bobToken = await registerAndLogin('bob')

  const alice = await prisma.user.findUnique({ where: { username: 'alice' } })
  const bob = await prisma.user.findUnique({ where: { username: 'bob' } })

  // 直接建上传记录:测试不依赖 OSS(不走真实上传)
  const aliceUpload1 = await prisma.upload.create({
    data: {
      key: 'private/todos/test-alice-1.png',
      originalName: '设计稿.png',
      visibility: 'PRIVATE',
      mime: 'image/png',
      size: 123,
      uploaderId: alice.id
    }
  })
  const aliceUpload2 = await prisma.upload.create({
    data: {
      key: 'private/todos/test-alice-2.pdf',
      originalName: '需求文档.pdf',
      visibility: 'PRIVATE',
      mime: 'application/pdf',
      size: 456,
      uploaderId: alice.id
    }
  })
  const bobUpload = await prisma.upload.create({
    data: { key: 'private/todos/test-bob.png', visibility: 'PRIVATE', mime: 'image/png', size: 789, uploaderId: bob.id }
  })

  // 1) 带备注 + 两个自己的附件 → 201,按 sortOrder 顺序返回
  const created = await request(app)
    .post('/api/todos')
    .set('Authorization', `Bearer ${aliceToken}`)
    .send({ title: '带附件', remark: '记得买牛奶', attachmentOssIds: [aliceUpload1.id, aliceUpload2.id] })

  assert.strictEqual(created.status, 201)
  assert.strictEqual(created.body.remark, '记得买牛奶')
  assert.deepStrictEqual(
    created.body.attachments.map((item) => item.ossId),
    [aliceUpload1.id, aliceUpload2.id]
  )
  assert.deepStrictEqual(
    created.body.attachments.map((item) => item.sortOrder),
    [0, 1]
  )
  assert.strictEqual(created.body.attachments[0].originalName, '设计稿.png')
  assert.strictEqual(created.body.attachments[1].mime, 'application/pdf')

  // 列表接口同样返回附件
  const list = await request(app).get('/api/todos').set('Authorization', `Bearer ${aliceToken}`)
  assert.strictEqual(list.body.list[0].attachments.length, 2)

  // 2) 挂别人的附件 → 400
  const denied = await request(app)
    .post('/api/todos')
    .set('Authorization', `Bearer ${aliceToken}`)
    .send({ title: '偷附件', attachmentOssIds: [bobUpload.id] })
  assert.strictEqual(denied.status, 400)
  assert.strictEqual(denied.body.message, '附件不存在')

  // 3) 更新备注 + 把附件替换成 1 个
  const updated = await request(app)
    .patch(`/api/todos/${created.body.id}`)
    .set('Authorization', `Bearer ${aliceToken}`)
    .send({ remark: '改一下', attachmentOssIds: [aliceUpload2.id] })

  assert.strictEqual(updated.status, 200)
  assert.strictEqual(updated.body.remark, '改一下')
  assert.deepStrictEqual(
    updated.body.attachments.map((item) => item.ossId),
    [aliceUpload2.id]
  )
  assert.strictEqual(updated.body.attachments[0].sortOrder, 0)

  // 4) 传空数组 → 清空附件
  const cleared = await request(app)
    .patch(`/api/todos/${created.body.id}`)
    .set('Authorization', `Bearer ${aliceToken}`)
    .send({ attachmentOssIds: [] })
  assert.strictEqual(cleared.status, 200)
  assert.deepStrictEqual(cleared.body.attachments, [])

  // 5) 备注传空字符串 → 存 null
  const remarkCleared = await request(app)
    .patch(`/api/todos/${created.body.id}`)
    .set('Authorization', `Bearer ${aliceToken}`)
    .send({ remark: '   ' })
  assert.strictEqual(remarkCleared.status, 200)
  assert.strictEqual(remarkCleared.body.remark, null)
})
