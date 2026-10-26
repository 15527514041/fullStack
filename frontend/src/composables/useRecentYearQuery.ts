import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * 年度视图的年份状态:
 * - 只开放当前年份及前两年
 * - 年份写入 query,刷新和浏览器返回都能恢复
 * - 非法或不支持的年份回退到当前年
 */
export function useRecentYearQuery(onYearChange: (year: number) => void) {
  const route = useRoute()
  const router = useRouter()
  const currentYear = new Date().getFullYear()
  const availableYears = [currentYear - 2, currentYear - 1, currentYear]
  const selectedYear = ref(currentYear)

  function selectYear(year: number): void {
    if (year === selectedYear.value) return
    selectedYear.value = year
    void router.replace({ query: { ...route.query, year: String(year) } })
  }

  watch(
    () => route.query.year,
    (value) => {
      const parsed = typeof value === 'string' ? Number(value) : Number.NaN
      const year = availableYears.includes(parsed) ? parsed : currentYear

      if (value !== String(year)) {
        void router.replace({ query: { ...route.query, year: String(year) } })
        return
      }

      selectedYear.value = year
      onYearChange(year)
    },
    { immediate: true }
  )

  return { availableYears, selectedYear, selectYear }
}
