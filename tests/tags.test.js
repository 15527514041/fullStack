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

beforeEach(async () => {
  await prisma.todo.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.user.deleteMany()
})

after(async () => {
  await prisma.$disconnect()
})

test('创建标签成功,重复创建返回 409', async () => {
  const token = await registerAndLogin()

  const created = await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '工作' })
  assert.strictEqual(created.status, 201)
  assert.strictEqual(created.body.name, '工作')

  const again = await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '工作' })
  assert.strictEqual(again.status, 409)
})

test('创建 TODO 时关联标签,并按标签筛选', async () => {
  const token = await registerAndLogin()

  const tag = await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '紧急' })

  const todo = await request(app)
    .post('/api/todos')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: '带标签的 TODO', tagIds: [tag.body.id] })
  assert.strictEqual(todo.status, 201)
  assert.strictEqual(todo.body.tags.length, 1)

  await request(app).post('/api/todos').set('Authorization', `Bearer ${token}`).send({ title: '无标签' })

  const filtered = await request(app)
    .get(`/api/todos?tagId=${tag.body.id}`)
    .set('Authorization', `Bearer ${token}`)
  assert.strictEqual(filtered.status, 200)
  assert.strictEqual(filtered.body.total, 1)
  assert.strictEqual(filtered.body.list[0].title, '带标签的 TODO')
})

test('不能关联别人的标签', async () => {
  const aliceToken = await registerAndLogin('alice')
  const bobToken = await registerAndLogin('bob')

  const aliceTag = await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${aliceToken}`)
    .send({ name: 'alice 的标签' })

  const res = await request(app)
    .post('/api/todos')
    .set('Authorization', `Bearer ${bobToken}`)
    .send({ title: '偷用别人的标签', tagIds: [aliceTag.body.id] })
  assert.strictEqual(res.status, 400)
})

test('删除的 TODO 进回收站,恢复后回到列表', async () => {
  const token = await registerAndLogin()
  const created = await request(app)
    .post('/api/todos')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: '待删除' })
  const id = created.body.id

  await request(app).delete(`/api/todos/${id}`).set('Authorization', `Bearer ${token}`)

  const list = await request(app).get('/api/todos').set('Authorization', `Bearer ${token}`)
  assert.strictEqual(list.body.total, 0)

  const trash = await request(app).get('/api/todos?deleted=true').set('Authorization', `Bearer ${token}`)
  assert.strictEqual(trash.status, 200)
  assert.strictEqual(trash.body.total, 1)
  assert.ok(trash.body.list[0].deletedAt)

  await request(app).post(`/api/todos/${id}/restore`).set('Authorization', `Bearer ${token}`)
  const after = await request(app).get('/api/todos').set('Authorization', `Bearer ${token}`)
  assert.strictEqual(after.body.total, 1)
})

test('删除标签后,TODO 上的关联自动消失', async () => {
  const token = await registerAndLogin()

  const tag = await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '临时' })
  const todo = await request(app)
    .post('/api/todos')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'A', tagIds: [tag.body.id] })

  const del = await request(app)
    .delete(`/api/tags/${tag.body.id}`)
    .set('Authorization', `Bearer ${token}`)
  assert.strictEqual(del.status, 204)

  const detail = await request(app)
    .get(`/api/todos/${todo.body.id}`)
    .set('Authorization', `Bearer ${token}`)
  assert.strictEqual(detail.body.tags.length, 0)
})