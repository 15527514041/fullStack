<script setup lang="ts">
import { computed } from 'vue'

// 极简 SVG 图标:一个 name 对应一条定义,用 currentColor 跟随菜单文字/主色
// 新增图标只需在下面的 icons 里加一条;线性图标(outline)保留 client 原始 viewBox
const props = withDefaults(defineProps<{ name: string; size?: number }>(), {
  size: 22
})

interface IconDef {
  d: string
  /** 默认 0 0 24 24 */
  viewBox?: string
  /** 线性图标:不填充,只描边(取自 client 的 svg,自带 18 网格) */
  outline?: boolean
  strokeWidth?: number
}

const icons: Record<string, IconDef> = {
  tasks: {
    d:
      'M4 6h2v2H4V6zm4 0h12v2H8V6zM4 11h2v2H4v-2zm4 0h12v2H8v-2zM4 16h2v2H4v-2zm4 0h12v2H8v-2z'
  },
  trash: {
    d: 'M9 3h6l1 2h4v2H4V5h4l1-2zM6 9h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 9z'
  },
  tag: {
    d:
      'M3.6 12.7l9.1-9.1H20a1 1 0 0 1 1 1v7.3l-9.1 9.1a2 2 0 0 1-2.8 0l-5.5-5.5a2 2 0 0 1 0-2.8zM16.5 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z'
  },
  users: {
    d: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z'
  },
  search: {
    d:
      'M10 3a7 7 0 1 0 4.24 12.56l4.1 4.1 1.42-1.42-4.1-4.1A7 7 0 0 0 10 3zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z'
  },
  wallet: {
    d:
      'M3 7a2 2 0 0 1 2-2h14a1 1 0 0 1 1 1v2h-2V7H5v10h13v-1h2v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zm5 3h13v6H8v-6zm9.5 1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z'
  },
  settings: {
    d:
      'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm-1.2-8h2.4l.4 2.2c.6.2 1.2.5 1.7.9l2.1-.8 1.2 2.1-1.6 1.6c.1.3.2.7.2 1s-.1.7-.2 1l1.6 1.6-1.2 2.1-2.1-.8c-.5.4-1.1.7-1.7.9L11.2 22H8.8l-.4-2.2a6.6 6.6 0 0 1-1.7-.9l-2.1.8-1.2-2.1 1.6-1.6A4.8 4.8 0 0 1 4.8 14c0-.3.1-.7.2-1L3.4 11.4l1.2-2.1 2.1.8c.5-.4 1.1-.7 1.7-.9L8.8 2z'
  },
  avatar: {
    d:
      'M9.5 3h5L16 5h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l1.5-2zM12 8.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z'
  },
  logout: {
    d: 'M13 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5v-2h5V5h-5V3zM10 7.5l4.5 4.5-4.5 4.5v-3H3v-3h7v-3z'
  },
  menu: {
    d: 'M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z'
  },
  close: {
    d: 'M6.7 5.3 5.3 6.7 10.6 12 5.3 17.3 6.7 18.7 12 13.4 17.3 18.7 18.7 17.3 13.4 12 18.7 6.7 17.3 5.3 12 10.6z'
  },
  reflect: {
    d:
      'M12 2a7 7 0 0 0-4.2 12.6c.5.4.8 1 .9 1.6l.1.8h6.4l.1-.8c.1-.6.4-1.2.9-1.6A7 7 0 0 0 12 2zm0 2a5 5 0 0 1 3 9c-.9.6-1.4 1.5-1.6 2.4h-2.8c-.2-.9-.7-1.8-1.6-2.4A5 5 0 0 1 12 4zM10 19h4v1.5a1.5 1.5 0 0 1-1.5 1.5h-1a1.5 1.5 0 0 1-1.5-1.5V19z'
  },
  schedule: {
    d:
      'M8 2v2h8V2h2v2h1a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V2h2zm11 8H5v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9zM5 7v1h14V7a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1zm3 5h3v3H8v-3z'
  },
  // 钥匙 + 重置箭头(个人中心 - 修改密码,取自 client 的 reset-password)
  password: {
    d:
      'M11.625 5.625L13.35 7.35C13.4902 7.48742 13.6787 7.56439 13.875 7.56439C14.0713 7.56439 14.2598 7.48742 14.4 7.35L15.975 5.775C16.1124 5.6348 16.1894 5.44631 16.1894 5.25C16.1894 5.05369 16.1124 4.8652 15.975 4.725L14.25 3M15.7499 1.5L8.54993 8.7M9.75 11.625C9.75 13.9032 7.90317 15.75 5.625 15.75C3.34683 15.75 1.5 13.9032 1.5 11.625C1.5 9.34683 3.34683 7.5 5.625 7.5C7.90317 7.5 9.75 9.34683 9.75 11.625Z',
    viewBox: '0 0 18 18',
    outline: true,
    strokeWidth: 1.5
  },
  // 圆形对勾(结果提示弹窗,取自 client 的 result-icon)
  success: {
    d:
      'M4 24C4 12.9543 12.9543 4 24 4C35.0457 4 44 12.9543 44 24C44 35.0457 35.0457 44 24 44C12.9543 44 4 35.0457 4 24ZM22 31.8285L33.5356 20.2928C34.2937 19.5348 34.2845 18.303 33.5152 17.5564C32.6758 16.7417 31.337 16.7545 30.5133 17.5852L22 26.1716L17.8285 22C17.0474 21.219 15.7811 21.219 15 22C14.219 22.7811 14.219 24.0474 15 24.8285L22 31.8285Z',
    viewBox: '0 0 48 48'
  }
}

const icon = computed(() => icons[props.name] || icons.tasks)
</script>

<template>
  <svg
    class="menu-icon"
    :width="size"
    :height="size"
    :viewBox="icon.viewBox || '0 0 24 24'"
    :fill="icon.outline ? 'none' : 'currentColor'"
    fill-rule="evenodd"
    aria-hidden="true"
  >
    <path
      :d="icon.d"
      :stroke="icon.outline ? 'currentColor' : undefined"
      :stroke-width="icon.outline ? icon.strokeWidth || 1.5 : undefined"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<style scoped>
.menu-icon {
  display: block;
  flex-shrink: 0;
}
</style>
