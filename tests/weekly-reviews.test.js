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

function withAuth(token, req) {
  return req.set('Authorization', `Bearer ${token}`)
}

beforeEach(async () => {
  await prisma.user.deleteMany()
})

after(async () => {
  await prisma.$disconnect()
})

test('本周汇总:只统计周一到周日,待办完成率、时长和反思天数口径正确', async () => {
  const token = await registerAndLogin()
  const auth = (req) => withAuth(token, req)

  await auth(request(app).post('/api/plans')).send({
    date: '2026-10-18',
    todos: [{ name: '上周日,不应统计' }]
  })
  await auth(request(app).post('/api/plans')).send({
    date: '2026-10-19',
    todos: [
      { name: '写方案', completed: true },
      { name: '健身' }
    ],
    planned: [{ name: '写方案', startTime: '09:00', endTime: '10:30' }],
    actual: [{ name: '写方案', startTime: '09:15', endTime: '11:00' }]
  })
  await auth(request(app).post('/api/plans')).send({
    date: '2026-10-25',
    todos: [{ name: '整理房间' }]
  })
  await auth(request(app).post('/api/plans')).send({
    date: '2026-10-26',
    todos: [{ name: '下周一,不应统计' }]
  })

  await auth(request(app).post('/api/reflections')).send({
    date: '2026-10-19',
    items: [{ experience: '周一进入状态较快' }]
  })
  await auth(request(app).post('/api/reflections')).send({
    date: '2026-10-25',
    items: [{ experience: '周末完成整理' }, { experience: '补充一条' }]
  })

  const context = await auth(
    request(app).get('/api/weekly-reviews/context?weekStart=2026-10-19')
  )

  assert.strictEqual(context.status, 200)
  assert.strictEqual(context.body.weekStart, '2026-10-19')
  assert.strictEqual(context.body.weekEnd, '2026-10-25')
  assert.strictEqual(context.body.existingReviewId, null)
  assert.strictEqual(context.body.days.length, 7)
  assert.deepStrictEqual(
    context.body.days.map((day) => day.date),
    [
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25'
    ]
  )
  assert.deepStrictEqual(context.body.metrics, {
    planDays: 2,
    todoTotal: 3,
    todoCompleted: 1,
    todoCompletionRate: 0.3333,
    plannedMinutes: 90,
    actualMinutes: 105,
    reflectionDays: 2,
    reflectionCount: 3
  })

  const tuesday = await auth(
    request(app).get('/api/weekly-reviews/context?weekStart=2026-10-20')
  )
  assert.strictEqual(tuesday.status, 400)
})

test('草稿与一次性完成:默认草稿,完成时立即生成快照,同周重复返回 409', async () => {
  const token = await registerAndLogin()
  const auth = (req) => withAuth(token, req)

  const draft = await auth(request(app).post('/api/weekly-reviews')).send({
    weekStart: '2026-10-19',
    summary: '本周先写一半',
    wins: [{ content: '按时开始复盘' }]
  })

  assert.strictEqual(draft.status, 201)
  assert.strictEqual(draft.body.status, 'DRAFT')
  assert.strictEqual(draft.body.weekEnd, '2026-10-25')
  assert.strictEqual(draft.body.snapshotFrozen, false)
  assert.strictEqual(draft.body.wins.length, 1)

  const duplicate = await auth(request(app).post('/api/weekly-reviews')).send({
    weekStart: '2026-10-19',
    summary: '重复提交'
  })
  assert.strictEqual(duplicate.status, 409)
  assert.strictEqual(duplicate.body.message, '该周已有周复盘')

  const oneShot = await auth(request(app).post('/api/weekly-reviews')).send({
    weekStart: '2026-10-26',
    summary: '本周一次完成',
    wins: [{ content: '方案落地' }],
    challenges: [{ content: '临时会议较多' }],
    learnings: [{ content: '重要事项先留时间块' }],
    nextActions: [{ content: '下周先完成关键路径' }],
    status: 'COMPLETED'
  })

  assert.strictEqual(oneShot.status, 201)
  assert.strictEqual(oneShot.body.status, 'COMPLETED')
  assert.strictEqual(oneShot.body.snapshotFrozen, true)
  assert.ok(oneShot.body.completedAt)
  assert.deepStrictEqual(
    oneShot.body.nextActions.map((item) => item.content),
    ['下周先完成关键路径']
  )
})

