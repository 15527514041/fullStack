const { z } = require('zod')

// ====== 公共规则 ======

const username = z.string().trim().min(2, '用户至少 2 个字符').max(20, '用户最多 20 个字符')
const password = z.string().min(6, '密码至少 6 个字符').max(32, '密码最多 32 个字符')
const title = z.string().trim().min(1, '内容不能为空').max(100, '内容最多 100 个字符')
const tagName = z.string().trim().min(1, '标签名不能为空').max(20, '标签名最多 20 个字符')
// 标签类型:取值直接对应 Element Plus el-tag 的语义类型
const tagType = z.enum(['primary', 'success', 'info', 'warning', 'danger'], {
  errorMap: () => ({ message: '标签类型不合法' })
})
const remark = z.string().trim().max(500, '备注最多 500 个字符').nullable()
// 附件传的是上传记录 id(uuid)数组;传空数组表示清空附件
const attachmentOssIds = z.array(z.string().uuid('附件 ID 不合法')).max(9, '最多上传 9 个附件')
const idParams = z.object({
  id: z.coerce.number().int().positive('ID 必须是正整数')
})

// 分页参数(query 里全是字符串,用 coerce 转数字)
const pageParams = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10)
}

const boolQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')

// ====== auth ======

const authSchemas = {
  register: z.object({ username, password }),
  login: z.object({ username, password })
}

// ====== todo ======

const todoSchemas = {
  create: z.object({
    title,
    remark: remark.optional(),
    attachmentOssIds: attachmentOssIds.optional(),
    tagIds: z.array(z.number().int().positive()).optional()
  }),
  update: z
    .object({
      title: title.optional(),
      remark: remark.optional(),
      attachmentOssIds: attachmentOssIds.optional(),
      completed: z.boolean().optional(),
      tagIds: z.array(z.number().int().positive()).optional()
    })
    .refine((data) => Object.keys(data).length > 0, { message: '没有需要更新的字段' }),
  query: z.object({
    ...pageParams,
    keyword: z.string().trim().optional(),
    completed: boolQuery.optional(),
    tagId: z.coerce.number().int().positive().optional(),
    deleted: boolQuery.optional()
  })
}

// ====== tag ======

const tagSchemas = {
  create: z.object({
    name: tagName,
    // 不传则按 primary 落库(老客户端/老数据兼容)
    type: tagType.default('primary')
  }),
  update: z
    .object({
      name: tagName.optional(),
      type: tagType.optional()
    })
    .refine((data) => Object.keys(data).length > 0, { message: '没有需要更新的字段' })
}

// ====== 每日反思 / 日程规划 ======

// 只收日期(YYYY-MM-DD):库里是 DATE 类型,带上时分秒反而容易踩时区
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD')
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '时间格式应为 HH:mm')
// 星期不存库、也不进接口:它是 date 推导出来的,前端展示时自己算

// 列表页的 tab(今天 / 过去 7 天 / 过去 30 天 / 全部)由前端换算成 from/to
const dateRange = z
  .object({
    ...pageParams,
    from: dateOnly.optional(),
    to: dateOnly.optional()
  })
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    message: '开始日期不能晚于结束日期',
    path: ['to']
  })

const reflectionItem = z.object({
  experience: z.string().trim().min(1, '描述经过不能为空').max(500, '描述经过最多 500 字'),
  reason: z.string().trim().max(500, '分析原因最多 500 字').nullish(),
  measure: z.string().trim().max(500, '改进措施最多 500 字').nullish()
})
const reflectionItems = z.array(reflectionItem).min(1, '至少写一条反思').max(20, '每天最多 20 条反思')

const reflectionSchemas = {
  create: z.object({ date: dateOnly, items: reflectionItems }),
  update: z
    .object({
      date: dateOnly.optional(),
      items: reflectionItems.optional()
    })
    .refine((data) => Object.keys(data).length > 0, { message: '没有需要更新的字段' }),
  query: dateRange
}

// 时间范围:起止都必填,且结束必须晚于开始(HH:mm 字符串直接比大小即可)
const planScheduleItem = z
  .object({
    name: z.string().trim().min(1, '事项不能为空').max(100, '事项最多 100 个字符'),
    startTime: timeOfDay,
    endTime: timeOfDay,
    // 点亮小三角 = 这件事比较重要
    important: z.boolean().optional()
  })
  .refine((item) => item.endTime > item.startTime, {
    message: '结束时间必须晚于开始时间',
    path: ['endTime']
  })

const planTodoList = z
  .array(
    z.object({
      name: z.string().trim().min(1, '待办事项不能为空').max(100, '待办事项最多 100 个字符'),
      // 勾上表示完成
      completed: z.boolean().optional()
    })
  )
  .max(50, '待办事项最多 50 条')
const planScheduleList = z.array(planScheduleItem).max(50, '时间安排最多 50 条')
// 随写备注:只有内容,和待办/计划/实际同级
const planNoteList = z
  .array(z.object({ name: z.string().trim().min(1, '备注内容不能为空').max(500, '备注最多 500 个字符') }))
  .max(50, '备注最多 50 条')

const planSchemas = {
  create: z.object({
    date: dateOnly,
    todos: planTodoList.default([]),
    planned: planScheduleList.default([]),
    actual: planScheduleList.default([]),
    notes: planNoteList.default([])
  }),
  update: z
    .object({
      date: dateOnly.optional(),
      todos: planTodoList.optional(),
      planned: planScheduleList.optional(),
      actual: planScheduleList.optional(),
      notes: planNoteList.optional()
    })
    .refine((data) => Object.keys(data).length > 0, { message: '没有需要更新的字段' }),
  query: dateRange
}

// ====== admin ======

const adminSchemas = {
  updateRole: z.object({
    role: z.enum(['USER', 'ADMIN'])
  }),
  updateStatus: z.object({
    status: z.enum(['ACTIVE', 'BANNED'])
  }),
  listQuery: z.object({
    ...pageParams,
    keyword: z.string().trim().optional()
  })
}

module.exports = {
  authSchemas,
  todoSchemas,
  tagSchemas,
  reflectionSchemas,
  planSchemas,
  adminSchemas,
  idParams
}
