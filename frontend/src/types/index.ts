export type Role = 'USER' | 'ADMIN'
export type UserStatus = 'ACTIVE' | 'BANNED'

export interface User {
  id: number
  username: string
  /** 头像文件在上传记录里的 id(不是 URL;展示时用 useOssUrl 换地址) */
  avatarOssId?: string | null
  role?: Role
  status?: UserStatus
}

export interface LoginResult {
  token: string
  user: User
}

export interface UploadAvatarResult {
  avatarOssId: string
  /** 上传当次可直接用的地址(私有文件是签名地址,会过期) */
  avatarUrl: string
}

// ===== 标签 =====
/** 标签类型:与 Element Plus el-tag 的语义类型一一对应,直接透传不映射 */
export type TagType = 'primary' | 'success' | 'info' | 'warning' | 'danger'

export interface Tag {
  id: number
  name: string
  type: TagType
}

export interface TagItem extends Tag {
  createdAt?: string
  _count?: { todos: number }
}

// ===== TODO =====
export interface Todo {
  id: number
  title: string
  /** 备注:非必填 */
  remark?: string | null
  completed: boolean
  createdAt: string
  deletedAt?: string | null
  userId: number
  /** 附件:非必填,可多个,走关联表 */
  attachments?: TodoAttachment[]
  tags?: Tag[]
}

export interface TodoAttachment {
  ossId: string
  sortOrder: number
  key?: string
  originalName?: string | null
  mime?: string
  size?: number
  visibility?: 'PUBLIC' | 'PRIVATE'
}

export interface TodoQuery {
  page?: number
  pageSize?: number
  keyword?: string
  completed?: boolean
  tagId?: number
  deleted?: boolean
}

export interface TodoListResult {
  list: Todo[]
  total: number
  page: number
  pageSize: number
}

// ===== 通用:分页返回 =====
export interface PagedResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// ===== 个人成长:每日反思 =====
export interface ReflectionItem {
  id?: number
  /** 描述经过(必填) */
  experience: string
  /** 分析原因 */
  reason?: string | null
  /** 改进措施 */
  measure?: string | null
  sortOrder?: number
}

export interface DailyReflection {
  id: number
  /** YYYY-MM-DD(星期由前端按日期算) */
  date: string
  items: ReflectionItem[]
  createdAt?: string
  updatedAt?: string
}

export interface ReflectionPayload {
  date: string
  items: ReflectionItem[]
}

// ===== 个人成长:日程规划 =====
/** 明细类型:待办 / 计划完成 / 实际完成 / 随写备注 */
export type PlanItemKind = 'TODO' | 'PLANNED' | 'ACTUAL' | 'NOTE'

/** 规划明细项:待办与随写备注只有 name;计划/实际另有起止时间(用时由后端算) */
export interface PlanItem {
  id?: number
  /** 待办名称 / 事项 / 随写备注的内容 */
  name: string
  /** 待办是否已完成(勾上=完成,文字加删除线);其它三类恒为 false */
  completed?: boolean
  /** 计划/实际是否标记为重要(点亮小三角);待办与随写恒为 false */
  important?: boolean
  /** HH:mm,只有计划完成与实际完成有 */
  startTime?: string | null
  endTime?: string | null
  /** 用时(分钟),后端按起止时间算,只读 */
  durationMinutes?: number | null
  sortOrder?: number
}

export interface DailyPlan {
  id: number
  date: string
  todos: PlanItem[]
  planned: PlanItem[]
  actual: PlanItem[]
  notes: PlanItem[]
  createdAt?: string
  updatedAt?: string
}

/** 列表只回四类计数,不带明细 */
export interface DailyPlanListItem {
  id: number
  date: string
  todoCount: number
  plannedCount: number
  actualCount: number
  noteCount: number
  createdAt?: string
  updatedAt?: string
}

export interface PlanPayload {
  date: string
  todos?: Array<{ name: string; completed?: boolean }>
  planned?: Array<{ name: string; startTime: string; endTime: string; important?: boolean }>
  actual?: Array<{ name: string; startTime: string; endTime: string; important?: boolean }>
  notes?: Array<{ name: string }>
}

/** 两个成长模块列表共用的查询参数:tab 换算出的日期区间 + 分页 */
export interface DateRangeQuery {
  page?: number
  pageSize?: number
  from?: string
  to?: string
}

// ===== 管理端 =====
export interface AdminUser {
  id: number
  username: string
  role: Role
  status: UserStatus
  avatarOssId: string | null
  createdAt: string
  _count: { todos: number }
}

export interface AdminUserQuery {
  page?: number
  pageSize?: number
  keyword?: string
}

export interface UserListResult {
  list: AdminUser[]
  total: number
  page: number
  pageSize: number
}
