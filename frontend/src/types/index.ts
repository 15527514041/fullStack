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