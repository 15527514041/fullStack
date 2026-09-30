import { request } from './request'
import type { Todo, TodoListResult, TodoQuery } from '@/types'

export function getTodos(params?: TodoQuery): Promise<TodoListResult> {
  return request<TodoListResult>({ url: '/todos', method: 'get', params })
}

export interface CreateTodoPayload {
  title: string
  tagIds?: number[]
}

export function createTodo(data: CreateTodoPayload): Promise<Todo> {
  return request<Todo>({ url: '/todos', method: 'post', data })
}

export interface UpdateTodoPayload {
  title?: string
  completed?: boolean
  tagIds?: number[]
}

export function updateTodo(id: number, data: UpdateTodoPayload): Promise<Todo> {
  return request<Todo>({ url: `/todos/${id}`, method: 'patch', data })
}

export function deleteTodo(id: number): Promise<void> {
  return request<void>({ url: `/todos/${id}`, method: 'delete' })
}

export function restoreTodo(id: number): Promise<Todo> {
  return request<Todo>({ url: `/todos/${id}/restore`, method: 'post' })
}