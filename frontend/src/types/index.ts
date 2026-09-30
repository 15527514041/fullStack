export type Role = 'USER' | 'ADMIN'
export type UserStatus = 'ACTIVE' | 'BANNED'

export interface User {
  id: number
  username: string
  avatarUrl?: string | null
  role?: Role
  status?: UserStatus
}

export interface LoginResult {
  token: string
  user: User
}

export interface UploadAvatarResult {
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
  completed: boolean
  createdAt: string
  deletedAt?: string | null
  userId: number
  tags?: Tag[]
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
  avatarUrl: string | null
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