test('入参校验:周一、必须有内容、完成必须填写总结、每个分区最多 10 条', async () => {
  const token = await registerAndLogin()
  const post = (body) => withAuth(token, request(app).post('/api/weekly-reviews')).send(body)

  assert.strictEqual(
    (await post({ weekStart: '2026-10-20', summary: '周二' })).status,
    400
  )
  assert.strictEqual(
    (await post({ weekStart: '2026-10-19' })).status,
    400
  )
  assert.strictEqual(
    (await post({
      weekStart: '2026-10-19',
      summary: '   ',
      status: 'COMPLETED',
      wins: [{ content: '有内容但缺总结' }]
    })).status,
    400
  )
  assert.strictEqual(
    (await post({
      weekStart: '2026-10-19',
      summary: '有总结',
      wins: Array.from({ length: 11 }, (_, index) => ({ content: `亮点 ${index + 1}` }))
    })).status,
    400
  )
})

test('完成复盘冻结快照:后续新增每日数据只影响实时 context,不改变已完成记录', async () => {
  const token = await registerAndLogin()
  const auth = (req) => withAuth(token, req)

  await auth(request(app).post('/api/plans')).send({
    date: '2026-10-19',
    todos: [{ name: '关键任务', completed: true }]
  })
  await auth(request(app).post('/api/reflections')).send({
    date: '2026-10-19',
    items: [{ experience: '完成关键任务' }]
  })

  const draft = await auth(request(app).post('/api/weekly-reviews')).send({
    weekStart: '2026-10-19',
    summary: '准备完成'
  })

  const completed = await auth(
    request(app).patch(`/api/weekly-reviews/${draft.body.id}`)
  ).send({ status: 'COMPLETED' })

  assert.strictEqual(completed.status, 200)
  assert.strictEqual(completed.body.status, 'COMPLETED')
  assert.strictEqual(completed.body.snapshotFrozen, true)
  assert.strictEqual(completed.body.metrics.planDays, 1)
  assert.strictEqual(completed.body.metrics.todoCompleted, 1)

  await auth(request(app).post('/api/plans')).send({
    date: '2026-10-20',
    todos: [{ name: '后来补记', completed: true }]
  })

  const detail = await auth(request(app).get(`/api/weekly-reviews/${draft.body.id}`))
  assert.strictEqual(detail.body.metrics.planDays, 1)
  assert.strictEqual(detail.body.metrics.todoTotal, 1)

  const context = await auth(
    request(app).get('/api/weekly-reviews/context?weekStart=2026-10-19')
  )
  assert.strictEqual(context.body.metrics.planDays, 2)
  assert.strictEqual(context.body.existingReviewId, draft.body.id)

  // 已完成后修正内容仍保持完成状态,快照不重算
  const corrected = await auth(
    request(app).patch(`/api/weekly-reviews/${draft.body.id}`)
  ).send({ summary: '修正后的本周总结' })
  assert.strictEqual(corrected.status, 200)
  assert.strictEqual(corrected.body.status, 'COMPLETED')
  assert.strictEqual(corrected.body.metrics.planDays, 1)
})

