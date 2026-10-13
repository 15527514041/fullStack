<script setup lang="ts">
import { computed } from 'vue'

/**
 * Markdown 编辑器工具栏图标
 * 按项目里线性图标的风格手绘:24×24 视窗、描边 2、圆头圆角、currentColor,
 * 显示 16px 时的实际描边粗细和 ActionIcon(20×20 / 1.67)一致
 */
export type MarkdownIconName =
  | 'bold'
  | 'italic'
  | 'list'
  | 'ordered-list'
  | 'quote'
  | 'code'
  | 'link'
  | 'preview'
  | 'edit'

const props = withDefaults(defineProps<{ name: MarkdownIconName; size?: number }>(), { size: 16 })

const PATHS: Record<MarkdownIconName, string[]> = {
  // 加粗
  bold: ['M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8'],
  // 斜体
  italic: ['M19 4h-9M14 20H5M15 4L9 20'],
  // 无序列表
  list: ['M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'],
  // 有序列表
  'ordered-list': ['M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1'],
  // 引用
  quote: [
    'M10 11H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6c0 2-1 3-3 4',
    'M20 11h-4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6c0 2-1 3-3 4'
  ],
  // 行内代码
  code: ['M16 18l6-6-6-6M8 6l-6 6 6 6'],
  // 链接
  link: [
    'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
    'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'
  ],
  // 预览(眼睛)
  preview: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  // 继续编辑(铅笔)
  edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z']
}

const paths = computed(() => PATHS[props.name])
</script>

<template>
  <svg
    class="markdown-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(d, index) in paths" :key="index" :d="d" />
  </svg>
</template>

<style scoped>
.markdown-icon {
  display: block;
  flex-shrink: 0;
}
</style>
