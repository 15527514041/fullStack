<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Collection, Delete, List, SwitchButton, User } from '@element-plus/icons-vue'
import { uploadAvatar } from '@/api/user'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const collapsed = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const menus = computed(() => {
  const items = [
    { path: '/', title: 'TODO 列表', icon: List },
    { path: '/trash', title: '回收站', icon: Delete },
    { path: '/tags', title: '标签管理', icon: Collection }
  ]
  if (authStore.isAdmin) {
    items.push({ path: '/admin', title: '用户管理', icon: User })
  }
  return items
})

const activeMenu = computed(() => route.path)
const avatarUrl = computed(() => authStore.user?.avatarUrl || '')
const usernameInitial = computed(() => (authStore.user?.username || 'U').charAt(0).toUpperCase())

function updateIsMobile(): void {
  const mobile = window.matchMedia('(max-width: 768px)').matches
  collapsed.value = mobile
}

function chooseAvatar(): void {
  fileInputRef.value?.click()
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

function handleLogout(): void {
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
  <el-container class="layout">
    <el-aside :width="collapsed ? '64px' : '220px'" class="layout-aside">
      <div class="logo">{{ collapsed ? 'F' : 'Fullstack TODO' }}</div>
      <el-menu :default-active="activeMenu" :collapse="collapsed" router class="layout-menu">
        <el-menu-item v-for="item in menus" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="layout-header">
        <el-button text @click="collapsed = !collapsed">{{ collapsed ? '展开菜单' : '收起菜单' }}</el-button>

        <div class="user-area">
          <el-avatar
            :size="30"
            :src="avatarUrl"
            class="user-avatar"
            title="点击更换头像"
            @click="chooseAvatar"
          >
            {{ usernameInitial }}
          </el-avatar>
          <input ref="fileInputRef" type="file" accept="image/*" class="hidden-input" @change="handleAvatarChange" />
          <span class="username">{{ authStore.user?.username || '用户' }}</span>
          <el-button text :icon="SwitchButton" @click="handleLogout">退出登录</el-button>
        </div>
      </el-header>

      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout {
  min-height: 100vh;
}

.layout-aside {
  background: #fff;
  border-right: 1px solid #e4e7ed;
  transition: width 0.2s;
  overflow: hidden;
}

.logo {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: var(--el-color-primary);
  white-space: nowrap;
}

.layout-menu {
  border-right: none;
}

.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}

.user-area {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.user-avatar {
  cursor: pointer;
  background: var(--el-color-primary);
  flex-shrink: 0;
}

.username {
  max-width: 120px;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hidden-input {
  display: none;
}

.layout-main {
  background: var(--page-bg);
}

@media (max-width: 768px) {
  .username {
    display: none;
  }

  .layout-header {
    padding: 0 8px;
  }
}
</style>