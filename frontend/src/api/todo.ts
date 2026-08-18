import { request } from './request'
import type { Todo } from '@/types'

export function getTodos(): Promise<Todo[]> {
  return request<Todo[]>({ url: '/todos', method: 'get' })
}

export function createTodo(title: string): Promise<Todo> {
  return request<Todo>({ url: '/todos', method: 'post', data: { title } })
}

export interface UpdateTodoPayload {
  title?: string
  completed?: boolean
}

export function updateTodo(id: number, data: UpdateTodoPayload): Promise<Todo> {
  return request<Todo>({ url: `/todos/${id}`, method: 'patch', data })
}

export function deleteTodo(id: number): Promise<void> {
  return request<void>({ url: `/todos/${id}`, method: 'delete' })
}