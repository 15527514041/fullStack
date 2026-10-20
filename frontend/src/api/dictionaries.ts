import { request } from './request'
import type { DictionaryItem, DictionaryKind } from '@/types'

export function getDictionaries(kind: DictionaryKind): Promise<DictionaryItem[]> {
  return request<DictionaryItem[]>({ url: '/dictionaries', method: 'get', params: { kind } })
}

export interface CreateDictionaryPayload {
  kind: DictionaryKind
  name: string
}

export interface UpdateDictionaryPayload {
  name?: string
}

export function createDictionary(data: CreateDictionaryPayload): Promise<DictionaryItem> {
  return request<DictionaryItem>({ url: '/dictionaries', method: 'post', data })
}

export function updateDictionary(id: number, data: UpdateDictionaryPayload): Promise<DictionaryItem> {
  return request<DictionaryItem>({ url: `/dictionaries/${id}`, method: 'patch', data })
}

export function deleteDictionary(id: number): Promise<void> {
  return request<void>({ url: `/dictionaries/${id}`, method: 'delete' })
}
