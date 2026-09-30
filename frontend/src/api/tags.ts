import { request } from './request'
import type { TagItem } from '@/types'

export function getTags(): Promise<TagItem[]> {
  return request<TagItem[]>({ url: '/tags', method: 'get' })
}

export function createTag(name: string): Promise<TagItem> {
  return request<TagItem>({ url: '/tags', method: 'post', data: { name } })
}

export function deleteTag(id: number): Promise<void> {
  return request<void>({ url: `/tags/${id}`, method: 'delete' })
}