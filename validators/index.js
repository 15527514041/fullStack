const { z } = require('zod')

// ====== 公共规则 ======

const username = z.string().trim().min(2, '用户至少 2 个字符').max(20, '用户最多 20 个字符')
const password = z.string().min(6, '密码至少 6 个字符').max(32, '密码最多 32 个字符')
const title = z.string().trim().min(1, '内容不能为空').max(100, '内容最多 100 个字符')
const tagName = z.string().trim().min(1, '标签名不能为空').max(20, '标签名最多 20 个字符')
const dictionaryColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, '颜色必须是 #RRGGBB 格式')
const dictionarySortOrder = z.number().int().min(0).max(9999)
// 标签域:标签是通用能力,用域区分这套标签给哪个模块用(任务 / 记账)
const tagScope = z.enum(['TODO', 'ACCOUNTING'], {
  errorMap: () => ({ message: '标签域不合法' })
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
  register: z.object({
    username,
    password,
    // 预设标签/字典按注册时界面语言写入;老客户端不传时默认中文
    locale: z.enum(['zh_CN', 'en_US']).optional()
  }),
  login: z.object({ username, password })
}

// ====== user(个人中心) ======

// 修改密码:前端表单是「原密码 + 新密码 + 确认密码」,新密码两次必须一致
// (前端已经比过一次,服务端再兜一层:接口是公开契约,不能只靠调用方守规矩)
const userSchemas = {
  changePassword: z
    .object({
      // 原密码只做非空校验:长度规则对新密码才有意义,老密码不该再被卡
      oldPassword: z.string().min(1, '请输入原密码'),
      password,
      confirmPassword: z.string().min(6, '确认密码至少 6 个字符').max(32, '确认密码最多 32 个字符')
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: '两次输入的密码不一致',
      path: ['confirmPassword']
    })
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
    deleted: boolQuery.optional(),
    // 时间范围:待办的 createdAt 是时间戳,前端按用户本地时区算好 UTC 时刻再传,所以收 ISO 字符串
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional()
  }).refine((data) => !data.from || !data.to || data.from <= data.to, {
    message: '开始时间不能晚于结束时间',
    path: ['to']
  })
}

// ====== tag ======

const tagSchemas = {
  create: z.object({
    name: tagName,
    color: dictionaryColor.default('#0bb06d'),
    enabled: z.boolean().optional(),
    sortOrder: dictionarySortOrder.optional(),
    // 不传则落到任务域:老前端只会传 name/type,加分类前建的标签本来就都是任务的
    scope: tagScope.default('TODO')
  }),
  update: z
    .object({
      name: tagName.optional(),
      color: dictionaryColor.optional(),
      enabled: z.boolean().optional(),
      sortOrder: dictionarySortOrder.optional(),
      // 域是标签的身份,建完不能改。这里显式接住 scope 再拦掉,
      // 是为了回一句能看懂的中文报错,而不是让 zod 的 strict 回英文的 Unrecognized key
      scope: tagScope.optional()
    })
    .strict()
    .refine((data) => data.scope === undefined, { message: '标签域不支持修改', path: ['scope'] })
    .refine((data) => Object.keys(data).length > 0, { message: '没有需要更新的字段' }),
  query: z.object({
    // 不传则返回所有域的标签;管理页按分类切换时传具体域
    scope: tagScope.optional()
  })
}

