import type { RouteLocationRaw } from 'vue-router'
import type { DictionaryKind, TagScope } from '@/types'

export type DictionaryTab = TagScope | DictionaryKind

/** 选择框末尾“新增”选项的保留值，不会被写入业务表单 */
export const DICTIONARY_CREATE_VALUE = '__dictionary_create__'

export function dictionaryTabRoute(tab: DictionaryTab): RouteLocationRaw {
  return { name: 'tags', query: { tab } }
}
