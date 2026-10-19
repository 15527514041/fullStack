/**
 * 金额工具:前后端之间一律用「分」的整数传递,只在展示层换算成元
 * 用整数分是为了避免浮点误差,也省掉后端 Decimal 那种「JSON 出来变字符串」的麻烦
 */

/** 分 → 元(只在表单回显时用,展示请走 formatCents) */
export function centsToYuan(cents: number): number {
  return Math.round(cents) / 100
}

/** 元 → 分:乘 100 后四舍五入,0.1+0.2 这类浮点误差不会漏出去 */
export function yuanToCents(yuan: number | string): number {
  const value = typeof yuan === 'string' ? Number(yuan) : yuan
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100)
}

/** 1234567 → ¥12,345.67;负数 → -¥1,234.00 */
export function formatCents(cents: number): string {
  const negative = cents < 0
  const [intPart, decimalPart] = (Math.abs(Math.round(cents)) / 100).toFixed(2).split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+$)/g, ',')
  return `${negative ? '-' : ''}¥${grouped}.${decimalPart}`
}
