import i18n from '@/lang'

// 时间按当前语言格式化(切英文时用 en-US 的格式)
export function formatDateTime(value?: string | null): string {
  if (!value) return '-'
  const locale = i18n.global.locale.value === 'en_US' ? 'en-US' : 'zh-CN'
  return new Date(value).toLocaleString(locale, { hour12: false })
}

// 本地日期 → YYYY-MM-DD(不走 toISOString,避免时区把日期挪一天)
export function toDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// YYYY-MM-DD → 本地 Date(用本地零点,同样避免时区问题)
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day)
}

// 日期展示:2026/10/09
export function formatDate(value?: string | null): string {
  if (!value) return '-'
  const [year, month, day] = value.slice(0, 10).split('-')
  return `${year}/${month}/${day}`
}

// 星期按当前语言输出(周五 / Fri):后端不存星期,展示时按日期算
export function formatWeekday(value?: string | null): string {
  if (!value) return ''
  const locale = i18n.global.locale.value === 'en_US' ? 'en-US' : 'zh-CN'
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(parseDateOnly(value))
}

// 完整写法(星期五 / Friday):表单里的只读字段用这个
export function formatWeekdayLong(value?: string | null): string {
  if (!value) return ''
  const locale = i18n.global.locale.value === 'en_US' ? 'en-US' : 'zh-CN'
  return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(parseDateOnly(value))
}

// 列表卡片标题:2026/10/09 周五
export function formatDayLabel(value?: string | null): string {
  if (!value) return '-'
  return `${formatDate(value)} ${formatWeekday(value)}`
}

// 用时:后端给分钟数,这里格式化成 1h30m / 2h / 45m(不四舍五入,避免看着少了 15 分钟)
export function formatDuration(minutes?: number | null): string {
  if (minutes === null || minutes === undefined) return ''
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest}m`
  return rest ? `${hours}h${rest}m` : `${hours}h`
}
