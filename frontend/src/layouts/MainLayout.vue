<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown, Expand, Fold, Picture, SwitchButton } from '@element-plus/icons-vue'
import MenuIcon from '@/components/MenuIcon.vue'
import LogoMark from '@/components/LogoMark.vue'
import { uploadAvatar } from '@/api/user'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const collapsed = ref(false)
const userPanelVisible = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const expandedWidth = '256px'
const collapsedWidth = '90px'

interface MenuItem {
  path: string
  title: string
  icon: string
  disabled?: boolean
}

// 菜单按"分类"组织:分类标题是纯文本(参考 client),后续加模块只需加一组
const menus = computed<Array<{ title: string; items: MenuItem[] }>>(() => {
  const groups = [
    {
      title: '任务管理',
      items: [
        { path: '/', title: 'TODO 列表', icon: 'tasks' },
        { path: '/trash', title: '回收站', icon: 'trash' },
        { path: '/tags', title: '标签管理', icon: 'tag' }
      ]
    },
    {
      title: '账号与权限',
      items: authStore.isAdmin ? [{ path: '/admin', title: '用户管理', icon: 'users' }] : []
    },
    {
      title: '记账(规划中)',
      items: [
        { path: 'plan-transactions', title: '交易查询', icon: 'search', disabled: true },
        { path: 'plan-funds', title: '资金操作', icon: 'wallet', disabled: true }
      ]
    },
    {
      title: '通用配置(规划中)',
      items: [{ path: 'plan-settings', title: '系统设置', icon: 'settings', disabled: true }]
    }
  ]

  return groups.filter((group) => group.items.length > 0)
})

const activeMenu = computed(() => (route.path === '' ? '/' : route.path))
const sidebarWidth = computed(() => (collapsed.value ? collapsedWidth : expandedWidth))
const avatarUrl = computed(() => authStore.user?.avatarUrl || '')
const usernameInitial = computed(() => (authStore.user?.username || 'U').charAt(0).toUpperCase())

function updateIsMobile(): void {
  collapsed.value = window.matchMedia('(max-width: 768px)').matches
}


async function handleAvatarChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    input.value = ''
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.warning('图片不能超过 2MB')
    input.value = ''
    return
  }

  try {
    const result = await uploadAvatar(file)
    authStore.setAvatar(result.avatarUrl)
    ElMessage.success('头像已更新')
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  } finally {
    input.value = ''
  }
}

function handleChangeAvatar(): void {
  userPanelVisible.value = false
  fileInputRef.value?.click()
}

async function handleLogout(): Promise<void> {
  try {
    await ElMessageBox.confirm('确定要退出登录吗?', '提示', {
      showClose: false,
      confirmButtonText: '确定',
      cancelButtonText: '取消'
    })
  } catch {
    return // 用户取消
  }

  userPanelVisible.value = false
  authStore.logout()
  router.replace('/login')
}

onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile)
})
</script>

