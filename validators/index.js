const { z } = require('zod')

// ====== 公共规则 ======

const username = z.string().trim().min(2, '用户至少 2 个字符').max(20, '用户最多 20 个字符')
const password = z.string().min(6, '密码至少 6 个字符').max(32, '密码最多 32 个字符')
const title = z.string().trim().min(1, '内容不能为空').max(100, '内容最多 100 个字符')
const tagName = z.string().trim().min(1, '标签名不能为空').max(20, '标签名最多 20 个字符')
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
  create: z.object({ name: tagName })
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
  adminSchemas,
  idParams
}
