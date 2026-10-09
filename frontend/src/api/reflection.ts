import { request } from './request'
import type { DailyReflection, DateRangeQuery, PagedResult, ReflectionPayload } from '@/types'

export function getReflections(params?: DateRangeQuery): Promise<PagedResult<DailyReflection>> {
  return request<PagedResult<DailyReflection>>({ url: '/reflections', method: 'get', params })
}

export function getReflection(id: number): Promise<DailyReflection> {
  return request<DailyReflection>({ url: `/reflections/${id}`, method: 'get' })
}

export function createReflection(data: ReflectionPayload): Promise<DailyReflection> {
  return request<DailyReflection>({ url: '/reflections', method: 'post', data })
}

export function updateReflection(id: number, data: Partial<ReflectionPayload>): Promise<DailyReflection> {
  return request<DailyReflection>({ url: `/reflections/${id}`, method: 'patch', data })
}

export function deleteReflection(id: number): Promise<void> {
  return request<void>({ url: `/reflections/${id}`, method: 'delete' })
}