<template>
  <div class="app-wrapper">
    <!-- 顶部导航:左侧 logo 区(宽度与菜单一致)、右侧个人信息 -->
    <header class="navbar">
      <div class="navbar-left" :style="{ width: sidebarWidth }">
        <div class="logo-mark"><LogoMark /></div>
        <span v-if="!collapsed" class="logo-text">Confluo</span>
      </div>

      <div class="navbar-right">
        <el-popover
          v-model:visible="userPanelVisible"
          trigger="click"
          placement="bottom-end"
          :width="260"
          :arrow="false"
          popper-class="user-dropdown-popper"
        >
          <template #reference>
            <div class="user-trigger">
              <el-avatar :size="34" :src="avatarUrl" class="user-avatar">{{ usernameInitial }}</el-avatar>
              <span class="username">{{ authStore.user?.username || '用户' }}</span>
              <el-icon class="chevron"><ArrowDown /></el-icon>
            </div>
          </template>

          <div class="user-panel">
            <div class="user-panel-info">
              <el-avatar :size="48" :src="avatarUrl" class="user-avatar">{{ usernameInitial }}</el-avatar>
              <div class="user-meta">
                <div class="user-name">{{ authStore.user?.username || '用户' }}</div>
                <div class="user-role">{{ authStore.isAdmin ? '管理员' : '普通用户' }}</div>
              </div>
            </div>

            <div class="user-panel-menu">
              <div class="panel-item" @click="handleChangeAvatar">
                <el-icon><Picture /></el-icon>
                <span>更换头像</span>
              </div>
              <div class="panel-item is-danger" @click="handleLogout">
                <el-icon><SwitchButton /></el-icon>
                <span>退出登录</span>
              </div>
            </div>
          </div>
        </el-popover>

        <input ref="fileInputRef" type="file" accept="image/*" class="hidden-input" @change="handleAvatarChange" />
      </div>
    </header>

    <div class="main-container">
      <!-- 侧边菜单:分类标题 + SVG 图标,active 带背景与右侧色条 -->
      <aside class="sidebar" :class="{ 'is-collapse': collapsed }">
        <el-menu
          :default-active="activeMenu"
          :collapse="collapsed"
          :collapse-transition="false"
          router
          class="sidebar-menu"
          popper-class="sidebar-tooltip"
        >
          <template v-for="group in menus" :key="group.title">
            <div class="menu-group-title">{{ group.title }}</div>
            <el-menu-item
              v-for="item in group.items"
              :key="item.path"
              :index="item.path"
              :disabled="item.disabled"
            >
              <MenuIcon :name="item.icon" :size="22" />
              <template #title>
                <span class="menu-title">{{ item.title }}</span>
              </template>
            </el-menu-item>
          </template>
        </el-menu>

        <div class="sidebar-toggle" @click="collapsed = !collapsed">
          <el-icon :size="22"><component :is="collapsed ? Expand : Fold" /></el-icon>
          <span v-if="!collapsed" class="toggle-text">折叠</span>
        </div>
      </aside>

      <main class="app-main">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-wrapper {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 参考稿:80px 高、无底边框、无阴影 */
.navbar {
  flex: none;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px 0 0;
  background: var(--el-bg-color);
  z-index: 10;
}

.navbar-left {
  height: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding-left: 28px;
  transition: width 0.3s;
  overflow: hidden;
}

.logo-mark {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: var(--color-text-1);
  white-space: nowrap;
}

.navbar-right {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  min-width: 0;
}

/* 右上角用户触发区(参考 client:头像 + 昵称 + 下箭头) */
.user-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 4px;
  cursor: pointer;
  transition: opacity 0.3s;
}

.user-trigger:hover {
  opacity: 0.85;
}

.user-avatar {
  background: var(--el-color-primary);
  flex-shrink: 0;
}

.username {
  max-width: 140px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron {
  font-size: 14px;
  color: var(--color-text-3);
}

/* 下拉面板(参考 client:用户信息 + 操作项) */
.user-panel-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 20px 16px;
}

.user-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.user-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-role {
  font-size: 12px;
  color: var(--color-text-3);
}

.user-panel-menu {
  border-top: 1px solid var(--color-border);
  padding: 6px 0;
}

.panel-item {
  height: 44px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  font-size: 14px;
  color: var(--color-text-2);
  cursor: pointer;
  transition: background 0.2s;
}

.panel-item:hover {
  background: var(--color-bg-bottom);
}

.panel-item.is-danger {
  color: var(--el-color-danger);
}

.hidden-input {
  display: none;
}

.main-container {
  flex: 1;
  display: flex;
  min-height: 0;
}

/* 参考稿:白底 + 阴影(替代边框) */
.sidebar {
  width: 256px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-card);
  box-shadow: 0 0 8px 0 rgba(0, 0, 0, 0.1);
  transition: width 0.3s;
  overflow: hidden;
  z-index: 5;
}

.sidebar.is-collapse {
  width: 90px;
}

.sidebar-menu {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: none;
  padding-bottom: 8px;
}

/* 菜单项(参考稿):46px 高、上下 5px 间距、左右 32px 内边距 */
.sidebar-menu :deep(.el-menu-item) {
  height: 46px;
  margin: 5px 0;
  padding: 0 32px !important;
  color: var(--color-text-2);
  /* padding 跟随容器宽度一起过渡,避免折叠瞬间图标跳动 */
  transition: padding 0.3s;
}

.sidebar-menu :deep(.el-menu-item:hover) {
  background-color: var(--color-bg-bottom) !important;
  font-weight: 500;
}

