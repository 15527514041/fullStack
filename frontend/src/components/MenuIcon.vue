<script setup lang="ts">
import { computed } from 'vue'

// 极简 SVG 图标:一个 name 对应一段 path,用 currentColor 跟随菜单文字/主色
// 新增图标只需在这里加一行 path
const props = withDefaults(defineProps<{ name: string; size?: number }>(), {
  size: 22
})

const paths: Record<string, string> = {
  // 列表 / TODO
  tasks:
    'M4 6h2v2H4V6zm4 0h12v2H8V6zM4 11h2v2H4v-2zm4 0h12v2H8v-2zM4 16h2v2H4v-2zm4 0h12v2H8v-2z',
  // 回收站
  trash:
    'M9 3h6l1 2h4v2H4V5h4l1-2zM6 9h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 9z',
  // 标签
  tag:
    'M3.6 12.7l9.1-9.1H20a1 1 0 0 1 1 1v7.3l-9.1 9.1a2 2 0 0 1-2.8 0l-5.5-5.5a2 2 0 0 1 0-2.8zM16.5 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  // 用户
  users:
    'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z',
  // 搜索(交易查询占位)
  search:
    'M10 3a7 7 0 1 0 4.24 12.56l4.1 4.1 1.42-1.42-4.1-4.1A7 7 0 0 0 10 3zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z',
  // 钱包(资金操作占位)
  wallet:
    'M3 7a2 2 0 0 1 2-2h14a1 1 0 0 1 1 1v2h-2V7H5v10h13v-1h2v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zm5 3h13v6H8v-6zm9.5 1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  // 设置(通用配置占位)
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm-1.2-8h2.4l.4 2.2c.6.2 1.2.5 1.7.9l2.1-.8 1.2 2.1-1.6 1.6c.1.3.2.7.2 1s-.1.7-.2 1l1.6 1.6-1.2 2.1-2.1-.8c-.5.4-1.1.7-1.7.9L11.2 22H8.8l-.4-2.2a6.6 6.6 0 0 1-1.7-.9l-2.1.8-1.2-2.1 1.6-1.6A4.8 4.8 0 0 1 4.8 14c0-.3.1-.7.2-1L3.4 11.4l1.2-2.1 2.1.8c.5-.4 1.1-.7 1.7-.9L8.8 2z',
  // 相机(个人中心 - 更换头像)
  avatar:
    'M9.5 3h5L16 5h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l1.5-2zM12 8.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
  // 进门箭头(个人中心 - 退出登录)
  logout:
    'M13 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5v-2h5V5h-5V3zM10 7.5l4.5 4.5-4.5 4.5v-3H3v-3h7v-3z',
  // 汉堡菜单(移动端导航栏)
  menu:
    'M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z',
  // 关闭(移动端菜单面板右上角)
  close:
    'M6.7 5.3 5.3 6.7 10.6 12 5.3 17.3 6.7 18.7 12 13.4 17.3 18.7 18.7 17.3 13.4 12 18.7 6.7 17.3 5.3 12 10.6z'
}

const path = computed(() => paths[props.name] || paths.tasks)
</script>

<template>
  <svg
    class="menu-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="currentColor"
    fill-rule="evenodd"
    aria-hidden="true"
  >
    <path :d="path" />
  </svg>
</template>

<style scoped>
.menu-icon {
  display: block;
  flex-shrink: 0;
}
</style>
