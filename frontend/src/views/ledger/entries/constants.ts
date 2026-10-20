import type { LedgerRecordSource } from '@/types'

export interface LedgerModeMeta {
  source: LedgerRecordSource
  key: 'day' | 'week' | 'month'
  listRoute: string
  newRoute: string
  detailRoute: string
  editRoute: string
  tabKey: string
  titleKey: string
  subtitleKey: string
  periodColumnKey: string
  periodColumnWidth: number
  addButtonKey: string
  addTitleKey: string
  editTitleKey: string
  emptyKey: string
}

export const LEDGER_MODES: LedgerModeMeta[] = [
  {
    source: 'manual_day',
    key: 'day',
    listRoute: 'ledger-entries-day',
    newRoute: 'ledger-entry-day-new',
    detailRoute: 'ledger-entry-day-detail',
    editRoute: 'ledger-entry-day-edit',
    tabKey: 'ledger.entries.tabDay',
    titleKey: 'ledger.entries.dayTitle',
    subtitleKey: 'ledger.entries.daySubtitle',
    periodColumnKey: 'ledger.entries.colDate',
    periodColumnWidth: 180,
    addButtonKey: 'ledger.entries.addDay',
    addTitleKey: 'ledger.entries.addDayTitle',
    editTitleKey: 'ledger.entries.editDayTitle',
    emptyKey: 'ledger.entries.emptyDay'
  },
  {
    source: 'manual_week',
    key: 'week',
    listRoute: 'ledger-entries-week',
    newRoute: 'ledger-entry-week-new',
    detailRoute: 'ledger-entry-week-detail',
    editRoute: 'ledger-entry-week-edit',
    tabKey: 'ledger.entries.tabWeek',
    titleKey: 'ledger.entries.weekTitle',
    subtitleKey: 'ledger.entries.weekSubtitle',
    periodColumnKey: 'ledger.entries.colWeek',
    periodColumnWidth: 210,
    addButtonKey: 'ledger.entries.addWeek',
    addTitleKey: 'ledger.entries.addWeekTitle',
    editTitleKey: 'ledger.entries.editWeekTitle',
    emptyKey: 'ledger.entries.emptyWeek'
  },
  {
    source: 'manual_month',
    key: 'month',
    listRoute: 'ledger-entries-month',
    newRoute: 'ledger-entry-month-new',
    detailRoute: 'ledger-entry-month-detail',
    editRoute: 'ledger-entry-month-edit',
    tabKey: 'ledger.entries.tabMonth',
    titleKey: 'ledger.entries.monthTitle',
    subtitleKey: 'ledger.entries.monthSubtitle',
    periodColumnKey: 'ledger.entries.colMonth',
    periodColumnWidth: 160,
    addButtonKey: 'ledger.entries.addMonth',
    addTitleKey: 'ledger.entries.addMonthTitle',
    editTitleKey: 'ledger.entries.editMonthTitle',
    emptyKey: 'ledger.entries.emptyMonth'
  }
]

export function getModeMeta(source: LedgerRecordSource): LedgerModeMeta {
  return LEDGER_MODES.find((item) => item.source === source) || LEDGER_MODES[0]
}
