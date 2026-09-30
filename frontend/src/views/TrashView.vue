<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getTodos, restoreTodo } from '@/api/todo'
import type { Todo } from '@/types'

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
    ElMessage.success('已恢复')
    await loadTrash()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  }
}

onMounted(loadTrash)
</script>

<template>
  <el-card>
    <div class="tip">回收站里的 TODO 仍然保存在数据库中,点击「恢复」即可回到列表。</div>

    <el-table v-loading="loading" :data="todos" empty-text="回收站是空的">
      <el-table-column label="内容" min-width="240">
        <template #default="{ row }">
          <span class="title">{{ row.title }}</span>
        </template>
      </el-table-column>

      <el-table-column label="标签" min-width="140">
        <template #default="{ row }">
          <el-tag v-for="tag in row.tags" :key="tag.id" class="tag-item" type="info">{{ tag.name }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column label="删除时间" width="180">
        <template #default="{ row }">
          {{ row.deletedAt ? new Date(row.deletedAt).toLocaleString() : '-' }}
        </template>
      </el-table-column>

      <el-table-column label="操作" width="100" align="center">
        <template #default="{ row }">
          <el-button link type="primary" @click="handleRestore(row)">恢复</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="loadTrash"
      />
    </div>
  </el-card>
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

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>