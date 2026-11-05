const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')

const app = require('../app')
const { buildCsv, contentDisposition } = require('../utils/csv')
const { todoSchemas, planSchemas } = require('../validators')
const { createExport, EXPORTERS } = require('../modules/export/export.service')

test('CSV 保留多行文本、转义引号并阻止公式注入', () => {
  const csv = buildCsv(
    [
      { key: 'title', header: '标题' },
      { key: 'note', header: '备注' }
    ],
    [
      { title: '=1+1', note: '含"引号"\n第二行' },
      { title: '+SUM(A1:A2)', note: '普通内容' }
    ]
  )

  assert.match(csv, /^"标题","备注"\r\n/)
  assert.match(csv, /"'=1\+1","含""引号""\n第二行"/)
  assert.match(csv, /"'\+SUM\(A1:A2\)","普通内容"/)
})

test('下载文件名同时兼容 ASCII 和 UTF-8', () => {
  const header = contentDisposition('每日规划-20261105-143000.csv')

  assert.match(header, /^attachment;/)
  assert.match(header, /filename="____-20261105-143000\.csv"/)
  assert.match(header, /filename\*=UTF-8''/)
})

test('导出参数使用独立校验并支持语言、时区', () => {
  const todo = todoSchemas.exportQuery.parse({
    keyword: '学习',
    completed: 'false',
    locale: 'en_US',
    timeZone: 'Asia/Shanghai'
  })
  assert.equal(todo.completed, false)
  assert.equal(todo.locale, 'en_US')

  const plan = planSchemas.exportQuery.parse({
    from: '2026-11-01',
    to: '2026-11-05'
  })
  assert.equal(plan.locale, 'zh_CN')
  assert.equal(plan.from, '2026-11-01')
})

test('导出参数拒绝无效时区和反向日期范围', () => {
  assert.equal(
    planSchemas.exportQuery.safeParse({
      from: '2026-11-05',
      to: '2026-11-01'
    }).success,
    false
  )
  assert.equal(
    todoSchemas.exportQuery.safeParse({
      timeZone: 'Not/A_Real_Time_Zone'
    }).success,
    false
  )
})

test('后端导出服务直接整理完整规划并返回文件名、行数', async () => {
  const original = EXPORTERS.plans.list
  EXPORTERS.plans.list = async () => [{
    date: '2026-11-05',
    todos: [{ name: '完成导出', completed: true }],
    planned: [{
      name: '实现接口',
      startTime: '09:00',
      endTime: '10:30',
      important: true,
      durationMinutes: 90
    }],
    actual: [],
    notes: [{ name: '只请求一次' }],
    createdAt: new Date('2026-11-05T01:00:00.000Z'),
    updatedAt: new Date('2026-11-05T02:00:00.000Z')
  }]

  try {
    const result = await createExport('plans', 1, {
      locale: 'zh_CN',
      timeZone: 'Asia/Shanghai'
    })

    assert.equal(result.empty, false)
    assert.equal(result.count, 1)
    assert.match(result.fileName, /^每日规划-\d{8}-\d{6}\.csv$/)
    assert.match(result.body, /\[x\] 完成导出/)
    assert.match(result.body, /\[重要\] 09:00-10:30 实现接口 \(90 分钟\)/)
  } finally {
    EXPORTERS.plans.list = original
  }
})

test('导出路由已挂载并要求登录', async () => {
  await request(app)
    .get('/api/exports/todos')
    .expect(401)
})
