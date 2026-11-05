const AppError = require('../../errors/AppError')
const todoService = require('../todo/todo.service')
const planService = require('../plan/plan.service')
const reflectionService = require('../reflection/reflection.service')
const { buildCsv } = require('../../utils/csv')

const COPY = {
  zh_CN: {
    todoTitle: '计划清单',
    todoStatus: '状态',
    todoDone: '已完成',
    todoPending: '未完成',
    todoTitleColumn: '标题',
    dueDate: '截止日期',
    tags: '标签',
    description: '描述',
    attachments: '附件',
    createdAt: '创建时间',
    updatedAt: '更新时间',
    planTitle: '每日规划',
    planDate: '日期',
    planTodos: '待办事项',
    planned: '计划完成',
    actual: '实际完成',
    notes: '随写备注',
    important: '重要',
    minutes: '分钟',
    reflectionTitle: '每日反思',
    experience: '描述经过',
    reason: '分析原因',
    measure: '改进措施',
    itemCount: '条目数'
  },
  en_US: {
    todoTitle: 'Checklist',
    todoStatus: 'Status',
    todoDone: 'Completed',
    todoPending: 'Pending',
    todoTitleColumn: 'Title',
    dueDate: 'Due date',
    tags: 'Tags',
    description: 'Description',
    attachments: 'Attachments',
    createdAt: 'Created at',
    updatedAt: 'Updated at',
    planTitle: 'Daily Plan',
    planDate: 'Date',
    planTodos: 'Todos',
    planned: 'Planned',
    actual: 'Actual',
    notes: 'Notes',
    important: 'Important',
    minutes: 'min',
    reflectionTitle: 'Daily Reflection',
    experience: 'What happened',
    reason: 'Why',
    measure: 'What to improve',
    itemCount: 'Item count'
  }
}

function formatDateTime(value, locale, timeZone) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(locale === 'zh_CN' ? 'zh-CN' : 'en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date)
}

function fileTimestamp(timeZone, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)
  const value = (type) => parts.find((part) => part.type === type)?.value || '00'
  return `${value('year')}${value('month')}${value('day')}-${value('hour')}${value('minute')}${value('second')}`
}

function numberedLines(items, line) {
  return items.map((item, index) => `${index + 1}. ${line(item, index)}`).join('\n')
}

function planTodoLines(items) {
  return numberedLines(items, (item) => `${item.completed ? '[✓]' : '[ ]'} ${item.name}`)
}

function planScheduleLines(items, copy) {
  return numberedLines(items, (item) => {
    const important = item.important ? `[${copy.important}] ` : ''
    const time = `${item.startTime || ''}-${item.endTime || ''}`
    const duration =
      item.durationMinutes === null || item.durationMinutes === undefined
        ? ''
        : ` (${item.durationMinutes} ${copy.minutes})`
    return `${important}${time} ${item.name}${duration}`
  })
}

function reflectionLines(items, field) {
  return numberedLines(
    items.filter((item) => Boolean(item[field])),
    (item) => item[field]
  )
}

const EXPORTERS = {
  todos: {
    title: (copy) => copy.todoTitle,
    list: todoService.listTodosForExport,
    columns: (copy) => [
      { key: 'title', header: copy.todoTitleColumn },
      { key: 'status', header: copy.todoStatus },
      { key: 'dueDate', header: copy.dueDate },
      { key: 'tags', header: copy.tags },
      { key: 'description', header: copy.description },
      { key: 'attachments', header: copy.attachments },
      { key: 'createdAt', header: copy.createdAt },
      { key: 'updatedAt', header: copy.updatedAt }
    ],
    rows: (todo, copy, context) => [{
      title: todo.title,
      status: todo.completed ? copy.todoDone : copy.todoPending,
      dueDate: todo.dueDate || '',
      tags: (todo.tags || []).map((tag) => tag.name).join(', '),
      description: todo.description || '',
      attachments: (todo.attachments || [])
        .map((attachment) => attachment.originalName || attachment.key || attachment.ossId)
        .join('\n'),
      createdAt: formatDateTime(todo.createdAt, context.locale, context.timeZone),
      updatedAt: formatDateTime(todo.updatedAt, context.locale, context.timeZone)
    }]
  },
  plans: {
    title: (copy) => copy.planTitle,
    list: planService.listPlansForExport,
    columns: (copy) => [
      { key: 'date', header: copy.planDate },
      { key: 'todos', header: copy.planTodos },
      { key: 'planned', header: copy.planned },
      { key: 'actual', header: copy.actual },
      { key: 'notes', header: copy.notes },
      { key: 'createdAt', header: copy.createdAt },
      { key: 'updatedAt', header: copy.updatedAt }
    ],
    rows: (plan, copy, context) => [{
      date: plan.date,
      todos: planTodoLines(plan.todos),
      planned: planScheduleLines(plan.planned, copy),
      actual: planScheduleLines(plan.actual, copy),
      notes: numberedLines(plan.notes, (note) => note.name),
      createdAt: formatDateTime(plan.createdAt, context.locale, context.timeZone),
      updatedAt: formatDateTime(plan.updatedAt, context.locale, context.timeZone)
    }]
  },
  reflections: {
    title: (copy) => copy.reflectionTitle,
    list: reflectionService.listReflectionsForExport,
    columns: (copy) => [
      { key: 'date', header: copy.planDate },
      { key: 'experience', header: copy.experience },
      { key: 'reason', header: copy.reason },
      { key: 'measure', header: copy.measure },
      { key: 'itemCount', header: copy.itemCount },
      { key: 'createdAt', header: copy.createdAt },
      { key: 'updatedAt', header: copy.updatedAt }
    ],
    rows: (reflection, copy, context) => [{
      date: reflection.date,
      experience: reflectionLines(reflection.items, 'experience'),
      reason: reflectionLines(reflection.items, 'reason'),
      measure: reflectionLines(reflection.items, 'measure'),
      itemCount: reflection.items.length,
      createdAt: formatDateTime(reflection.createdAt, context.locale, context.timeZone),
      updatedAt: formatDateTime(reflection.updatedAt, context.locale, context.timeZone)
    }]
  }
}

async function createExport(resource, userId, query) {
  const exporter = EXPORTERS[resource]
  if (!exporter) {
    throw new AppError('不支持的导出类型', 400)
  }

  const locale = query.locale === 'en_US' ? 'en_US' : 'zh_CN'
  const copy = COPY[locale]
  const timeZone = query.timeZone || 'Asia/Shanghai'
  const context = { locale, timeZone }
  const records = await exporter.list(userId, query)
  const rows = records.flatMap((record) => exporter.rows(record, copy, context))

  if (!rows.length) {
    return { empty: true, count: 0 }
  }

  return {
    empty: false,
    body: `\uFEFF${buildCsv(exporter.columns(copy), rows)}`,
    count: rows.length,
    fileName: `${exporter.title(copy)}-${fileTimestamp(timeZone)}.csv`
  }
}

module.exports = {
  createExport,
  EXPORTERS
}
