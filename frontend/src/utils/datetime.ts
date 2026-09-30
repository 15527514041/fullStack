import i18n from '@/lang'

// 时间按当前语言格式化(切英文时用 en-US 的格式)
export function formatDateTime(value?: string | null): string {
  if (!value) return '-'
  const locale = i18n.global.locale.value === 'en_US' ? 'en-US' : 'zh-CN'
  return new Date(value).toLocaleString(locale, { hour12: false })
}