// ====== 每日反思 / 每日规划 ======

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
  // 结束时间小于开始时间 = 跨零点(23:00~06:00),合法;只有起止相同才拦
  .refine((item) => item.endTime !== item.startTime, {
    message: '开始时间和结束时间不能相同',
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

// ====== 记账:资产账户 ======

const accountName = z.string().trim().min(1, '账户名不能为空').max(20, '账户名最多 20 个字符')
const accountKindId = z.number().int().positive('账户类型不合法')
// 金额一律用「分」的整数:上限 ±999 万元(信用卡欠款是负数)
const balanceCents = z
  .number()
  .int('金额必须是整数(单位:分)')
  .min(-999999999, '金额超出范围')
  .max(999999999, '金额超出范围')
const accountNote = z.string().trim().max(50, '备注最多 50 个字符').nullable()

const accountSchemas = {
  create: z.object({
    name: accountName,
    kindId: accountKindId,
    // 不传按 0 建:先把账户建起来,余额回头再补也是常见用法
    balanceCents: balanceCents.default(0),
    note: accountNote.optional(),
    sortOrder: z.number().int().min(0).max(9999).optional()
  }),
  update: z
    .object({
      name: accountName.optional(),
      kindId: accountKindId.optional(),
      note: accountNote.optional(),
      // 启用开关:停用的账户不再出现在录入选择里
      enabled: z.boolean().optional(),
      sortOrder: z.number().int().min(0).max(9999).optional()
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, { message: '没有需要更新的字段' }),
  // 余额单独一个入口:这是「对账」动作,要刷新 balanceUpdatedAt
  balance: z.object({ balanceCents }),
  query: z.object({
    // 不传返回全部;true/false 只看启用/停用的
    enabled: boolQuery.optional()
  })
}

// ====== 记账:周期账单 ======

const ledgerSource = z.enum(['manual_day', 'manual_week', 'manual_month'], {
  errorMap: () => ({ message: '记账周期不合法' })
})
const ledgerItemType = z.enum(['INCOME', 'EXPENSE'], {
  errorMap: () => ({ message: '收支类型不合法' })
})

const ledgerCategoryId = z.number().int().positive('分类不合法')

// 账单金额不允许为 0;上限与账户余额保持一致
const ledgerAmountCents = z
  .number()
  .int('金额必须是整数(单位:分)')
  .min(1, '金额必须大于 0')
  .max(999999999, '金额超出范围')

// DATE 字段只收 YYYY-MM-DD,并检查是真实存在的日期(挡住 2026-02-31 这种)
const ledgerPeriodStart = dateOnly.refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}, '日期不合法')

// periodStart 的粒度必须和 source 对上:
// 周账单必须是周一,月账单必须是 1 号;日账单任意日期都可以
function checkLedgerPeriod(source, periodStart, ctx) {
  const date = new Date(`${periodStart}T00:00:00.000Z`)
  if (source === 'manual_week' && date.getUTCDay() !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '周账单的起始日期必须是周一',
      path: ['periodStart']
    })
  }
  if (source === 'manual_month' && date.getUTCDate() !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '月账单的起始日期必须是当月 1 日',
      path: ['periodStart']
    })
  }
}

const ledgerItem = z.object({
  type: ledgerItemType,
  categoryId: ledgerCategoryId,
  accountId: z.number().int().positive('账户 ID 不合法'),
  amountCents: ledgerAmountCents,
  tagIds: z.array(z.number().int().positive()).optional(),
  remark: z.string().trim().max(500, '备注最多 500 个字符').nullable().optional()
})

const ledgerItems = z.array(ledgerItem).min(1, '至少需要一条账单明细').max(50, '最多 50 条账单明细')

const recordSchemas = {
  create: z
    .object({
      source: ledgerSource,
      periodStart: ledgerPeriodStart,
      items: ledgerItems
    })
    .superRefine((data, ctx) => checkLedgerPeriod(data.source, data.periodStart, ctx)),
  // 编辑时周期和来源不可修改,只允许整体替换明细
  update: z.object({ items: ledgerItems }).strict(),
  query: z
    .object({
      source: ledgerSource,
      ...pageParams,
      from: ledgerPeriodStart.optional(),
      to: ledgerPeriodStart.optional()
    })
    .refine((data) => !data.from || !data.to || data.from <= data.to, {
      message: '开始日期不能晚于结束日期',
      path: ['to']
    })
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

// ====== 用户字典(账户类型 / 收支分类) ======

const dictionaryKind = z.enum(['ACCOUNT_KIND', 'INCOME_CATEGORY', 'EXPENSE_CATEGORY'], {
  errorMap: () => ({ message: '字典类型不合法' })
})
const dictionaryName = z.string().trim().min(1, '名称不能为空').max(20, '名称最多 20 个字符')

const dictionarySchemas = {
  query: z.object({ kind: dictionaryKind }),
  create: z.object({
    kind: dictionaryKind,
    name: dictionaryName,
    color: dictionaryColor.default('#0bb06d'),
    enabled: z.boolean().optional(),
    sortOrder: dictionarySortOrder.optional()
  }),
  update: z
    .object({
      name: dictionaryName.optional(),
      color: dictionaryColor.optional(),
      enabled: z.boolean().optional(),
      sortOrder: dictionarySortOrder.optional()
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, { message: '没有需要更新的字段' })
}

module.exports = {
  authSchemas,
  userSchemas,
  todoSchemas,
  tagSchemas,
  reflectionSchemas,
  planSchemas,
  accountSchemas,
  recordSchemas,
  dictionarySchemas,
  adminSchemas,
  idParams
}
