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
export interface Tag {
  id: number
  name: string
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
