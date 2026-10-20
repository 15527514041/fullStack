import { onMounted, reactive, ref } from 'vue'
import { getLedgerRecords } from '@/api/ledger'
import type { LedgerRecordSource, LedgerRecordSummary } from '@/types'
import { periodRangeForPreset, type LedgerListPreset } from '../utils'

export function useLedgerRecordList(source: LedgerRecordSource) {
  const list = ref<LedgerRecordSummary[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(10)
  const loading = ref(false)
  const filters = reactive<{ range: [string, string] | null; preset: LedgerListPreset }>({
    range: null,
    preset: 'all'
  })

  async function load(): Promise<void> {
    loading.value = true
    try {
      const result = await getLedgerRecords({
        source,
        page: page.value,
        pageSize: pageSize.value,
        from: filters.range?.[0],
        to: filters.range?.[1]
      })
      list.value = result.list
      total.value = result.total
      // 删除/筛选后当前页可能已经越界,自动回到最后一页
      if (list.value.length === 0 && total.value > 0 && page.value > 1) {
        page.value = Math.max(1, Math.ceil(total.value / pageSize.value))
        await load()
      }
    } catch {
      // 错误提示由 axios 拦截器统一处理
    } finally {
      loading.value = false
    }
  }

  function applyFilters(): void {
    if (source !== 'manual_day') {
      filters.range = periodRangeForPreset(source, filters.preset)
    }
    page.value = 1
    void load()
  }

  function resetFilters(): void {
    filters.range = null
    filters.preset = 'all'
    applyFilters()
  }

  function handlePageChange(value: number): void {
    page.value = value
    void load()
  }

  function handleSizeChange(value: number): void {
    pageSize.value = value
    page.value = 1
    void load()
  }

  onMounted(load)

  return {
    list,
    total,
    page,
    pageSize,
    loading,
    filters,
    load,
    applyFilters,
    resetFilters,
    handlePageChange,
    handleSizeChange
  }
}
