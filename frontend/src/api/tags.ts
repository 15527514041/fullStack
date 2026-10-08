import { request } from './request'
import type { TagItem, TagType } from '@/types'

export function getTags(): Promise<TagItem[]> {
  return request<TagItem[]>({ url: '/tags', method: 'get' })
}

export function createTag(payload: { name: string; type: TagType }): Promise<TagItem> {
  return request<TagItem>({ url: '/tags', method: 'post', data: payload })
}

export function updateTag(id: number, payload: { name?: string; type?: TagType }): Promise<TagItem> {
  return request<TagItem>({ url: `/tags/${id}`, method: 'patch', data: payload })
}

export function deleteTag(id: number): Promise<void> {
  return request<void>({ url: `/tags/${id}`, method: 'delete' })
}
