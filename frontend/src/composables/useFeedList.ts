import { computed, onMounted, ref, watch, type Ref } from 'vue'
import { useInfiniteScroll } from './useInfiniteScroll'
import type { PagedResult } from '@/types'

/**
 * 卡片流 + 滑动分页(两个成长模块列表共用)
 * - 切 tab(range 变化)重置到第 1 页
 * - 哨兵进入视口时自动加载下一页,加载完 list.length >= total 就停
 * sentinelRef 由页面自己声明(模板里用 ref="sentinelRef" 绑定),这里只在它进入视口时翻页
 */
export function useFeedList<T>(
  fetcher: (params: { page: number; pageSize: number; from?: string; to?: string }) => Promise<PagedResult<T>>,
  range: Ref<{ from?: string; to?: string }>,
  sentinelRef: Ref<HTMLElement | null>,
  pageSize = 10
) {
  const items = ref<T[]>([]) as Ref<T[]>
  const total = ref(0)
  const page = ref(1)
  const loading = ref(false)
  const loadingMore = ref(false)
  const hasMore = computed(() => items.value.length < total.value)

  async function load(append = false): Promise<void> {
    if (append) loadingMore.value = true
    else loading.value = true

    try {
      const result = await fetcher({ page: page.value, pageSize, ...range.value })
      items.value = append ? [...items.value, ...result.list] : result.list
      total.value = result.total
    } catch {
      // 错误提示已由 axios 拦截器统一处理;追加失败时回退页码,避免漏数据
      if (append && page.value > 1) page.value -= 1
    } finally {
      loading.value = false
      loadingMore.value = false
    }
  }

  function reload(): void {
    page.value = 1
    load()
  }

  // 切 tab 重新拉第一页
  watch(range, reload)

  useInfiniteScroll(sentinelRef, () => {
    if (loading.value || loadingMore.value || !hasMore.value) return
    page.value += 1
    load(true)
  })

  onMounted(reload)

  return { items, total, loading, loadingMore, hasMore, reload }
}
