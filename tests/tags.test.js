const { test, beforeEach, after } = require('node:test')
const assert = require('node:assert')
const request = require('supertest')
const { PrismaClient } = require('@prisma/client')

const app = require('../app')
const prisma = new PrismaClient()

async function registerAndLogin(username = 'alice') {
  await request(app).post('/api/auth/register').send({ username, password: '123456' })
  const res = await request(app).post('/api/auth/login').send({ username, password: '123456' })
  // 这些用例关注增删改查,先清掉注册自带的预设标签
  const user = await prisma.user.findUnique({ where: { username } })
  await prisma.tag.deleteMany({ where: { userId: user.id } })
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

test('创建标签成功(默认任务域),重复创建返回 409', async () => {
  const token = await registerAndLogin()

  const created = await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '工作' })
  assert.strictEqual(created.status, 201)
  assert.strictEqual(created.body.name, '工作')
  // 不传 scope 的老请求一律落到任务域
  assert.strictEqual(created.body.scope, 'TODO')
  assert.strictEqual(created.body.color, '#0bb06d')
  assert.strictEqual(created.body.enabled, true)
  assert.strictEqual(created.body.sortOrder, 0)

  const again = await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '工作' })
  assert.strictEqual(again.status, 409)
})

test('新用户注册后自带任务标签和记账标签', async () => {
  await request(app).post('/api/auth/register').send({ username: 'preset-user', password: '123456' })
  const login = await request(app).post('/api/auth/login').send({ username: 'preset-user', password: '123456' })
  const token = login.body.token

  const todo = await request(app).get('/api/tags?scope=TODO').set('Authorization', `Bearer ${token}`)
  const ledger = await request(app).get('/api/tags?scope=ACCOUNTING').set('Authorization', `Bearer ${token}`)

  assert.deepStrictEqual(todo.body.map((item) => item.name), ['工作', '学习', '生活', '健康', '紧急'])
  assert.deepStrictEqual(ledger.body.map((item) => item.name), ['固定支出', '可报销', '大额', '待核对'])
  assert.deepStrictEqual(todo.body.map((item) => item.sortOrder), [0, 1, 2, 3, 4])
  assert.ok(todo.body.every((item) => item.enabled && /^#[0-9a-f]{6}$/i.test(item.color)))
})

test('不同域可以有同名标签,只有同域才算重名', async () => {
  const token = await registerAndLogin()

  const todoTag = await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '报销', scope: 'TODO' })
  assert.strictEqual(todoTag.status, 201)

  // 同名但不同域:允许
  const ledgerTag = await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '报销', scope: 'ACCOUNTING' })
  assert.strictEqual(ledgerTag.status, 201)
  assert.strictEqual(ledgerTag.body.scope, 'ACCOUNTING')

  // 同域同名:409
  const dup = await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '报销', scope: 'ACCOUNTING' })
  assert.strictEqual(dup.status, 409)
})

test('按域查标签:?scope=TODO 只看得到任务域的标签', async () => {
  const token = await registerAndLogin()

  await request(app).post('/api/tags').set('Authorization', `Bearer ${token}`).send({ name: '任务标签' })
  await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '记账标签', scope: 'ACCOUNTING' })

  const all = await request(app).get('/api/tags').set('Authorization', `Bearer ${token}`)
  assert.strictEqual(all.body.length, 2)

  const todoOnly = await request(app).get('/api/tags?scope=TODO').set('Authorization', `Bearer ${token}`)
  assert.strictEqual(todoOnly.body.length, 1)
  assert.strictEqual(todoOnly.body[0].name, '任务标签')

  const ledgerOnly = await request(app).get('/api/tags?scope=ACCOUNTING').set('Authorization', `Bearer ${token}`)
  assert.strictEqual(ledgerOnly.body.length, 1)
  assert.strictEqual(ledgerOnly.body[0].name, '记账标签')

  // 域取值不合法直接 400
  const bad = await request(app).get('/api/tags?scope=TODO2').set('Authorization', `Bearer ${token}`)
  assert.strictEqual(bad.status, 400)
})

test('标签按序号升序返回', async () => {
  const token = await registerAndLogin()
  await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '后排', sortOrder: 5 })
  await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '前排', sortOrder: 1 })

  const list = await request(app).get('/api/tags?scope=TODO').set('Authorization', `Bearer ${token}`)
  assert.deepStrictEqual(list.body.map((item) => item.name), ['前排', '后排'])
})

test('TODO 挂不上记账域的标签', async () => {
  const token = await registerAndLogin()

  const ledgerTag = await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '餐饮', scope: 'ACCOUNTING' })

  const res = await request(app)
    .post('/api/todos')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: '跨域挂标签', tagIds: [ledgerTag.body.id] })
  assert.strictEqual(res.status, 400)
})

test('标签域不支持修改', async () => {
  const token = await registerAndLogin()

  const tag = await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '生活', scope: 'ACCOUNTING' })

  const changeScope = await request(app)
    .patch(`/api/tags/${tag.body.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ scope: 'TODO' })
  assert.strictEqual(changeScope.status, 400)

  // 未知字段也一并拦掉(不是被静默忽略)
  const unknownField = await request(app)
    .patch(`/api/tags/${tag.body.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ icon: 'STAR' })
  assert.strictEqual(unknownField.status, 400)

  // 改名/改颜色/改序号照常,域保持不变
  const renamed = await request(app)
    .patch(`/api/tags/${tag.body.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '生活开销', color: '#9254de', sortOrder: 3 })
  assert.strictEqual(renamed.status, 200)
  assert.strictEqual(renamed.body.name, '生活开销')
  assert.strictEqual(renamed.body.color, '#9254de')
  assert.strictEqual(renamed.body.sortOrder, 3)
  assert.strictEqual(renamed.body.scope, 'ACCOUNTING')
})

test('域内改名撞名报 409,别的域有同名不算撞', async () => {
  const token = await registerAndLogin()

  const work = await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '工作', scope: 'TODO' })
  await request(app).post('/api/tags').set('Authorization', `Bearer ${token}`).send({ name: '生活', scope: 'TODO' })

  // 任务域把「工作」改成「生活」:任务域里已经有一个「生活」→ 409
  const conflict = await request(app)
    .patch(`/api/tags/${work.body.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '生活' })
  assert.strictEqual(conflict.status, 409)

  // 记账域里也叫「生活」,把它改成「工作」:记账域里没有「工作」→ 允许(任务域有没有不影响)
  const ledgerLife = await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '生活', scope: 'ACCOUNTING' })
  const ok = await request(app)
    .patch(`/api/tags/${ledgerLife.body.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '工作' })
  assert.strictEqual(ok.status, 200)
  assert.strictEqual(ok.body.scope, 'ACCOUNTING')
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

test('有关联的标签不能删除,可以改为禁用', async () => {
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
  assert.strictEqual(del.status, 409)
  assert.match(del.body.message, /已关联 1 条数据/)

  const disabled = await request(app)
    .patch(`/api/tags/${tag.body.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ enabled: false })
  assert.strictEqual(disabled.status, 200)
  assert.strictEqual(disabled.body.enabled, false)

  const detail = await request(app)
    .get(`/api/todos/${todo.body.id}`)
    .set('Authorization', `Bearer ${token}`)
  assert.strictEqual(detail.body.tags.length, 1)
})

test('没有关联的标签可以正常删除', async () => {
  const token = await registerAndLogin()
  const tag = await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '临时' })

  const removed = await request(app)
    .delete(`/api/tags/${tag.body.id}`)
    .set('Authorization', `Bearer ${token}`)
  assert.strictEqual(removed.status, 204)
})
