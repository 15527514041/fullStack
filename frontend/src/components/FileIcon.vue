<script setup lang="ts">
import { computed } from 'vue'

/**
 * 文件相关图标:取自 client 项目 src/assets/images/common/*.svg(原样搬运,保持视觉一致)
 * - 线性图标用 currentColor,跟随文字颜色
 * - file 图标在 client 里就是「圆角方块 + 横线」的彩色图,这里保持原样
 */
export type FileIconName = 'cloud-upload' | 'file' | 'download' | 'eye' | 'delete' | 'lock'

const props = withDefaults(defineProps<{ name: FileIconName; size?: number }>(), { size: 20 })

interface StrokeIcon {
  viewBox: string
  strokeWidth: number
  paths: string[]
}

const STROKE_ICONS: Record<Exclude<FileIconName, 'file'>, StrokeIcon> = {
  'cloud-upload': {
    viewBox: '0 0 20 20',
    strokeWidth: 1.66667,
    paths: [
      'M9.99906 10.8333V17.5M13.3324 14.1667L9.99906 10.8333L6.66573 14.1667M3.33248 12.4158C2.71334 11.7833 2.24628 11.0181 1.96667 10.1783C1.68706 9.33848 1.60223 8.44605 1.71861 7.5686C1.83499 6.69115 2.14952 5.85168 2.63839 5.11379C3.12725 4.37591 3.77763 3.75894 4.54025 3.30964C5.30288 2.86034 6.15775 2.59048 7.04012 2.5205C7.92248 2.45052 8.8092 2.58225 9.63312 2.90573C10.457 3.22921 11.1965 3.73594 11.7956 4.38755C12.3947 5.03915 12.8376 5.81854 13.0908 6.66668H14.5825C15.3871 6.66659 16.1704 6.92528 16.8166 7.40455C17.4629 7.88381 17.9379 8.55823 18.1715 9.32819C18.405 10.0981 18.3847 10.9228 18.1136 11.6803C17.8425 12.4379 17.3349 13.0881 16.6658 13.535'
    ]
  },
  download: {
    viewBox: '0 0 20 20',
    strokeWidth: 1.60923,
    paths: ['M17.5 12.5V15.8333C17.5 16.2754 17.5 17.5 17.5 17.5C17.5 17.5 16.2754 17.5 15.8333 17.5H4.16667C3.72464 17.5 3.45663 17.5 3.45663 17.5H2.5V12.5M14.1667 8.33333L10 12.5L5.83333 8.33333M10 12.5V2.5']
  },
  eye: {
    viewBox: '0 0 20 20',
    strokeWidth: 1.66667,
    paths: [
      'M1.71835 10.2901C1.6489 10.103 1.6489 9.89715 1.71835 9.71006C2.39476 8.06993 3.54294 6.66759 5.01732 5.6808C6.4917 4.69402 8.22588 4.16724 10 4.16724C11.7741 4.16724 13.5083 4.69402 14.9827 5.6808C16.4571 6.66759 17.6053 8.06993 18.2817 9.71006C18.3511 9.89715 18.3511 10.103 18.2817 10.2901C17.6053 11.9302 16.4571 13.3325 14.9827 14.3193C13.5083 15.3061 11.7741 15.8329 10 15.8329C8.22588 15.8329 6.4917 15.3061 5.01732 14.3193C3.54294 13.3325 2.39476 11.9302 1.71835 10.2901Z',
      'M10 12.5C11.3807 12.5 12.5 11.3807 12.5 9.99996C12.5 8.61925 11.3807 7.49996 10 7.49996C8.61929 7.49996 7.5 8.61925 7.5 9.99996C7.5 11.3807 8.61929 12.5 10 12.5Z'
    ]
  },
  delete: {
    viewBox: '0 0 20 20',
    strokeWidth: 1.60923,
    paths: ['M2.5 5.00033H17.5M15.8333 5.00033V18.3337C15.8333 18.3337 15 18.3337 14.1667 18.3337H5.83333C5 18.3337 4.16667 18.3337 4.16667 18.3337V5.00033M6.66667 5.00033V3.33366C6.66667 2.50033 7.5 1.66699 8.33333 1.66699H11.6667C12.5 1.66699 13.3333 2.50033 13.3333 3.33366V5.00033M8.33333 9.16699V14.167M11.6667 9.16699V14.167']
  },
  lock: {
    viewBox: '0 0 20 20',
    strokeWidth: 1.66667,
    paths: [
      'M6.29695 9.25V6.25C6.29695 5.25544 6.68716 4.30161 7.38174 3.59835C8.07632 2.89509 9.01837 2.5 10.0007 2.5C10.9829 2.5 11.925 2.89509 12.6196 3.59835C13.3141 4.30161 13.7044 5.25544 13.7044 6.25V9.25M4.81547 9.25H15.1858C16.004 9.25 16.6673 9.25 16.6673 9.25V17.5C16.6673 17.5 16.004 17.5 15.1858 17.5H4.81547C3.99727 17.5 3.33398 17.5 3.33398 17.5V9.25C3.33398 9.25 3.99727 9.25 4.81547 9.25Z'
    ]
  }
}

const icon = computed(() => (props.name === 'file' ? null : STROKE_ICONS[props.name]))
</script>

<template>
  <!-- 文件占位图:client 里是「圆角方块 + 横线」的彩色图 -->
  <svg
    v-if="name === 'file'"
    class="file-icon"
    :width="size"
    :height="size"
    viewBox="0 0 40 40"
    fill="none"
    aria-hidden="true"
  >
    <rect width="40" height="40" rx="6" fill="var(--color-sec-1, #99EED1)" />
    <rect x="8" y="8" width="10" height="3" fill="var(--color-sec-4, #DDFFF3)" />
    <rect x="8" y="15" width="24" height="3" fill="var(--color-sec-4, #DDFFF3)" />
    <rect x="8" y="22" width="24" height="3" fill="var(--color-sec-4, #DDFFF3)" />
    <rect x="8" y="29" width="24" height="3" fill="var(--color-sec-4, #DDFFF3)" />
  </svg>

  <svg
    v-else-if="icon"
    class="file-icon"
    :width="size"
    :height="size"
    :viewBox="icon.viewBox"
    fill="none"
    stroke="currentColor"
    :stroke-width="icon.strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(d, index) in icon.paths" :key="index" :d="d" />
  </svg>
</template>

<style scoped>
.file-icon {
  display: block;
  flex-shrink: 0;
}
</style>
