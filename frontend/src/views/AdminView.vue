<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getUsers, updateUserRole, updateUserStatus } from '@/api/admin'
import { useAuthStore } from '@/stores/auth'
import type { AdminUser } from '@/types'

const authStore = useAuthStore()

const users = ref<AdminUser[]>([])
const total = ref(0)
const loading = ref(false)

const query = reactive({
  page: 1,
  pageSize: 10,
  keyword: ''
})

async function loadUsers(): Promise<void> {
  loading.value = true
  try {
    const result = await getUsers({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword.trim() || undefined
    })
    users.value = result.list
    total.value = result.total
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  } finally {
    loading.value = false
  }
}

function handleSearch(): void {
  query.page = 1
  loadUsers()
}

function handleReset(): void {
  query.keyword = ''
  query.page = 1
  loadUsers()
}

async function handleRoleChange(user: AdminUser): Promise<void> {
  try {
    await updateUserRole(user.id, user.role)
    ElMessage.success(`已将「${user.username}」设为 ${user.role === 'ADMIN' ? '管理员' : '普通用户'}`)
  } catch {
    await loadUsers() // 失败回滚显示
  }
}

async function handleStatusChange(user: AdminUser): Promise<void> {
  try {
    await updateUserStatus(user.id, user.status)
    ElMessage.success(user.status === 'BANNED' ? `已禁用「${user.username}」` : `已启用「${user.username}」`)
  } catch {
    await loadUsers()
  }
}

onMounted(loadUsers)
</script>

<template>
  <div class="list-page">
    <div class="page-title">用户管理</div>
    <div class="filter-bar">
      <el-input
        v-model="query.keyword"
        placeholder="搜索用户名"
        clearable
        class="search-input"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-button type="primary" @click="handleSearch">查询</el-button>
      <el-button class="reset-btn" @click="handleReset">重置</el-button>
    </div>

    <el-skeleton v-if="loading && users.length === 0" :rows="6" animated class="list-skeleton" />

    <el-table v-else :data="users">
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

      <el-table-column label="状态" width="130" align="center">
        <template #default="{ row }">
          <el-switch
            v-model="row.status"
            active-value="ACTIVE"
            inactive-value="BANNED"
            active-text="启用"
            inactive-text="禁用"
            inline-prompt
            :disabled="row.id === authStore.user?.id"
            @change="handleStatusChange(row)"
          />
        </template>
      </el-table-column>

      <el-table-column label="TODO 数量" width="110" align="center">
        <template #default="{ row }">{{ row._count.todos }}</template>
      </el-table-column>

      <el-table-column label="注册时间" width="180">
        <template #default="{ row }">
          {{ new Date(row.createdAt).toLocaleString() }}
        </template>
      </el-table-column>

      <template #empty>
        <el-empty description="暂无用户" />
      </template>
    </el-table>

    <div v-if="users.length > 0" class="pagination-container">
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="loadUsers"
        @size-change="handleSearch"
      />
    </div>

    <p class="tip">提示:不能修改自己的角色和状态,避免把自己锁死。</p>
  </div>
</template>

<style scoped>

.search-input {
  width: 240px;
}


.tip {
  margin: 12px 0 0;
  font-size: 12px;
  color: #909399;
}

@media (max-width: 768px) {
  .search-input {
    width: 100%;
  }
}
</style>
