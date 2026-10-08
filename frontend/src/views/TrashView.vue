<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { getTodos, restoreTodo } from '@/api/todo'
import { useIsMobile } from '@/composables/useIsMobile'
import { useInfiniteScroll } from '@/composables/useInfiniteScroll'
import { formatDateTime } from '@/utils/datetime'
import type { Todo } from '@/types'

const { t } = useI18n()
const { isMobile } = useIsMobile()

const todos = ref<Todo[]>([])
const total = ref(0)
const loading = ref(false)
const loadingMore = ref(false)
const sentinelRef = ref<HTMLElement | null>(null)
const hasMore = computed(() => todos.value.length < total.value)

const query = reactive({
  page: 1,
  pageSize: 10
})

async function loadTrash(append = false): Promise<void> {
  if (append) loadingMore.value = true
  else loading.value = true
  try {
    const result = await getTodos({ page: query.page, pageSize: query.pageSize, deleted: true })
    todos.value = append ? [...todos.value, ...result.list] : result.list
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
  loadTrash(true)
})

async function handleRestore(todo: Todo): Promise<void> {
  try {
    await restoreTodo(todo.id)
    ElMessage.success(t('trash.restored'))
    await loadTrash()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  }
}

onMounted(loadTrash)
</script>

<template>
  <div class="list-page">
    <div class="page-title">{{ $t('trash.title') }}</div>
    <div class="tip">{{ $t('trash.tip') }}</div>

    <el-skeleton v-if="loading && todos.length === 0" :rows="6" animated class="list-skeleton" />

    <!-- 移动端:卡片列表 -->
    <div v-else-if="isMobile" class="card-list">
      <el-empty v-if="todos.length === 0" :description="$t('trash.empty')" />

      <div v-for="row in todos" :key="row.id" class="list-card">
        <div class="card-head">
          <div class="card-title">{{ row.title }}</div>
        </div>

        <div v-if="row.tags && row.tags.length" class="card-tags">
          <el-tag v-for="tag in row.tags" :key="tag.id" :type="tag.type || 'primary'">{{ tag.name }}</el-tag>
        </div>

        <div class="card-meta">
          <span>{{ $t('trash.colDeletedAt') }}:{{ formatDateTime(row.deletedAt) }}</span>
        </div>

        <div class="card-actions">
          <el-button link type="primary" @click="handleRestore(row)">{{ $t('common.restore') }}</el-button>
        </div>
      </div>
    </div>

    <el-table v-else :data="todos">
      <el-table-column :label="$t('trash.colTitle')" min-width="240">
        <template #default="{ row }">
          <span class="title">{{ row.title }}</span>
        </template>
      </el-table-column>

      <el-table-column :label="$t('trash.colTags')" min-width="140">
        <template #default="{ row }">
          <el-tag v-for="tag in row.tags" :key="tag.id" class="tag-item" :type="tag.type || 'primary'">{{ tag.name }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column :label="$t('trash.colDeletedAt')" width="180">
        <template #default="{ row }">
          {{ formatDateTime(row.deletedAt) }}
        </template>
      </el-table-column>

      <el-table-column :label="$t('common.actions')" width="100" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="handleRestore(row)">{{ $t('common.restore') }}</el-button>
        </template>
      </el-table-column>

      <template #empty>
        <el-empty :description="$t('trash.empty')" />
      </template>
    </el-table>

    <!-- 移动端:上拉加载(替代分页器) -->
    <div v-if="isMobile" ref="sentinelRef" class="load-more-sentinel">
      <span v-if="loadingMore">{{ $t('common.loading') }}</span>
      <span v-else-if="!hasMore && todos.length > 0">{{ $t('common.noMore') }}</span>
    </div>

    <div v-if="!isMobile && todos.length > 0" class="pagination-container">
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="loadTrash"
      />
    </div>
  </div>
</template>

<style scoped>
.tip {
  margin-bottom: 16px;
  font-size: 13px;
  color: #909399;
}

.title {
  color: #606266;
}

.tag-item {
  margin-right: 6px;
}

</style>
