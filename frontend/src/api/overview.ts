import { request } from './request'
import type { OverviewData } from '@/types'

export function getOverview(date: string): Promise<OverviewData> {
  return request<OverviewData>({
    url: '/overview',
    method: 'get',
    params: { date }
  })
}
