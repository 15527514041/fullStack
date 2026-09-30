import { onUnmounted, watch, type Ref } from 'vue'

// 移动端上拉加载:哨兵元素进入视口时触发 onLoadMore
export function useInfiniteScroll(target: Ref<HTMLElement | null>, onLoadMore: () => void): void {
  let observer: IntersectionObserver | null = null

  const stop = (): void => {
    observer?.disconnect()
    observer = null
  }

  watch(
    target,
    (el) => {
      stop()
      if (!el || typeof IntersectionObserver === 'undefined') return

      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) onLoadMore()
        },
        { rootMargin: '120px 0px' }
      )
      observer.observe(el)
    },
    { flush: 'post' }
  )

  onUnmounted(stop)
}
