<script setup lang="ts">
import { computed } from 'vue'

/**
 * 资产账户类型图标:手写 SVG,每个图标键一个固定图形 + 固定配色
 * (预设类型用自己的图标;用户新建类型可从这组图标里选择)
 *
 * 统一风格:28×28 圆角底(类型色 14% 透明)+ 单色实心图形,
 * 图形内部的镂空靠 svg 上的 fill-rule="evenodd" 挖出来
 */
const props = withDefaults(defineProps<{ icon?: string | null; size?: number }>(), { size: 24 })

interface IconDef {
  /** 类型色:底色和图形都用它 */
  color: string
  /** 图形路径:可以多条子路径 */
  d: string
}

const ICONS: Record<string, IconDef> = {
  // 现金:钞票 + 中间的圆 + 两端小点
  CASH: {
    color: '#22c55e',
    d: 'M8 12h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2zm8 1.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2zM9.6 15.4a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm12.8 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z'
  },
  // 微信零钱:气泡 + 两只眼睛
  WECHAT: {
    color: '#07c160',
    d: 'M16 8.5c-5.4 0-9.8 3.4-9.8 7.6 0 2.4 1.3 4.5 3.3 5.9l-.8 3.2 3.7-1.9c1.2.3 2.4.4 3.6.4 5.4 0 9.8-3.4 9.8-7.6S21.4 8.5 16 8.5zm-3.4 5.7a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zm6.8 0a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z'
  },
  // 支付宝余额:钱袋(扁提手 + 袋身 + 搭扣)
  ALIPAY: {
    color: '#1677ff',
    d: 'M10 14.6v-1a6 2.6 0 0 1 12 0v1h-2.3v-1a3.7 1.4 0 0 0-7.4 0v1H10zM8 13.6h16a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3zm8 3.4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z'
  },
  // 储蓄卡:卡面 + 磁条 + 芯片
  DEBIT_CARD: {
    color: '#5b8ff9',
    d: 'M8 10h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zm-2 3h20v2.5H6zm3 4.5h4V20H9z'
  },
  // 信用卡:卡面 + 两行卡号
  CREDIT_CARD: {
    color: '#f0a020',
    d: 'M8 10h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zm1 3.5h6v2H9zm0 4h9v2H9z'
  },
  // 理财账户:向右上的三根柱子
  INVESTMENT: {
    color: '#9254de',
    d: 'M8 19.5h3.5V24H8v-4.5zm6-5h3.5V24H14v-9.5zm6-5.5h3.5V24H20V9z'
  },
  // 负债账户:向下走的三根柱子(和理财正好相反)
  LIABILITY: {
    color: '#f5222d',
    d: 'M8 9h3.5v15H8V9zm6 5h3.5v10H14v-10zm6 5h3.5v5H20v-5z'
  },
  // 其他:三个点
  OTHER: {
    color: '#9ca3af',
    d: 'M11 14.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6zm5 0a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6zm5 0a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z'
  }
}

const icon = computed<IconDef>(() => ICONS[props.icon || 'OTHER'] || ICONS.OTHER)
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 32 32" fill-rule="evenodd" aria-hidden="true">
    <rect x="2" y="2" width="28" height="28" rx="9" :fill="icon.color" fill-opacity="0.14" />
    <path :d="icon.d" :fill="icon.color" />
  </svg>
</template>
