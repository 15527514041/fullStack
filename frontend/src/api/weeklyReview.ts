import { request } from './request'
import type {
  PagedResult,
  WeeklyReview,
  WeeklyReviewContext,
  WeeklyReviewListItem,
  WeeklyReviewPayload,
  WeeklyReviewQuery
} from '@/types'

export function getWeeklyReviews(params?: WeeklyReviewQuery): Promise<PagedResult<WeeklyReviewListItem>> {
  return request<PagedResult<WeeklyReviewListItem>>({ url: '/weekly-reviews', method: 'get', params })
}

export function getWeeklyReviewContext(weekStart: string): Promise<WeeklyReviewContext> {
  return request<WeeklyReviewContext>({
    url: '/weekly-reviews/context',
    method: 'get',
    params: { weekStart }
  })
}

export function getWeeklyReview(id: number): Promise<WeeklyReview> {
  return request<WeeklyReview>({ url: `/weekly-reviews/${id}`, method: 'get' })
}

export function createWeeklyReview(data: WeeklyReviewPayload): Promise<WeeklyReview> {
  return request<WeeklyReview>({ url: '/weekly-reviews', method: 'post', data })
}

export function updateWeeklyReview(
  id: number,
  data: Partial<WeeklyReviewPayload>
): Promise<WeeklyReview> {
  return request<WeeklyReview>({ url: `/weekly-reviews/${id}`, method: 'patch', data })
}

export function deleteWeeklyReview(id: number): Promise<void> {
  return request<void>({ url: `/weekly-reviews/${id}`, method: 'delete' })
}