test('编辑草稿只替换传入分区,空数组可清空分区', async () => {
  const token = await registerAndLogin()
  const auth = (req) => withAuth(token, req)

  const created = await auth(request(app).post('/api/weekly-reviews')).send({
    weekStart: '2026-10-19',
    wins: [{ content: '亮点一' }, { content: '亮点二' }]
  })
  await new Promise((resolve) => setTimeout(resolve, 10))

  const patched = await auth(
    request(app).patch(`/api/weekly-reviews/${created.body.id}`)
  ).send({ challenges: [{ content: '只改卡点' }] })

  assert.strictEqual(patched.status, 200)
  assert.deepStrictEqual(
    patched.body.wins.map((item) => item.content),
    ['亮点一', '亮点二']
  )
  assert.deepStrictEqual(
    patched.body.challenges.map((item) => item.content),
    ['只改卡点']
  )
  assert.ok(new Date(patched.body.updatedAt) > new Date(created.body.updatedAt))
  assert.strictEqual(patched.body.challenges[0].sortOrder, 0)

  const cleared = await auth(
    request(app).patch(`/api/weekly-reviews/${created.body.id}`)
  ).send({ wins: [] })
  assert.strictEqual(cleared.status, 200)
  assert.deepStrictEqual(cleared.body.wins, [])
  assert.strictEqual(cleared.body.challenges.length, 1)
})

test('列表按周倒序,支持状态和日期过滤', async () => {
  const token = await registerAndLogin()
  const auth = (req) => withAuth(token, req)

  await auth(request(app).post('/api/weekly-reviews')).send({
    weekStart: '2026-10-05',
    summary: '更早的草稿'
  })
  await auth(request(app).post('/api/weekly-reviews')).send({
    weekStart: '2026-10-12',
    summary: '上周完成',
    status: 'COMPLETED'
  })
  await auth(request(app).post('/api/weekly-reviews')).send({
    weekStart: '2026-10-19',
    summary: '本周草稿'
  })

  const all = await auth(request(app).get('/api/weekly-reviews'))
  assert.strictEqual(all.status, 200)
  assert.strictEqual(all.body.total, 3)
  assert.deepStrictEqual(
    all.body.list.map((item) => item.weekStart),
    ['2026-10-19', '2026-10-12', '2026-10-05']
  )
  assert.ok(all.body.list[0].metrics)

  const completed = await auth(request(app).get('/api/weekly-reviews?status=COMPLETED'))
  assert.strictEqual(completed.body.total, 1)
  assert.strictEqual(completed.body.list[0].weekStart, '2026-10-12')

  const range = await auth(
    request(app).get('/api/weekly-reviews?from=2026-10-10&to=2026-10-19')
  )
  assert.strictEqual(range.body.total, 2)
})

test('别人的周复盘看不到也改不了(404),未登录返回 401', async () => {
  const aliceToken = await registerAndLogin('alice')
  const bobToken = await registerAndLogin('bob')

  const alice = await withAuth(
    aliceToken,
    request(app).post('/api/weekly-reviews')
  ).send({ weekStart: '2026-10-19', summary: 'Alice 的记录' })
  const id = alice.body.id

  assert.strictEqual(
    (await withAuth(bobToken, request(app).get(`/api/weekly-reviews/${id}`))).status,
    404
  )
  assert.strictEqual(
    (await withAuth(bobToken, request(app).patch(`/api/weekly-reviews/${id}`)).send({
      summary: '试图修改'
    })).status,
    404
  )
  assert.strictEqual(
    (await withAuth(bobToken, request(app).delete(`/api/weekly-reviews/${id}`))).status,
    404
  )

  const bobList = await withAuth(bobToken, request(app).get('/api/weekly-reviews'))
  assert.strictEqual(bobList.body.total, 0)
  assert.strictEqual((await request(app).get('/api/weekly-reviews')).status, 401)
})

test('删除周复盘返回 204,详情随后 404', async () => {
  const token = await registerAndLogin()
  const auth = (req) => withAuth(token, req)

  const created = await auth(request(app).post('/api/weekly-reviews')).send({
    weekStart: '2026-10-19',
    summary: '待删除'
  })
  const removed = await auth(request(app).delete(`/api/weekly-reviews/${created.body.id}`))
  assert.strictEqual(removed.status, 204)

  const detail = await auth(request(app).get(`/api/weekly-reviews/${created.body.id}`))
  assert.strictEqual(detail.status, 404)
})
