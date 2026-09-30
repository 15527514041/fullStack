import { ref } from 'vue'

// 全局单例:整个应用共用一个 matchMedia 监听,避免每个组件都挂 resize
const isMobile = ref(false)
let initialized = false

function update(): void {
  isMobile.value = window.matchMedia('(max-width: 768px)').matches
}

export function useIsMobile() {
  if (!initialized) {
    initialized = true
    update()

    const mql = window.matchMedia('(max-width: 768px)')
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', update)
    } else {
      window.addEventListener('resize', update)
    }
  }

  return { isMobile }
}
