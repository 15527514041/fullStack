import i18n from '@/lang'
import { formatDayLabel, parseDateOnly, toDateString } from '@/utils/datetime'
import type { LedgerRecordSource } from '@/types'

export type LedgerListPreset =
  | 'all'
  | 'current_week'
  | 'current_month'
  | 'last_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'last_year'

function locale(): string {
  return i18n.global.locale.value === 'en_US' ? 'en-US' : 'zh-CN'
}

/** 把任意日期归一到所在周的周一(周一为一周起点) */
export function normalizeWeekStart(value: string): string {
  if (!value) return ''
  const date = parseDateOnly(value)
  const weekday = date.getDay()
  const diff = weekday === 0 ? -6 : 1 - weekday
  date.setDate(date.getDate() + diff)
  return toDateString(date)
}

export function periodEndFor(source: LedgerRecordSource, periodStart: string): string {
  if (!periodStart) return ''
  const start = parseDateOnly(periodStart)

  if (source === 'manual_day') return periodStart

  if (source === 'manual_week') {
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    return toDateString(end)
  }

  return toDateString(new Date(start.getFullYear(), start.getMonth() + 1, 0))
}

export function currentPeriodStart(source: LedgerRecordSource): string {
  const today = toDateString(new Date())
  if (source === 'manual_day') return today
  if (source === 'manual_week') return normalizeWeekStart(today)
  return `${today.slice(0, 7)}-01`
}

function monthStart(date: Date, offset: number): string {
  return toDateString(new Date(date.getFullYear(), date.getMonth() + offset, 1))
}

function monthEnd(date: Date, offset: number): string {
  return toDateString(new Date(date.getFullYear(), date.getMonth() + offset + 1, 0))
}

/**
 * 周/月列表的下拉筛选范围。
 * “近 N 月”包含当前月及之前 N - 1 个月，“近 1 年”包含当前月及之前 11 个月。
 */
export function periodRangeForPreset(
  source: LedgerRecordSource,
  preset: LedgerListPreset,
  today = new Date()
): [string, string] | null {
  if (source === 'manual_day' || preset === 'all') return null

  if (source === 'manual_week' && preset === 'current_week') {
    const start = normalizeWeekStart(toDateString(today))
    return [start, periodEndFor(source, start)]
  }

  if (preset === 'current_month') return [monthStart(today, 0), monthEnd(today, 0)]
  if (preset === 'last_month') return [monthStart(today, -1), monthEnd(today, -1)]
  if (preset === 'last_3_months') return [monthStart(today, -2), monthEnd(today, 0)]
  if (preset === 'last_6_months') return [monthStart(today, -5), monthEnd(today, 0)]
  if (preset === 'last_year') return [monthStart(today, -11), monthEnd(today, 0)]

  return null
}

/** ISO 8601 周序号和周年:跨年周不会显示成上一年的第 53 周 */
export function getIsoWeekInfo(periodStart: string): { year: number; week: number } {
  const date = new Date(`${periodStart}T00:00:00.000Z`)
  const weekday = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - weekday)
  const year = date.getUTCFullYear()
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { year, week }
}

function formatMonthDay(value: string): string {
  return new Intl.DateTimeFormat(locale(), { month: 'numeric', day: 'numeric' }).format(parseDateOnly(value))
}

/** 列表/详情的主周期文案 */
export function formatPeriodLabel(
  source: LedgerRecordSource,
  periodStart: string,
  _periodEnd?: string
): string {
  if (!periodStart) return ''

  if (source === 'manual_day') return formatDayLabel(periodStart)

  if (source === 'manual_week') {
    const { year, week } = getIsoWeekInfo(periodStart)
    return i18n.global.t('ledger.entries.weekLabel', { year, week })
  }

  const date = parseDateOnly(periodStart)
  if (i18n.global.locale.value === 'en_US') {
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long' }).format(date)
  }
  return i18n.global.t('ledger.entries.monthLabel', {
    year: date.getFullYear(),
    month: date.getMonth() + 1
  })
}

/** 周维度额外的日期范围副标题;日/月返回空串 */
export function formatPeriodRange(
  source: LedgerRecordSource,
  periodStart: string,
  periodEnd: string
): string {
  if (source !== 'manual_week' || !periodStart || !periodEnd) return ''
  return `${formatMonthDay(periodStart)} - ${formatMonthDay(periodEnd)}`
}
