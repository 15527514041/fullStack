<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { getUsers, updateUserRole, updateUserStatus } from '@/api/admin'
import { useAuthStore } from '@/stores/auth'
import { useIsMobile } from '@/composables/useIsMobile'
import { useInfiniteScroll } from '@/composables/useInfiniteScroll'
import { formatDateTime } from '@/utils/datetime'
import type { AdminUser } from '@/types'

const authStore = useAuthStore()
const { t } = useI18n()
const { isMobile } = useIsMobile()

const users = ref<AdminUser[]>([])
const total = ref(0)
const loading = ref(false)
const loadingMore = ref(false)
const sentinelRef = ref<HTMLElement | null>(null)
const hasMore = computed(() => users.value.length < total.value)

const query = reactive({
  page: 1,
  pageSize: 10,
  keyword: ''
})

async function loadUsers(append = false): Promise<void> {
  if (append) loadingMore.value = true
  else loading.value = true
  try {
    const result = await getUsers({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword.trim() || undefined
    })
    users.value = append ? [...users.value, ...result.list] : result.list
    total.value = result.total
  } catch {
    // 错误提示已在 axios 拦截器统一处理;追加失败时回退页码,避免漏数据
    if (append && query.page > 1) query.page -= 1
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

// 移动端:滑到底部自动加载下一页(替代分页器)
useInfiniteScroll(sentinelRef, () => {
  if (!isMobile.value || loading.value || loadingMore.value || !hasMore.value) return
  query.page += 1
  loadUsers(true)
})

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
    ElMessage.success(
      t('userAdmin.roleUpdated', {
        name: user.username,
        role: user.role === 'ADMIN' ? t('common.roleAdmin') : t('common.roleUser')
      })
    )
  } catch {
    await loadUsers() // 失败回滚显示
  }
}

async function handleStatusChange(user: AdminUser): Promise<void> {
  try {
    await updateUserStatus(user.id, user.status)
    ElMessage.success(
      user.status === 'BANNED'
        ? t('userAdmin.banned', { name: user.username })
        : t('userAdmin.activated', { name: user.username })
    )
  } catch {
    await loadUsers()
  }
}

onMounted(loadUsers)
</script>

<template>
  <div class="list-page">
    <div class="page-header">
      <div class="title-section">
        <div class="page-title">{{ $t('userAdmin.title') }}</div>
        <div class="page-subtitle">{{ $t('userAdmin.tip') }}</div>
      </div>
    </div>

    <div class="filter-bar">
      <el-input
        v-model="query.keyword"
        :placeholder="$t('userAdmin.searchPlaceholder')"
        clearable
        class="search-input"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-button type="primary" @click="handleSearch">{{ $t('common.search') }}</el-button>
      <el-button class="reset-btn" @click="handleReset">{{ $t('common.reset') }}</el-button>
    </div>

    <el-skeleton v-if="loading && users.length === 0" :rows="6" animated class="list-skeleton" />

    <!-- 移动端:卡片列表(角色/状态直接在卡片里操作) -->
    <div v-else-if="isMobile" class="card-list">
      <el-empty v-if="users.length === 0" :description="$t('userAdmin.empty')" />

      <div v-for="row in users" :key="row.id" class="list-card">
        <div class="card-head">
          <div class="card-title">{{ row.username }}</div>
          <span class="card-id">#{{ row.id }}</span>
        </div>

        <div class="card-field">
          <span class="card-field-label">{{ $t('userAdmin.colRole') }}</span>
          <el-select
            v-model="row.role"
            size="small"
            :disabled="row.id === authStore.user?.id"
            style="width: 130px"
            @change="handleRoleChange(row)"
          >
            <el-option :label="$t('common.roleUser')" value="USER" />
            <el-option :label="$t('common.roleAdmin')" value="ADMIN" />
          </el-select>
        </div>

        <div class="card-field">
          <span class="card-field-label">{{ $t('userAdmin.colStatus') }}</span>
          <el-switch
            v-model="row.status"
            active-value="ACTIVE"
            inactive-value="BANNED"
            :active-text="$t('common.enabled')"
            :inactive-text="$t('common.disabled')"
            inline-prompt
            :disabled="row.id === authStore.user?.id"
            @change="handleStatusChange(row)"
          />
        </div>

        <div class="card-meta">
          <span>{{ $t('userAdmin.colTodoCount') }}:{{ row._count.todos }}</span>
          <span>{{ $t('userAdmin.colCreatedAt') }}:{{ formatDateTime(row.createdAt) }}</span>
        </div>
      </div>
    </div>

    <el-table v-else :data="users">
      <el-table-column prop="id" :label="$t('userAdmin.colId')" width="70" />

      <el-table-column prop="username" :label="$t('userAdmin.colUsername')" min-width="140" />

      <el-table-column :label="$t('userAdmin.colRole')" width="150">
        <template #default="{ row }">
          <el-select
            v-model="row.role"
            size="small"
            :disabled="row.id === authStore.user?.id"
            @change="handleRoleChange(row)"
          >
            <el-option :label="$t('common.roleUser')" value="USER" />
            <el-option :label="$t('common.roleAdmin')" value="ADMIN" />
          </el-select>
        </template>
      </el-table-column>

      <el-table-column :label="$t('userAdmin.colStatus')" width="130" align="center">
        <template #default="{ row }">
          <el-switch
            v-model="row.status"
            active-value="ACTIVE"
            inactive-value="BANNED"
            :active-text="$t('common.enabled')"
            :inactive-text="$t('common.disabled')"
            inline-prompt
            :disabled="row.id === authStore.user?.id"
            @change="handleStatusChange(row)"
          />
        </template>
      </el-table-column>

      <el-table-column :label="$t('userAdmin.colTodoCount')" width="110" align="center">
        <template #default="{ row }">{{ row._count.todos }}</template>
      </el-table-column>

      <el-table-column :label="$t('userAdmin.colCreatedAt')" width="180">
        <template #default="{ row }">
          {{ formatDateTime(row.createdAt) }}
        </template>
      </el-table-column>

      <template #empty>
        <el-empty :description="$t('userAdmin.empty')" />
      </template>
    </el-table>

    <!-- 移动端:上拉加载(替代分页器) -->
    <div v-if="isMobile" ref="sentinelRef" class="load-more-sentinel">
      <span v-if="loadingMore">{{ $t('common.loading') }}</span>
      <span v-else-if="!hasMore && users.length > 0">{{ $t('common.noMore') }}</span>
    </div>

    <div v-if="!isMobile && users.length > 0" class="pagination-container">
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
  </div>
</template>

<style scoped>

.search-input {
  width: 240px;
}

@media (max-width: 768px) {
  .search-input {
    width: 100%;
  }
}
</style>
