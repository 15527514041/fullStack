<script setup lang="ts">
import { useRouter, type RouteLocationRaw } from 'vue-router'
import { useIsMobile } from '@/composables/useIsMobile'

/**
 * 左上角返回按钮(图标取自 client 的 BackButton:circle-chevron-left)
 *
 * 用法:放在一个 `position: relative` 的头部容器里,它会贴在左上角、垂直居中,
 * 所以「标题居中 + 左边返回」这种详情页头部不用每个页面自己写定位。
 *
 * 返回逻辑优先级:customAction → to → 浏览器回退(没有上一页时用 fallback)
 */
const props = withDefaults(
  defineProps<{
    /** 图标尺寸 */
    size?: number
    /** 是否显示「返回」文字(移动端自动隐藏,和 client 一致) */
    showText?: boolean
    /** 直接跳到指定路由,不走上一步 */
    to?: RouteLocationRaw
    /** 没有可回退的历史时(例如直接打开链接)的兜底目标 */
    fallback?: RouteLocationRaw
    /** 完全自定义点击行为 */
    customAction?: () => void
  }>(),
  { size: 20, showText: true, fallback: '/' }
)

const router = useRouter()
const { isMobile } = useIsMobile()

function handleClick(): void {
  if (props.customAction) {
    props.customAction()
    return
  }
  if (props.to) {
    router.push(props.to)
    return
  }
  // window.history.state.back 是 vue-router 记录的上一页;为空说明是直接打开的链接
  if (window.history.state?.back) router.back()
  else router.push(props.fallback)
}
</script>

<template>
  <button type="button" class="back-button" @click="handleClick">
    <svg class="back-icon" :width="size" :height="size" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 16L10 12L14 8M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    <span v-if="showText && !isMobile" class="back-text">{{ $t('common.back') }}</span>
  </button>
</template>

<style scoped>
.back-button {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 6px 0 0;
  border: none;
  border-radius: 24px;
  background: transparent;
  color: var(--color-text-2);
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.2s;
}

.back-button:hover {
  opacity: 0.7;
}

.back-icon {
  display: block;
  flex-shrink: 0;
}

.back-text {
  margin-left: 6px;
  font-size: 16px;
  font-weight: 500;
  color: var(--color-text-2);
  white-space: nowrap;
}
</style>
