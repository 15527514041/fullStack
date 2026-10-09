import { request } from './request'
import type { DailyPlan, DailyPlanListItem, DateRangeQuery, PagedResult, PlanPayload } from '@/types'

export function getPlans(params?: DateRangeQuery): Promise<PagedResult<DailyPlanListItem>> {
  return request<PagedResult<DailyPlanListItem>>({ url: '/plans', method: 'get', params })
}

export function getPlan(id: number): Promise<DailyPlan> {
  return request<DailyPlan>({ url: `/plans/${id}`, method: 'get' })
}

export function createPlan(data: PlanPayload): Promise<DailyPlan> {
  return request<DailyPlan>({ url: '/plans', method: 'post', data })
}

export function updatePlan(id: number, data: Partial<PlanPayload>): Promise<DailyPlan> {
  return request<DailyPlan>({ url: `/plans/${id}`, method: 'patch', data })
}

export function deletePlan(id: number): Promise<void> {
  return request<void>({ url: `/plans/${id}`, method: 'delete' })
}
