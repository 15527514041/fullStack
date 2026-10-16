import { request } from './request'
import type { TagItem, TagScope, TagType } from '@/types'

/** 不传 scope 返回所有分类的标签;按分类取的时候传具体值 */
export function getTags(params?: { scope?: TagScope }): Promise<TagItem[]> {
  return request<TagItem[]>({ url: '/tags', method: 'get', params })
}

export interface CreateTagPayload {
  name: string
  type: TagType
  scope: TagScope
}

/** 分类是标签的身份,建完不能改,所以更新只动名字和颜色 */
export interface UpdateTagPayload {
  name?: string
  type?: TagType
}

export function createTag(data: CreateTagPayload): Promise<TagItem> {
  return request<TagItem>({ url: '/tags', method: 'post', data })
}

export function updateTag(id: number, data: UpdateTagPayload): Promise<TagItem> {
  return request<TagItem>({ url: `/tags/${id}`, method: 'patch', data })
}

export function deleteTag(id: number): Promise<void> {
  return request<void>({ url: `/tags/${id}`, method: 'delete' })
}
