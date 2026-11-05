const test = require('node:test')
const assert = require('node:assert/strict')

const { normalizeOriginalName } = require('../utils/filename')

test('修复 multipart 中文文件名被按 Latin-1 解码的问题', () => {
  const original = '20251230-143655 - 设计稿.png'
  const mojibake = Buffer.from(original, 'utf8').toString('latin1')

  assert.equal(normalizeOriginalName(mojibake), original)
})

test('修复经过两层错误解码的历史文件名', () => {
  const original = '需求文档.pdf'
  const once = Buffer.from(original, 'utf8').toString('latin1')
  const twice = Buffer.from(once, 'utf8').toString('latin1')

  assert.equal(normalizeOriginalName(twice), original)
})

test('正常中文和合法 Latin-1 文件名保持不变', () => {
  assert.equal(normalizeOriginalName('设计稿.png'), '设计稿.png')
  assert.equal(normalizeOriginalName('café.pdf'), 'café.pdf')
})
