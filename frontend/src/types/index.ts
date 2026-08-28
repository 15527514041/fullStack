export interface User {
  id: number
  username: string
}

export interface LoginResult {
  token: string
  user: User
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