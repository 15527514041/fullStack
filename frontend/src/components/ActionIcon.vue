<script setup lang="ts">
import { computed } from 'vue'

/**
 * 操作类图标:原样取自 client 的 src/assets/icons/svg/(KYB 企业资料提交-相关人员 用的就是这几个)
 * 线性图标统一 currentColor,尺寸由 size 控制
 */
export type ActionIconName = 'delete' | 'edit' | 'arrow-down' | 'arrow-up' | 'add' | 'drag' | 'check'

const props = withDefaults(defineProps<{ name: ActionIconName; size?: number }>(), { size: 20 })

interface IconDef {
  viewBox: string
  strokeWidth?: string
  /** 填充型图标(比如 client 的 drag.svg),不再描边 */
  filled?: boolean
  paths: string[]
}

const ICONS: Record<ActionIconName, IconDef> = {
  // 20×20 描边图标
  delete: {
    viewBox: '0 0 20 20',
    strokeWidth: '1.66667',
    paths: [
      'M2.5 4.99984H17.5M15.8333 4.99984V16.6665C15.8333 17.4998 15 18.3332 14.1667 18.3332H5.83333C5 18.3332 4.16667 17.4998 4.16667 16.6665V4.99984M6.66667 4.99984V3.33317C6.66667 2.49984 7.5 1.6665 8.33333 1.6665H11.6667C12.5 1.6665 13.3333 2.49984 13.3333 3.33317V4.99984M8.33333 9.1665V14.1665M11.6667 9.1665V14.1665'
    ]
  },
  edit: {
    viewBox: '0 0 20 20',
    strokeWidth: '1.66667',
    paths: [
      'M10.0002 16.6665H17.5002M12.5002 4.16646L15.0002 6.66646M13.6468 3.01811C13.9786 2.68637 14.4285 2.5 14.8976 2.5C15.3668 2.5 15.8167 2.68637 16.1485 3.01811C16.4802 3.34985 16.6666 3.79979 16.6666 4.26895C16.6666 4.7381 16.4802 5.18804 16.1485 5.51978L6.14014 15.5289C5.94189 15.7272 5.69683 15.8722 5.42764 15.9506L3.03431 16.6489C2.9626 16.6699 2.88659 16.6711 2.81423 16.6526C2.74188 16.634 2.67583 16.5964 2.62302 16.5436C2.5702 16.4908 2.53255 16.4247 2.51401 16.3524C2.49547 16.28 2.49673 16.204 2.51764 16.1323L3.21598 13.7389C3.29449 13.4701 3.43952 13.2253 3.63764 13.0273L13.6468 3.01811Z'
    ]
  },
  'arrow-down': {
    viewBox: '0 0 20 20',
    strokeWidth: '1.66667',
    paths: ['M5 7.5L10 12.5L15 7.5']
  },
  'arrow-up': {
    viewBox: '0 0 20 20',
    strokeWidth: '1.66667',
    paths: ['M5 12.5L10 7.5L15 12.5']
  },
  // 加号是 24×24、stroke 2
  add: {
    viewBox: '0 0 24 24',
    strokeWidth: '2',
    paths: ['M12.001 4V20', 'M20 12.002H3.5']
  },
  // 四向拖拽手柄(原样取自 client 的 drag.svg,填充型)
  drag: {
    viewBox: '0 0 128 128',
    filled: true,
    paths: [
      'M73.137 29.08h-9.209 29.7L63.886.093 34.373 29.08h20.49v27.035H27.238v17.948h27.625v27.133h18.274V74.063h27.41V56.115h-27.41V29.08zm-9.245 98.827l27.518-26.711H36.59l27.302 26.71zM.042 64.982l27.196 27.029V38.167L.042 64.982zm100.505-26.815V92.01l27.41-27.029-27.41-26.815z'
    ]
  },
  // 圆圈打勾(取自 client 的 circle-check.svg;原文件把颜色写死成绿色,这里改成 currentColor 以便表示选中/未选中)
  check: {
    viewBox: '0 0 20 20',
    strokeWidth: '1.5',
    paths: [
      'M7.50008 10.0003L9.16675 11.667L12.5001 8.33366M18.3334 10.0003C18.3334 14.6027 14.6025 18.3337 10.0001 18.3337C5.39771 18.3337 1.66675 14.6027 1.66675 10.0003C1.66675 5.39795 5.39771 1.66699 10.0001 1.66699C14.6025 1.66699 18.3334 5.39795 18.3334 10.0003Z'
    ]
  }
}

const icon = computed(() => ICONS[props.name])
</script>

<template>
  <svg
    class="action-icon"
    :width="size"
    :height="size"
    :viewBox="icon.viewBox"
    :fill="icon.filled ? 'currentColor' : 'none'"
    :stroke="icon.filled ? 'none' : 'currentColor'"
    :stroke-width="icon.filled ? undefined : icon.strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(d, index) in icon.paths" :key="index" :d="d" />
  </svg>
</template>

<style scoped>
.action-icon {
  display: block;
  flex-shrink: 0;
}
</style>
