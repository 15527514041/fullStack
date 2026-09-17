<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getUsers, updateUserRole } from '@/api/admin'
import { useAuthStore } from '@/stores/auth'
import type { AdminUser } from '@/types'

const router = useRouter()
const authStore = useAuthStore()

const users = ref<AdminUser[]>([])
const loading = ref(false)
const isMobile = ref(false)

function updateIsMobile(): void {
  isMobile.value = window.matchMedia('(max-width: 768px)').matches
}

async function loadUsers(): Promise<void> {
  loading.value = true
  try {
    users.value = await getUsers()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  } finally {
    loading.value = false
  }
}

// v-model 已把新角色写入 row.role,这里直接提交
async function handleRoleChange(user: AdminUser): Promise<void> {
  try {
    await updateUserRole(user.id, user.role)
    ElMessage.success(
      `已将「${user.username}」设为 ${user.role === 'ADMIN' ? '管理员' : '普通用户'}`
    )
  } catch {
    await loadUsers() // 失败时回滚显示
  }
}

function handleLogout(): void {
  authStore.logout()
  router.replace('/login')
}

onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  loadUsers()
})

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile)
})
</script>

<template>
  <el-container class="admin-page">
    <el-header class="admin-header">
      <span class="admin-title">用户管理</span>
      <div class="header-actions">
        <el-button text @click="router.push('/')">TODO 列表</el-button>
        <el-button text @click="handleLogout">退出登录</el-button>
      </div>
    </el-header>

    <el-main>
      <el-card>
        <div class="table-wrapper">
          <el-table v-loading="loading" :data="users" empty-text="暂无用户">
            <el-table-column prop="id" label="ID" width="70" />

            <el-table-column prop="username" label="用户名" min-width="140" />

            <el-table-column label="角色" width="150">
              <template #default="{ row }">
                <el-select
                  v-model="row.role"
                  size="small"
                  :disabled="row.id === authStore.user?.id"
                  @change="handleRoleChange(row)"
                >
                  <el-option label="普通用户" value="USER" />
                  <el-option label="管理员" value="ADMIN" />
                </el-select>
              </template>
            </el-table-column>

            <el-table-column label="TODO 数量" width="110" align="center">
              <template #default="{ row }">{{ row._count.todos }}</template>
            </el-table-column>

            <el-table-column v-if="!isMobile" label="注册时间" width="180">
              <template #default="{ row }">
                {{ new Date(row.createdAt).toLocaleString() }}
              </template>
            </el-table-column>
          </el-table>
        </div>

        <p class="tip">提示:不能修改自己的角色,避免把自己降级后失去管理权限。</p>
      </el-card>
    </el-main>
  </el-container>
</template>

<style scoped>
.admin-page {
  min-height: 100vh;
  background: #f5f7fa;
}

.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}

.admin-title {
  font-size: 18px;
  font-weight: 600;
}

.table-wrapper {
  overflow-x: auto;
}

.tip {
  margin: 12px 0 0;
  font-size: 12px;
  color: #909399;
}

@media (max-width: 768px) {
  .admin-header {
    padding: 0 12px;
  }

  .admin-title {
    font-size: 16px;
  }
}
</style>