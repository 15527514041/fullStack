<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { getTodos, restoreTodo } from '@/api/todo'
import { formatDateTime } from '@/utils/datetime'
import type { Todo } from '@/types'

const { t } = useI18n()

const todos = ref<Todo[]>([])
const total = ref(0)
const loading = ref(false)

const query = reactive({
  page: 1,
  pageSize: 10
})

async function loadTrash(): Promise<void> {
  loading.value = true
  try {
    const result = await getTodos({ page: query.page, pageSize: query.pageSize, deleted: true })
    todos.value = result.list
    total.value = result.total
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  } finally {
    loading.value = false
  }
}

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

    <el-table v-else :data="todos">
      <el-table-column :label="$t('trash.colTitle')" min-width="240">
        <template #default="{ row }">
          <span class="title">{{ row.title }}</span>
        </template>
      </el-table-column>

      <el-table-column :label="$t('trash.colTags')" min-width="140">
        <template #default="{ row }">
          <el-tag v-for="tag in row.tags" :key="tag.id" class="tag-item" type="info">{{ tag.name }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column :label="$t('trash.colDeletedAt')" width="180">
        <template #default="{ row }">
          {{ formatDateTime(row.deletedAt) }}
        </template>
      </el-table-column>

      <el-table-column :label="$t('common.actions')" width="100" align="center">
        <template #default="{ row }">
          <el-button link type="primary" @click="handleRestore(row)">{{ $t('common.restore') }}</el-button>
        </template>
      </el-table-column>

      <template #empty>
        <el-empty :description="$t('trash.empty')" />
      </template>
    </el-table>

    <div v-if="todos.length > 0" class="pagination-container">
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
