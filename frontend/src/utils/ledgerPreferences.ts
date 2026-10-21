import type { LedgerRecordSource } from '@/types'

export interface LedgerDimensionTip {
  visible: boolean
  content: string
}

export const LEDGER_DIMENSION_TIP = Symbol('ledger-dimension-tip')

export const DEFAULT_LEDGER_ENTRY_SOURCES: LedgerRecordSource[] = [
  'manual_day',
  'manual_week',
  'manual_month'
]

export function normalizeLedgerEntrySources(
  values: readonly LedgerRecordSource[]
): LedgerRecordSource[] {
  return DEFAULT_LEDGER_ENTRY_SOURCES.filter((source) => values.includes(source))
}
