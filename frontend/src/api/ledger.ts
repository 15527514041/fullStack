import { request } from './request'
import type { AccountKind, LedgerAccount } from '@/types'

/** 不传 enabled 返回全部账户(停用的也在,前端自己决定怎么展示) */
export function getAccounts(params?: { enabled?: boolean }): Promise<LedgerAccount[]> {
  return request<LedgerAccount[]>({ url: '/ledger/accounts', method: 'get', params })
}

export interface CreateAccountPayload {
  name: string
  kind: AccountKind
  /** 单位:分;不传按 0 建 */
  balanceCents?: number
  note?: string | null
  sortOrder?: number
}

/** 备注/排序这类元信息的普通编辑:余额不在这个接口里 */
export interface UpdateAccountPayload {
  name?: string
  kind?: AccountKind
  note?: string | null
  enabled?: boolean
  sortOrder?: number
}

export function createAccount(data: CreateAccountPayload): Promise<LedgerAccount> {
  return request<LedgerAccount>({ url: '/ledger/accounts', method: 'post', data })
}

export function updateAccount(id: number, data: UpdateAccountPayload): Promise<LedgerAccount> {
  return request<LedgerAccount>({ url: `/ledger/accounts/${id}`, method: 'patch', data })
}

/** 改余额是单独的「对账」动作:会刷新 balanceUpdatedAt */
export function updateAccountBalance(id: number, balanceCents: number): Promise<LedgerAccount> {
  return request<LedgerAccount>({ url: `/ledger/accounts/${id}/balance`, method: 'patch', data: { balanceCents } })
}

export function deleteAccount(id: number): Promise<void> {
  return request<void>({ url: `/ledger/accounts/${id}`, method: 'delete' })
}