/* 选中态(参考稿):背景色 + 右侧 4px 主色边框 + 主色文字/图标 */
.sidebar-menu :deep(.el-menu-item.is-active) {
  background-color: var(--color-bg-bottom) !important;
  color: var(--el-color-primary) !important;
  font-weight: 500;
  /* 用内阴影做右侧 4px 色条:视觉与 border 一致,但不占布局宽度(折叠时图标保持水平居中) */
  box-shadow: inset -4px 0 0 0 var(--el-color-primary);
}

/* 分类标题:纯提示文本,不可点击 */
.menu-group-title {
  padding: 12px 32px 0;
  font-size: 12px;
  line-height: 20px;
  color: var(--color-text-3);
  user-select: none;
  white-space: nowrap;
}

.menu-title {
  margin-left: 16px;
}

/* 收起态:隐藏分类标题与文字,图标居中 */
.sidebar.is-collapse .menu-group-title {
  display: none;
}

.sidebar.is-collapse .menu-title {
  display: none;
}

/* 折叠态:90px 容器内让 22px 图标居中(左右各 34px),数值接近展开态,过渡平滑 */
.sidebar.is-collapse .sidebar-menu :deep(.el-menu-item) {
  padding: 0 34px !important;
}

/* Element Plus 给折叠项的 tooltip 触发层加了左右内边距且左对齐,这里改为居中 */
.sidebar.is-collapse .sidebar-menu :deep(.el-menu-tooltip__trigger) {
  width: 100%;
  height: 100%;
  padding: 0 !important;
  justify-content: center;
  align-items: center;
}

.sidebar-menu.el-menu--collapse {
  width: 100%;
}

/* 底部收起栏(参考稿:58px、顶部 1px 分隔、hover 反馈) */
.sidebar-toggle {
  flex: none;
  height: 58px;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 12px 32px;
  border-top: 1px solid var(--color-border);
  color: var(--color-text-2);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.3s;
}

.sidebar-toggle:hover {
  background: rgba(0, 0, 0, 0.025);
}

.sidebar.is-collapse .sidebar-toggle {
  justify-content: center;
  gap: 0;
  padding: 12px 0;
}

.toggle-text {
  white-space: nowrap;
}

.app-main {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 26px;
  background: var(--color-bg-bottom);
}

@media (max-width: 768px) {
  .navbar {
    padding: 0 12px 0 0;
  }

  .navbar-right {
    gap: 6px;
  }

  .username {
    display: none;
  }

  .sidebar-menu :deep(.el-menu-item) {
    padding: 0 16px !important;
  }

  .menu-title {
    margin-left: 12px;
  }

  .menu-group-title {
    padding: 12px 16px 0;
  }

  .app-main {
    padding: 16px;
  }
}
</style>

<style>
/* 折叠菜单 hover 的 tooltip(参考 client 的 sidebar-popper) */
.sidebar-tooltip.el-popper {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50px;
  padding: 0 15px;
  border: none;
  border-radius: 14px;
  background: var(--color-bg-card);
  box-shadow: 0 0 8px 0 rgba(0, 0, 0, 0.08);
  font-size: 14px;
  line-height: 20px;
  color: var(--color-text-1);
  box-sizing: border-box;
}

.sidebar-tooltip.el-popper.is-dark {
  background: var(--color-bg-card);
  color: var(--color-text-1);
}

.sidebar-tooltip.el-popper .el-popper__arrow {
  display: none;
}

/* tooltip 复用了菜单的 #title 插槽,需重置菜单项里的左外边距,否则文字偏右 */
.sidebar-tooltip.el-popper .menu-title {
  margin-left: 0 !important;
  display: inline-block;
  line-height: 20px;
}

/* 右上角用户下拉面板(参考 client) */
.user-dropdown-popper.el-popover {
  --el-popover-padding: 0;
  --el-popover-border-radius: 24px;
  --el-popover-bg-color: var(--color-bg-card);
  --el-popover-border-color: transparent;
  --el-box-shadow-light: 0 0 8px 1px rgba(0, 0, 0, 0.08);
}

.user-dropdown-popper.el-popover .el-popper__arrow {
  display: none;
}
</style>
