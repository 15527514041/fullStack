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
  await prisma.user.deleteMany()
})

after(async () => {
  await prisma.$disconnect()
})

const payload = {
  date: '2026-10-09',
  todos: [{ name: '写周报' }, { name: '健身' }],
  planned: [
    { name: '写周报', startTime: '09:00', endTime: '10:30' },
    { name: '健身', startTime: '19:00', endTime: '20:00' }
  ],
  actual: [{ name: '写周报', startTime: '09:15', endTime: '11:00' }],
  notes: [{ name: '今天状态不错,晚上早点睡' }, { name: '明天记得带伞' }]
}

test('创建日程规划:四类分类正确,序号即数组顺序,用时自动算', async () => {
  const token = await registerAndLogin()

  const created = await request(app).post('/api/plans').set('Authorization', `Bearer ${token}`).send(payload)

  assert.strictEqual(created.status, 201)
  assert.strictEqual(created.body.date, '2026-10-09')

  assert.deepStrictEqual(
    created.body.todos.map((item) => item.name),
    ['写周报', '健身']
  )
  assert.deepStrictEqual(
    created.body.todos.map((item) => item.sortOrder),
    [0, 1]
  )
  // 待办没有时间/用时
  assert.strictEqual(created.body.todos[0].startTime, null)
  assert.strictEqual(created.body.todos[0].durationMinutes, null)

  assert.strictEqual(created.body.planned.length, 2)
  assert.strictEqual(created.body.planned[0].durationMinutes, 90)
  assert.strictEqual(created.body.planned[1].durationMinutes, 60)
  assert.strictEqual(created.body.planned[0].startTime, '09:00')
  assert.strictEqual(created.body.planned[0].endTime, '10:30')

  assert.strictEqual(created.body.actual.length, 1)
  assert.strictEqual(created.body.actual[0].durationMinutes, 105)

  // 随写备注:和另外三类同级,只有内容
  assert.deepStrictEqual(
    created.body.notes.map((item) => item.name),
    ['今天状态不错,晚上早点睡', '明天记得带伞']
  )
  assert.deepStrictEqual(
    created.body.notes.map((item) => item.sortOrder),
    [0, 1]
  )
  assert.strictEqual(created.body.notes[0].startTime, null)
  assert.strictEqual(created.body.notes[0].durationMinutes, null)
})

test('随写备注:可以不填、内容不能为空、能单独增删', async () => {
  const token = await registerAndLogin()
  const auth = (req) => req.set('Authorization', `Bearer ${token}`)

  // 不填随写备注 → 空数组
  const noNote = await auth(request(app).post('/api/plans')).send({
    date: '2026-10-07',
    todos: [{ name: '只填待办' }]
  })
  assert.strictEqual(noNote.status, 201)
  assert.deepStrictEqual(noNote.body.notes, [])

  // 备注内容空白 → 400
  const blankNote = await auth(request(app).patch(`/api/plans/${noNote.body.id}`)).send({ notes: [{ name: '   ' }] })
  assert.strictEqual(blankNote.status, 400)

  // 单独改随写备注,不动其它三类
  const withNote = await auth(request(app).patch(`/api/plans/${noNote.body.id}`)).send({ notes: [{ name: '周五效率不错' }] })
  assert.strictEqual(withNote.status, 200)
  assert.deepStrictEqual(
    withNote.body.notes.map((item) => item.name),
    ['周五效率不错']
  )
  assert.deepStrictEqual(
    withNote.body.todos.map((item) => item.name),
    ['只填待办']
  )

  // 列表里回随写备注的条数
  const list = await auth(request(app).get('/api/plans?from=2026-10-07&to=2026-10-07'))
  assert.strictEqual(list.body.total, 1)
  assert.strictEqual(list.body.list[0].noteCount, 1)
})

test('同日重复创建返回 409', async () => {
  const token = await registerAndLogin()

  await request(app).post('/api/plans').set('Authorization', `Bearer ${token}`).send(payload)
  const again = await request(app).post('/api/plans').set('Authorization', `Bearer ${token}`).send(payload)

  assert.strictEqual(again.status, 409)
  assert.strictEqual(again.body.message, '该日期已有日程规划')
})

