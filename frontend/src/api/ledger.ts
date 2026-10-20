import { request } from './request'
import type {
  CreateLedgerRecordPayload,
  LedgerAccount,
  LedgerRecordDetail,
  LedgerRecordQuery,
  LedgerRecordSummary,
  PagedResult,
  UpdateLedgerRecordPayload
} from '@/types'

/** 不传 enabled 返回全部账户(停用的也在,前端自己决定怎么展示) */
export function getAccounts(params?: { enabled?: boolean }): Promise<LedgerAccount[]> {
  return request<LedgerAccount[]>({ url: '/ledger/accounts', method: 'get', params })
}

export interface CreateAccountPayload {
  name: string
  kindId: number
  /** 单位:分;不传按 0 建 */
  balanceCents?: number
  note?: string | null
  sortOrder?: number
}

/** 备注/排序这类元信息的普通编辑:余额不在这个接口里 */
export interface UpdateAccountPayload {
  name?: string
  kindId?: number
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

// ===== 周期账单 =====

/** 列表按周期记录分页,只回合计和条目数 */
export function getLedgerRecords(params: LedgerRecordQuery): Promise<PagedResult<LedgerRecordSummary>> {
  return request<PagedResult<LedgerRecordSummary>>({ url: '/ledger/records', method: 'get', params })
}

export function getLedgerRecord(id: number): Promise<LedgerRecordDetail> {
  return request<LedgerRecordDetail>({ url: `/ledger/records/${id}`, method: 'get' })
}

export function createLedgerRecord(data: CreateLedgerRecordPayload): Promise<LedgerRecordDetail> {
  return request<LedgerRecordDetail>({ url: '/ledger/records', method: 'post', data })
}

/** 编辑时周期和来源固定,只整体替换 items */
export function updateLedgerRecord(id: number, data: UpdateLedgerRecordPayload): Promise<LedgerRecordDetail> {
  return request<LedgerRecordDetail>({ url: `/ledger/records/${id}`, method: 'patch', data })
}

export function deleteLedgerRecord(id: number): Promise<void> {
  return request<void>({ url: `/ledger/records/${id}`, method: 'delete' })
}
