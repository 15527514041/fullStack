const { test } = require('node:test')
const assert = require('node:assert')

const {
  todoSchemas,
  planSchemas,
  reflectionSchemas
} = require('../validators')

function assertInvalidDate(result, field) {
  assert.strictEqual(result.success, false)
  assert.deepStrictEqual(result.error.issues, [
    {
      code: 'custom',
      message: '日期不合法',
      path: [field]
    }
  ])
}

test('待办截止日期拒绝不存在的日历日期', () => {
  const invalidDate = '2026-02-31'

  assertInvalidDate(todoSchemas.create.safeParse({ title: '非法日期', dueDate: invalidDate }), 'dueDate')
  assertInvalidDate(todoSchemas.update.safeParse({ dueDate: invalidDate }), 'dueDate')
  assertInvalidDate(todoSchemas.query.safeParse({ dueFrom: invalidDate }), 'dueFrom')
  assertInvalidDate(todoSchemas.query.safeParse({ dueTo: invalidDate }), 'dueTo')
  assertInvalidDate(todoSchemas.exportQuery.safeParse({ dueFrom: invalidDate }), 'dueFrom')
})

test('每日规划和每日反思拒绝不存在的日历日期', () => {
  const invalidDate = '2026-02-31'

  assertInvalidDate(planSchemas.create.safeParse({ date: invalidDate }), 'date')
  assertInvalidDate(planSchemas.update.safeParse({ date: invalidDate }), 'date')
  assertInvalidDate(planSchemas.query.safeParse({ from: invalidDate }), 'from')
  assertInvalidDate(planSchemas.exportQuery.safeParse({ to: invalidDate }), 'to')

  assertInvalidDate(
    reflectionSchemas.create.safeParse({
      date: invalidDate,
      items: [{ experience: '内容' }]
    }),
    'date'
  )
  assertInvalidDate(reflectionSchemas.update.safeParse({ date: invalidDate }), 'date')
  assertInvalidDate(reflectionSchemas.query.safeParse({ from: invalidDate }), 'from')
  assertInvalidDate(reflectionSchemas.exportQuery.safeParse({ to: invalidDate }), 'to')
})

test('有效闰日和月末日期仍然通过', () => {
  assert.strictEqual(
    todoSchemas.create.safeParse({ title: '闰日', dueDate: '2024-02-29' }).success,
    true
  )
  assert.strictEqual(planSchemas.create.safeParse({ date: '2024-02-29' }).success, true)
  assert.strictEqual(
    reflectionSchemas.create.safeParse({
      date: '2024-02-29',
      items: [{ experience: '有效日期' }]
    }).success,
    true
  )
  assert.strictEqual(
    todoSchemas.create.safeParse({ title: '月末', dueDate: '2026-04-30' }).success,
    true
  )
})