test('时间校验:起止都必填、格式必须是 HH:mm、起止不能相同(跨零点合法)', async () => {
  const token = await registerAndLogin()
  const post = (planned) =>
    request(app)
      .post('/api/plans')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-10-09', planned })

  const noStart = await post([{ name: '缺开始', endTime: '10:00' }])
  assert.strictEqual(noStart.status, 400)

  const noEnd = await post([{ name: '缺结束', startTime: '09:00' }])
  assert.strictEqual(noEnd.status, 400)

  const badFormat = await post([{ name: '格式错', startTime: '9:00', endTime: '10:00' }])
  assert.strictEqual(badFormat.status, 400)

  const sameTime = await post([{ name: '时间相等', startTime: '09:00', endTime: '09:00' }])
  assert.strictEqual(sameTime.status, 400)
  assert.deepStrictEqual(sameTime.body.errors, [{ field: 'planned.0.endTime', message: '开始时间和结束时间不能相同' }])

  // 结束早于开始 = 跨零点,合法;用时 = 结束 - 开始 + 一天
  const cross = await request(app)
    .post('/api/plans')
    .set('Authorization', `Bearer ${token}`)
    .send({ date: '2026-10-04', planned: [{ name: '跨零点', startTime: '23:00', endTime: '06:00' }] })
  assert.strictEqual(cross.status, 201)
  assert.strictEqual(cross.body.planned[0].durationMinutes, 420)
})

test('单类最多 50 条', async () => {
  const token = await registerAndLogin()
  const auth = (req) => req.set('Authorization', `Bearer ${token}`)

  const tooMany = await auth(request(app).post('/api/plans')).send({
    date: '2026-10-09',
    todos: Array.from({ length: 51 }, (_, index) => ({ name: `待办 ${index + 1}` }))
  })
  assert.strictEqual(tooMany.status, 400)
})

test('列表只返回三类计数,按日期倒序;from/to 过滤生效', async () => {
  const token = await registerAndLogin()
  const auth = (req) => req.set('Authorization', `Bearer ${token}`)

  await auth(request(app).post('/api/plans')).send(payload)
  await auth(request(app).post('/api/plans')).send({
    date: '2026-09-20',
    todos: [{ name: '旧的一天' }],
    planned: [],
    actual: []
  })

  const all = await auth(request(app).get('/api/plans'))
  assert.strictEqual(all.status, 200)
  assert.strictEqual(all.body.total, 2)
  assert.deepStrictEqual(
    all.body.list.map((item) => item.date),
    ['2026-10-09', '2026-09-20']
  )

  const first = all.body.list[0]
  assert.deepStrictEqual(
    {
      todoCount: first.todoCount,
      plannedCount: first.plannedCount,
      actualCount: first.actualCount,
      noteCount: first.noteCount
    },
    { todoCount: 2, plannedCount: 2, actualCount: 1, noteCount: 2 }
  )
  // 列表不下发明细,只有计数
  assert.strictEqual(first.todos, undefined)
  assert.strictEqual(first.planned, undefined)

  const range = await auth(request(app).get('/api/plans?from=2026-10-01&to=2026-10-09'))
  assert.strictEqual(range.body.total, 1)
  assert.strictEqual(range.body.list[0].date, '2026-10-09')
})

test('待办可以勾选完成(completed),计划/实际/备注恒为 false', async () => {
  const token = await registerAndLogin()
  const auth = (req) => req.set('Authorization', `Bearer ${token}`)

  const created = await auth(request(app).post('/api/plans')).send({
    date: '2026-10-06',
    todos: [
      { name: '写周报', completed: true },
      { name: '健身' }
    ],
    planned: [{ name: '写周报', startTime: '09:00', endTime: '10:30' }],
    notes: [{ name: '随手记一句' }]
  })

  assert.strictEqual(created.status, 201)
  // 不传 completed 的待办默认未完成
  assert.deepStrictEqual(
    created.body.todos.map((item) => item.completed),
    [true, false]
  )
  // 其它三类没有完成概念
  assert.strictEqual(created.body.planned[0].completed, false)
  assert.strictEqual(created.body.notes[0].completed, false)

  // 勾选状态跟着整体替换走:取消第一条、勾上第二条
  const patched = await auth(request(app).patch(`/api/plans/${created.body.id}`)).send({
    todos: [
      { name: '写周报', completed: false },
      { name: '健身', completed: true }
    ]
  })
  assert.strictEqual(patched.status, 200)
  assert.deepStrictEqual(
    patched.body.todos.map((item) => item.completed),
    [false, true]
  )
})

