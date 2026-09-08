const { z } = require('zod')

// ====== 公共规则 ======

const username = z.string().trim().min(2, '用户至少 2 个 字符').max(20, '用户最多 20 个 字符')
const password = z.string().min(6, '密码至少 6 个 字符').max(32, '密码最多 32 个 字符')
const idParams = z.object({
  id: z.coerce.number().int().positive('ID 必须是正整数')
})

// ====== auth ======
const authSchemas = {
  register: z.object({
    username,
    password
  }),
  login: z.object({
    username,
    password
  })
}

// ====== todo ======
const todoSchemas = {
  create: z.object({
    title: z.string().trim().min(1, '内容不能为空').max(100, '内容最多 100 个字符')
  }),
  update: z
    .object({
      title: z.string().trim().min(1, '内容不能为空').max(100, '内容最多 100 个字符').optional(),
      completed: z.boolean().optional()
    })
    .refine((data) => Object.keys(data).length > 0, { message: '没有需要更新的字段' }),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
    keyword: z.string().trim().optional(),
    completed: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional()
  })
}

module.exports = {
  authSchemas,
  todoSchemas,
  idParams
}