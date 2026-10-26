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

/** 修改密码:原密码用来验身份,新密码两次输入必须一致(服务端会再验一遍) */
export interface ChangePasswordPayload {
  oldPassword: string
  password: string
  confirmPassword: string
}

// ===== 标签 =====
/** 标签类型:与 Element Plus el-tag 的语义类型一一对应,直接透传不映射 */
/**
 * 标签分类(后端字段叫 scope):标签是通用能力,用分类区分这套标签给哪个模块用
 * TODO = 任务域,ACCOUNTING = 记账域
 */
export type TagScope = 'TODO' | 'ACCOUNTING'

export interface Tag {
  id: number
  name: string
  color: string
  enabled: boolean
  sortOrder: number
  /** TODO 接口里带出来的标签不带这个字段(那里的标签必然是任务域的) */
  scope?: TagScope
}

export interface TagItem extends Tag {
  createdAt?: string
  _count?: { todos: number; ledgerItems?: number }
}

// ===== TODO =====
export interface Todo {
  id: number
  title: string
  /** 截止日期,格式 YYYY-MM-DD;未设置为 null */
  dueDate?: string | null
  /** 描述:非必填,保存 Markdown 原文 */
  description?: string | null
  completed: boolean
  createdAt: string
  /** 最近一次更新时间 */
  updatedAt: string
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
  dueFrom?: string
  dueTo?: string
  dueDateMissing?: boolean
  tagId?: number
  deleted?: boolean
  /** 创建时间范围(ISO,按本地时区算好的起止时刻) */
  from?: string
  to?: string
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

/** 反思年度视图:只返回有反思的日期 */
export interface ReflectionCalendarDay {
  id: number
  date: string
  itemCount: number
}

export interface ReflectionCalendarSummary {
  reflectionDays: number
  reflectionTotal: number
}

export interface ReflectionCalendarResult {
  year: number
  summary: ReflectionCalendarSummary
  days: ReflectionCalendarDay[]
}

// ===== 个人成长:每日规划 =====
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

/** 年度视图:只返回有规划的日期,前端据此补全全年格子 */
export interface PlanCalendarDay {
  id: number
  date: string
  todoCount: number
}

export interface PlanCalendarSummary {
  planDays: number
  todoTotal: number
}

export interface PlanCalendarResult {
  year: number
  summary: PlanCalendarSummary
  days: PlanCalendarDay[]
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

// ===== 个人成长:周复盘 =====
export type WeeklyReviewStatus = 'DRAFT' | 'COMPLETED'

export interface WeeklyReviewItem {
  id?: number
  content: string
  sortOrder?: number
}

export interface WeeklyReviewMetrics {
  planDays: number
  todoTotal: number
  todoCompleted: number
  /** 没有待办时为 null,前端显示 -- */
  todoCompletionRate: number | null
  plannedMinutes: number
  actualMinutes: number
  reflectionDays: number
  reflectionCount: number
}

export interface WeeklyReviewDay {
  date: string
  planId: number | null
  reflectionId: number | null
  todoTotal: number
  todoCompleted: number
  plannedMinutes: number
  actualMinutes: number
  reflectionCount: number
  reflectionSummary: string | null
}

export interface WeeklyReviewContext {
  weekStart: string
  weekEnd: string
  metrics: WeeklyReviewMetrics
  days: WeeklyReviewDay[]
  /** 新建页用它判断该周是否已有记录 */
  existingReviewId?: number | null
}

export interface WeeklyReviewListItem {
  id: number
  weekStart: string
  weekEnd: string
  summary: string | null
  status: WeeklyReviewStatus
  completedAt: string | null
  createdAt?: string
  updatedAt?: string
  metrics: WeeklyReviewMetrics
  snapshotFrozen: boolean
}

export interface WeeklyReview extends WeeklyReviewListItem {
  wins: WeeklyReviewItem[]
  challenges: WeeklyReviewItem[]
  learnings: WeeklyReviewItem[]
  nextActions: WeeklyReviewItem[]
  days: WeeklyReviewDay[]
}

export type WeeklyReviewItemInput = Pick<WeeklyReviewItem, 'content'>

export interface WeeklyReviewPayload {
  weekStart: string
  summary?: string | null
  wins?: WeeklyReviewItemInput[]
  challenges?: WeeklyReviewItemInput[]
  learnings?: WeeklyReviewItemInput[]
  nextActions?: WeeklyReviewItemInput[]
  status?: WeeklyReviewStatus
}

export interface WeeklyReviewQuery {
  page?: number
  pageSize?: number
  status?: WeeklyReviewStatus
  from?: string
  to?: string
}

// ===== 记账:资产账户 =====
export type DictionaryKind = 'ACCOUNT_KIND' | 'INCOME_CATEGORY' | 'EXPENSE_CATEGORY'

/** 字典项在账户/账单接口里的精简引用 */
export interface DictionaryRef {
  id: number
  name: string
  color: string
}

export interface DictionaryItem extends DictionaryRef {
  kind: DictionaryKind
  code?: string | null
  enabled: boolean
  sortOrder: number
  createdAt?: string
  _count?: {
    accounts: number
    ledgerItems: number
  }
}

/**
 * 资产账户
 * 余额是「手动维护的快照」:账单流水不联动修改它,所以字段名特意叫 balanceUpdatedAt(上次对账时间)
 */
export interface LedgerAccount {
  id: number
  name: string
  kindId: number
  kind: DictionaryRef
  note?: string | null
  /** 单位:分;信用卡欠款是负数 */
  balanceCents: number
  balanceUpdatedAt: string
  /** 启用开关:只是标记,余额照算 */
  enabled: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

// ===== 记账:周期账单 =====
/** 日 / 周 / 月三种账本来源 */
export type LedgerRecordSource = 'manual_day' | 'manual_week' | 'manual_month'

export interface LedgerPreferences {
  ledgerEntrySources: LedgerRecordSource[]
}
export type LedgerItemType = 'INCOME' | 'EXPENSE'

/** 明细里带出的账户快照字段 */
export interface LedgerItemAccount {
  id: number
  name: string
  kind: DictionaryRef
  enabled: boolean
}

export interface LedgerItem {
  id?: number
  type: LedgerItemType
  amountCents: number
  categoryId: number
  category: DictionaryRef
  accountId: number
  remark?: string | null
  sortOrder?: number
  account?: LedgerItemAccount
  tags?: Tag[]
  createdAt?: string
  updatedAt?: string
}

/** 列表摘要:一条周期记录只回合计和条目数,不回明细 */
export interface LedgerRecordSummary {
  id: number
  source: LedgerRecordSource
  periodStart: string
  periodEnd: string
  incomeCents: number
  expenseCents: number
  netCents: number
  itemCount: number
  createdAt: string
  updatedAt: string
}

export interface LedgerRecordDetail extends LedgerRecordSummary {
  items: LedgerItem[]
}

export interface LedgerRecordQuery {
  source: LedgerRecordSource
  page?: number
  pageSize?: number
  from?: string
  to?: string
}

export interface LedgerItemPayload {
  type: LedgerItemType
  categoryId: number
  accountId: number
  amountCents: number
  tagIds?: number[]
  remark?: string | null
}

export interface CreateLedgerRecordPayload {
  source: LedgerRecordSource
  periodStart: string
  items: LedgerItemPayload[]
}

export interface UpdateLedgerRecordPayload {
  items: LedgerItemPayload[]
}

// ===== 管理端 =====
export interface AdminUser {
  id: number
  username: string
  role: Role
  status: UserStatus
  avatarOssId: string | null
  createdAt: string
  /** 最近一次登录成功的时间(从没登录过是 null) */
  lastLoginAt: string | null
  _count: { todos: number; reflections: number; plans: number }
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