test('计划/实际可以标记重要(important),待办与随写恒为 false', async () => {
  const token = await registerAndLogin()
  const auth = (req) => req.set('Authorization', `Bearer ${token}`)

  const created = await auth(request(app).post('/api/plans')).send({
    date: '2026-10-05',
    todos: [{ name: '写周报' }],
    planned: [
      { name: '写周报', startTime: '09:00', endTime: '10:30', important: true },
      { name: '健身', startTime: '19:00', endTime: '20:00' }
    ],
    actual: [{ name: '写周报', startTime: '09:15', endTime: '11:00' }],
    notes: [{ name: '随手记一句' }]
  })

  assert.strictEqual(created.status, 201)
  // 不传 important 的计划默认不是重要
  assert.deepStrictEqual(
    created.body.planned.map((item) => item.important),
    [true, false]
  )
  // 其它三类没有「重要」概念
  assert.strictEqual(created.body.actual[0].important, false)
  assert.strictEqual(created.body.todos[0].important, false)
  assert.strictEqual(created.body.notes[0].important, false)

  // 标记跟着整体替换走:取消第一条、点亮第二条
  const patched = await auth(request(app).patch(`/api/plans/${created.body.id}`)).send({
    planned: [
      { name: '写周报', startTime: '09:00', endTime: '10:30', important: false },
      { name: '健身', startTime: '19:00', endTime: '20:00', important: true }
    ]
  })
  assert.strictEqual(patched.status, 200)
  assert.deepStrictEqual(
    patched.body.planned.map((item) => item.important),
    [false, true]
  )
})

test('只传计划的某一类时只替换该类,其它两类保持不动', async () => {
  const token = await registerAndLogin()
  const auth = (req) => req.set('Authorization', `Bearer ${token}`)

  const created = await auth(request(app).post('/api/plans')).send(payload)

  const patched = await auth(request(app).patch(`/api/plans/${created.body.id}`)).send({
    planned: [{ name: '改成下午写周报', startTime: '14:00', endTime: '15:00' }]
  })

  assert.strictEqual(patched.status, 200)
  assert.deepStrictEqual(
    patched.body.planned.map((item) => item.name),
    ['改成下午写周报']
  )
  assert.strictEqual(patched.body.planned[0].durationMinutes, 60)
  // 待办与实际完成没被碰
  assert.deepStrictEqual(
    patched.body.todos.map((item) => item.name),
    ['写周报', '健身']
  )
  assert.strictEqual(patched.body.actual.length, 1)

  // 传空数组 = 清空该类
  const cleared = await auth(request(app).patch(`/api/plans/${created.body.id}`)).send({ actual: [] })
  assert.strictEqual(cleared.status, 200)
  assert.deepStrictEqual(cleared.body.actual, [])
  assert.strictEqual(cleared.body.todos.length, 2)
})

test('别人的日程规划看不到也改不了(404),未登录返回 401', async () => {
  const aliceToken = await registerAndLogin('alice')
  const bobToken = await registerAndLogin('bob')

  const alice = await request(app).post('/api/plans').set('Authorization', `Bearer ${aliceToken}`).send(payload)
  const id = alice.body.id

  assert.strictEqual((await request(app).get(`/api/plans/${id}`).set('Authorization', `Bearer ${bobToken}`)).status, 404)
  assert.strictEqual(
    (await request(app).patch(`/api/plans/${id}`).set('Authorization', `Bearer ${bobToken}`).send({ todos: [] })).status,
    404
  )
  assert.strictEqual((await request(app).delete(`/api/plans/${id}`).set('Authorization', `Bearer ${bobToken}`)).status, 404)

  const bobList = await request(app).get('/api/plans').set('Authorization', `Bearer ${bobToken}`)
  assert.strictEqual(bobList.body.total, 0)

  assert.strictEqual((await request(app).get('/api/plans')).status, 401)
})

test('删除日程规划返回 204,详情随后 404', async () => {
  const token = await registerAndLogin()

  const created = await request(app).post('/api/plans').set('Authorization', `Bearer ${token}`).send(payload)
  const removed = await request(app).delete(`/api/plans/${created.body.id}`).set('Authorization', `Bearer ${token}`)
  assert.strictEqual(removed.status, 204)

  const detail = await request(app).get(`/api/plans/${created.body.id}`).set('Authorization', `Bearer ${token}`)
  assert.strictEqual(detail.status, 404)
})
