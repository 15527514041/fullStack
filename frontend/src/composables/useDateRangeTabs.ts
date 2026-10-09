import { computed, ref } from 'vue'
import { toDateString } from '@/utils/datetime'

export type DateRangeTab = 'today' | 'week' | 'month' | 'all'

/**
 * 列表页顶部的日期区间 tab
 * 把「今天 / 过去 7 天 / 过去 30 天 / 全部」换算成接口的 from/to
 * 日期按本地时区算,和接口约定的 YYYY-MM-DD 对齐
 */
export function useDateRangeTabs(defaultTab: DateRangeTab = 'today') {
  const tab = ref<DateRangeTab>(defaultTab)

  const range = computed<{ from?: string; to?: string }>(() => {
    if (tab.value === 'all') return {}

    const today = new Date()
    const to = toDateString(today)
    if (tab.value === 'today') return { from: to, to }

    const start = new Date(today)
    start.setDate(start.getDate() - (tab.value === 'week' ? 6 : 29))
    return { from: toDateString(start), to }
  })

  return { tab, range }
}
