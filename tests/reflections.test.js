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
  // 反思/规划对 User 都是 Cascade,删用户就会连带清掉本模块数据
  await prisma.user.deleteMany()
})

after(async () => {
  await prisma.$disconnect()
})

test('创建反思成功(多项按顺序),同一天重复创建返回 409', async () => {
  const token = await registerAndLogin()

  const payload = {
    date: '2026-10-09',
    items: [
      { experience: '早上开会迟到', reason: '出门太晚', measure: '提前 20 分钟出门' },
      { experience: '下午把方案写完了' }
    ]
  }

  const created = await request(app).post('/api/reflections').set('Authorization', `Bearer ${token}`).send(payload)

  assert.strictEqual(created.status, 201)
  assert.strictEqual(created.body.date, '2026-10-09')
  assert.strictEqual(created.body.items.length, 2)
  assert.deepStrictEqual(
    created.body.items.map((item) => item.sortOrder),
    [0, 1]
  )
  assert.strictEqual(created.body.items[0].experience, '早上开会迟到')
  // 没填的字段统一回 null,前端不用判 undefined
  assert.strictEqual(created.body.items[1].reason, null)
  assert.strictEqual(created.body.items[1].measure, null)

  const again = await request(app).post('/api/reflections').set('Authorization', `Bearer ${token}`).send(payload)
  assert.strictEqual(again.status, 409)
  assert.strictEqual(again.body.message, '该日期已有反思记录')
})

test('weekday 不存库:传了会被忽略', async () => {
  const token = await registerAndLogin()

  // 星期由 date 推导,前端展示时自己算;接口收到 weekday 也不落库
  const created = await request(app)
    .post('/api/reflections')
    .set('Authorization', `Bearer ${token}`)
    .send({ date: '2026-10-09', weekday: 5, items: [{ experience: '反思内容' }] })

  assert.strictEqual(created.status, 201)
  assert.ok(!('weekday' in created.body))
})

test('入参校验:空列表 / 描述经过为空 / 超过 20 条 / 日期格式错都返回 400', async () => {
  const token = await registerAndLogin()
  const post = (body) => request(app).post('/api/reflections').set('Authorization', `Bearer ${token}`).send(body)

  assert.strictEqual((await post({ date: '2026-10-09', items: [] })).status, 400)
  assert.strictEqual((await post({ date: '2026-10-09', items: [{ experience: '   ' }] })).status, 400)
  assert.strictEqual((await post({ date: '2026/10/09', items: [{ experience: 'x' }] })).status, 400)

  const tooMany = Array.from({ length: 21 }, (_, index) => ({ experience: `第 ${index + 1} 条` }))
  assert.strictEqual((await post({ date: '2026-10-09', items: tooMany })).status, 400)
})

test('更新反思:items 整体替换并重排序号,改日期撞已有返回 409', async () => {
  const token = await registerAndLogin()
  const auth = (req) => req.set('Authorization', `Bearer ${token}`)

  const first = await auth(request(app).post('/api/reflections')).send({
    date: '2026-10-08',
    items: [{ experience: '旧的一' }, { experience: '旧的二' }]
  })

  // 只改 items:旧的整条被换掉,序号按新数组重排
  const replaced = await auth(request(app).patch(`/api/reflections/${first.body.id}`)).send({
    items: [{ experience: '新的只有一条', measure: '下次注意' }]
  })
  assert.strictEqual(replaced.status, 200)
  assert.strictEqual(replaced.body.items.length, 1)
  assert.strictEqual(replaced.body.items[0].experience, '新的只有一条')
  assert.strictEqual(replaced.body.items[0].sortOrder, 0)
  assert.strictEqual(replaced.body.date, '2026-10-08')

  // 另一天已经有记录,把它改成同一天要 409
  const second = await auth(request(app).post('/api/reflections')).send({
    date: '2026-10-09',
    items: [{ experience: '另一天' }]
  })
  const conflict = await auth(request(app).patch(`/api/reflections/${second.body.id}`)).send({ date: '2026-10-08' })
  assert.strictEqual(conflict.status, 409)
  assert.strictEqual(conflict.body.message, '该日期已有反思记录')
})

test('列表按日期倒序,from/to 过滤与 total 正确', async () => {
  const token = await registerAndLogin()
  const auth = (req) => req.set('Authorization', `Bearer ${token}`)

  for (const date of ['2026-09-30', '2026-10-08', '2026-10-09']) {
    await auth(request(app).post('/api/reflections')).send({ date, items: [{ experience: `${date} 的反思` }] })
  }

  const all = await auth(request(app).get('/api/reflections'))
  assert.strictEqual(all.status, 200)
  assert.strictEqual(all.body.total, 3)
  assert.deepStrictEqual(
    all.body.list.map((item) => item.date),
    ['2026-10-09', '2026-10-08', '2026-09-30']
  )
  assert.strictEqual(all.body.list[0].items.length, 1)

  const range = await auth(request(app).get('/api/reflections?from=2026-10-01&to=2026-10-09'))
  assert.strictEqual(range.body.total, 2)
  assert.deepStrictEqual(
    range.body.list.map((item) => item.date),
    ['2026-10-09', '2026-10-08']
  )

  const singleDay = await auth(request(app).get('/api/reflections?from=2026-10-08&to=2026-10-08'))
  assert.strictEqual(singleDay.body.total, 1)

  const reversed = await auth(request(app).get('/api/reflections?from=2026-10-09&to=2026-10-01'))
  assert.strictEqual(reversed.status, 400)
})

test('别人的反思看不到也改不了(404),未登录返回 401', async () => {
  const aliceToken = await registerAndLogin('alice')
  const bobToken = await registerAndLogin('bob')

  const alice = await request(app)
    .post('/api/reflections')
    .set('Authorization', `Bearer ${aliceToken}`)
    .send({ date: '2026-10-09', items: [{ experience: 'alice 的反思' }] })
  const id = alice.body.id

  const bobGet = await request(app).get(`/api/reflections/${id}`).set('Authorization', `Bearer ${bobToken}`)
  assert.strictEqual(bobGet.status, 404)

  const bobPatch = await request(app)
    .patch(`/api/reflections/${id}`)
    .set('Authorization', `Bearer ${bobToken}`)
    .send({ items: [{ experience: '改别人的' }] })
  assert.strictEqual(bobPatch.status, 404)

  const bobDelete = await request(app).delete(`/api/reflections/${id}`).set('Authorization', `Bearer ${bobToken}`)
  assert.strictEqual(bobDelete.status, 404)

  // bob 的列表里看不到 alice 的记录
  const bobList = await request(app).get('/api/reflections').set('Authorization', `Bearer ${bobToken}`)
  assert.strictEqual(bobList.body.total, 0)

  const anonymous = await request(app).get('/api/reflections')
  assert.strictEqual(anonymous.status, 401)
})

test('删除反思返回 204,详情随后 404', async () => {
  const token = await registerAndLogin()

  const created = await request(app)
    .post('/api/reflections')
    .set('Authorization', `Bearer ${token}`)
    .send({ date: '2026-10-09', items: [{ experience: '待删除' }] })

  const removed = await request(app).delete(`/api/reflections/${created.body.id}`).set('Authorization', `Bearer ${token}`)
  assert.strictEqual(removed.status, 204)

  const detail = await request(app).get(`/api/reflections/${created.body.id}`).set('Authorization', `Bearer ${token}`)
  assert.strictEqual(detail.status, 404)
})
