<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown, Expand, Fold } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import MenuIcon from '@/components/MenuIcon.vue'
import LogoMark from '@/components/LogoMark.vue'
import LangSelect from '@/components/LangSelect.vue'
import { useOssUrl } from '@/composables/useOssUrl'
import { uploadAvatar } from '@/api/user'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

const collapsed = ref(false)
const isMobile = ref(false)
const mobileMenuVisible = ref(false)
const userPanelVisible = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const appMainRef = ref<HTMLElement | null>(null)

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
      title: t('menu.tasksGroup'),
      items: [
        { path: '/', title: t('menu.todoList'), icon: 'tasks' },
        { path: '/trash', title: t('menu.trash'), icon: 'trash' },
        { path: '/tags', title: t('menu.tags'), icon: 'tag' }
      ]
    },
    {
      title: t('menu.accountGroup'),
      items: authStore.isAdmin ? [{ path: '/admin', title: t('menu.users'), icon: 'users' }] : []
    },
    {
      title: t('menu.ledgerGroup'),
      items: [
        { path: 'plan-transactions', title: t('menu.transactions'), icon: 'search', disabled: true },
        { path: 'plan-funds', title: t('menu.funds'), icon: 'wallet', disabled: true }
      ]
    },
    {
      title: t('menu.settingsGroup'),
      items: [{ path: 'plan-settings', title: t('menu.systemSettings'), icon: 'settings', disabled: true }]
    }
  ]

  return groups.filter((group) => group.items.length > 0)
})

const activeMenu = computed(() => (route.path === '' ? '/' : route.path))
const sidebarWidth = computed(() => (collapsed.value ? collapsedWidth : expandedWidth))
// 头像存的是 ossId,展示时换成签名地址(私有文件;签名过期会由 @error 重新取)
const { url: avatarUrl, refresh: refreshAvatar } = useOssUrl(computed(() => authStore.user?.avatarOssId))
const usernameInitial = computed(() => (authStore.user?.username || 'U').charAt(0).toUpperCase())

function updateIsMobile(): void {
  isMobile.value = window.matchMedia('(max-width: 768px)').matches
  if (!isMobile.value) mobileMenuVisible.value = false
}

function toggleMobileMenu(): void {
  mobileMenuVisible.value = !mobileMenuVisible.value
}

// 移动端点击菜单跳转后自动收起抽屉
watch(
  () => route.path,
  () => {
    mobileMenuVisible.value = false
    // 切页后内容区回到顶部,避免把上个页面的滚动位置带过来
    appMainRef.value?.scrollTo({ top: 0 })
  }
)


