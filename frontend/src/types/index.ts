export type Role = 'USER' | 'ADMIN'

export interface User {
  id: number
  username: string
  avatarUrl?: string | null
  role?: Role
}

export interface LoginResult {
  token: string
  user: User
}

export interface UploadAvatarResult {
  avatarUrl: string
}

export interface AdminUser {
  id: number
  username: string
  role: Role
  avatarUrl: string | null
  createdAt: string
  _count: {
    todos: number
  }
}

export interface Todo {
  id: number
  title: string
  completed: boolean
  createdAt: string
  userId: number
}

export interface TodoQuery {
  page?: number
  pageSize?: number
  keyword?: string
  completed?: boolean
}

export interface TodoListResult {
  list: Todo[]
  total: number
  page: number
  pageSize: number
}