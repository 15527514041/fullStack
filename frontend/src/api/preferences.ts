import { request } from './request'
import type { LedgerPreferences, LedgerRecordSource } from '@/types'

export function getPreferences(): Promise<LedgerPreferences> {
  return request<LedgerPreferences>({
    url: '/users/me/preferences',
    method: 'get'
  })
}

export function updatePreferences(
  ledgerEntrySources: LedgerRecordSource[]
): Promise<LedgerPreferences> {
  return request<LedgerPreferences>({
    url: '/users/me/preferences',
    method: 'patch',
    data: { ledgerEntrySources }
  })
}