async function handleAvatarChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    ElMessage.warning(t('navbar.avatarTypeError'))
    input.value = ''
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.warning(t('navbar.avatarSizeError'))
    input.value = ''
    return
  }

  try {
    const result = await uploadAvatar(file)
    authStore.setAvatar(result.avatarOssId)
    ElMessage.success(t('navbar.avatarUpdated'))
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
    await ElMessageBox.confirm(t('navbar.logoutConfirm'), t('common.tip'), {
      showClose: false,
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel')
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
      <div class="navbar-left" :style="{ width: isMobile ? 'auto' : sidebarWidth }">
        <div v-if="isMobile" class="mobile-toggle" @click="toggleMobileMenu">
          <MenuIcon name="menu" :size="22" />
        </div>
        <div class="logo-mark"><LogoMark /></div>
        <span v-if="isMobile || !collapsed" class="logo-text">Confluo</span>
      </div>

      <div class="navbar-right">
        <LangSelect />

        <!-- 语言切换与个人头像之间的分隔线(参考 client) -->
        <span class="menu-divider" />

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
              <el-avatar :size="34" :src="avatarUrl" class="user-avatar" @error="refreshAvatar">{{ usernameInitial }}</el-avatar>
              <span class="username">{{ authStore.user?.username || $t('navbar.defaultUser') }}</span>
              <el-icon class="chevron"><ArrowDown /></el-icon>
            </div>
          </template>

          <div class="user-panel">
            <div class="user-panel-info">
              <el-avatar :size="48" :src="avatarUrl" class="user-avatar" @error="refreshAvatar">{{ usernameInitial }}</el-avatar>
              <div class="user-meta">
                <div class="user-name">{{ authStore.user?.username || $t('navbar.defaultUser') }}</div>
                <div class="user-role">{{ authStore.isAdmin ? $t('common.roleAdmin') : $t('common.roleUser') }}</div>
              </div>
            </div>

            <div class="user-panel-menu">
              <div class="panel-item" @click="handleChangeAvatar">
                <MenuIcon name="avatar" :size="16" />
                <span>{{ $t('navbar.changeAvatar') }}</span>
              </div>
              <div class="panel-item is-danger" @click="handleLogout">
                <MenuIcon name="logout" :size="16" />
                <span>{{ $t('navbar.logout') }}</span>
              </div>
            </div>
          </div>
        </el-popover>

        <input ref="fileInputRef" type="file" accept="image/*" class="hidden-input" @change="handleAvatarChange" />
      </div>
    </header>

    <div class="main-container">
      <!-- 侧边菜单:分类标题 + SVG 图标,active 带背景与右侧色条 -->
      <aside
        class="sidebar"
        :class="{ 'is-collapse': collapsed && !isMobile, 'is-mobile': isMobile, 'is-open': mobileMenuVisible }"
      >
        <!-- 移动端面板头部:右上角关闭按钮(带底色) -->
        <div v-if="isMobile" class="panel-head">
          <span class="panel-head-title">{{ $t('navbar.menu') }}</span>
          <div class="panel-close" @click="mobileMenuVisible = false">
            <MenuIcon name="close" :size="16" />
          </div>
        </div>

        <el-menu
          :default-active="activeMenu"
          :collapse="collapsed && !isMobile"
          :collapse-transition="false"
          router
          class="sidebar-menu"
          popper-class="app-tooltip"
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

        <div v-if="!isMobile" class="sidebar-toggle" @click="collapsed = !collapsed">
          <el-icon :size="22"><component :is="collapsed ? Expand : Fold" /></el-icon>
          <span v-if="!collapsed" class="toggle-text">{{ $t('navbar.collapse') }}</span>
        </div>
      </aside>

      <!-- 移动端抽屉打开时的遮罩 -->
      <div v-if="isMobile && mobileMenuVisible" class="sidebar-mask" @click="mobileMenuVisible = false" />

      <main ref="appMainRef" class="app-main">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-wrapper {
  /* 移动端 100vh 是「地址栏隐藏后」的大高度,会比可视区高,导致整页可滚动;
     键盘/地址栏滚动后跳转,导航栏会被顶出屏幕。dvh 跟随可视区高度,不支持时退回 vh。 */
  height: 100vh;
  height: 100dvh;
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

/* 语言切换 ↔ 个人头像 的分隔线(参考 client) */
.menu-divider {
  width: 1px;
  height: 32px;
  margin: 0 8px;
  flex-shrink: 0;
  background-color: #f1f1f1;
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
  /* 行高必须跟 item 同高:否则文字的行盒会比 item 高(EP 默认 56px),
     点按高亮/选中背景画在行盒上就会「高出一下」闪 */
  line-height: 46px;
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

/* 移动端导航栏的汉堡按钮 */
.mobile-toggle {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: var(--color-text-1);
  cursor: pointer;
  transition: background 0.2s;
}

.mobile-toggle:active {
  background: var(--color-bg-bottom);
}

/* 移动端:侧栏变成从导航栏下方「往下拉出」的面板,内容超高时内部滚动 */
.sidebar.is-mobile {
  position: fixed;
  top: 80px;
  left: 0;
  right: 0;
  width: 100%;
  max-height: calc(100vh - 80px);
  max-height: calc(100dvh - 80px);
  /* 收起时整体上移到导航栏后面藏起来(z-index 低于导航栏);多移 12px 保证缝隙也不露 */
  transform: translateY(calc(-100% - 12px));
  transition: transform 0.28s ease;
  border-radius: 0 0 18px 18px;
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
  z-index: 9;
}

.sidebar.is-mobile.is-open {
  transform: translateY(0);
}

/* 移动端面板头部:标题 + 右上角关闭按钮 */
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 4px;
}

.panel-head-title {
  font-size: 13px;
  color: var(--color-text-3);
}

.panel-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-bg-bottom);
  color: var(--color-text-2);
  cursor: pointer;
  transition: background 0.2s;
}

.panel-close:active {
  background: var(--color-border);
}

/* 面板遮罩:点击关闭 */
.sidebar-mask {
  position: fixed;
  top: 80px;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 8;
  background: rgba(0, 0, 0, 0.35);
  animation: mask-fade-in 0.2s ease;
}

@keyframes mask-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .navbar {
    height: 64px;
    padding: 0 12px 0 0;
  }

  .navbar-left {
    padding-left: 10px;
    gap: 8px;
  }

  .logo-text {
    font-size: 17px;
  }

  .navbar-right {
    gap: 4px;
  }

  .menu-divider {
    height: 24px;
    margin: 0 4px;
  }

  /* 面板顶到 64px 的导航栏下沿,最大高度随视口 */
  .sidebar.is-mobile,
  .sidebar-mask {
    top: 64px;
  }

  /* 面板与导航栏留 8px 间距 + 左右 12px 外边距,做成浮层卡片 */
  .sidebar.is-mobile {
    top: 72px;
    left: 12px;
    right: 12px;
    width: auto;
    max-height: calc(100vh - 88px);
    max-height: calc(100dvh - 88px);
    border-radius: 16px;
  }

  .username {
    display: none;
  }

  .app-main {
    padding: 12px;
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
}
</style>

<style>
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
