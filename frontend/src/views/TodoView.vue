<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { createTodo, deleteTodo, getTodos, updateTodo } from '@/api/todo'
import { getTags } from '@/api/tags'
import type { TagItem, Todo } from '@/types'

const todos = ref<Todo[]>([])
const tags = ref<TagItem[]>([])
const total = ref(0)
const loading = ref(false)

const query = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  tagId: undefined as number | undefined
})

// 新增 / 编辑弹窗:editingTodoId 为 null 表示新增
const dialogVisible = ref(false)
const editingTodoId = ref<number | null>(null)
const submitting = ref(false)
const formRef = ref<FormInstance>()
const form = reactive({
  title: '',
  tagIds: [] as number[]
})

const dialogTitle = computed(() => (editingTodoId.value === null ? '添加 TODO' : '编辑 TODO'))

const rules: FormRules = {
  title: [
    {
      required: true,
      validator: (_rule, value: string, callback) => {
        if (!value || !value.trim()) {
          callback(new Error('请输入 TODO 内容'))
        } else if (value.trim().length > 100) {
          callback(new Error('长度不能超过 100 个字符'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

async function loadTags(): Promise<void> {
  try {
    tags.value = await getTags()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  }
}

async function loadTodos(): Promise<void> {
  loading.value = true
  try {
    const result = await getTodos({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword.trim() || undefined,
      tagId: query.tagId
    })
    todos.value = result.list
    total.value = result.total
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  } finally {
    loading.value = false
  }
}

function openAddDialog(): void {
  editingTodoId.value = null
  form.title = ''
  form.tagIds = []
  formRef.value?.clearValidate()
  dialogVisible.value = true
}

// 编辑复用同一个弹窗:回显内容与标签
function openEditDialog(todo: Todo): void {
  editingTodoId.value = todo.id
  form.title = todo.title
  form.tagIds = (todo.tags || []).map((tag) => tag.id)
  formRef.value?.clearValidate()
  dialogVisible.value = true
}

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const payload = { title: form.title.trim(), tagIds: form.tagIds }
    if (editingTodoId.value === null) {
      await createTodo(payload)
      ElMessage.success('添加成功')
    } else {
      await updateTodo(editingTodoId.value, payload)
      ElMessage.success('已保存')
    }
    dialogVisible.value = false
    await loadTodos()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  } finally {
    submitting.value = false
  }
}

function handleSearch(): void {
  query.page = 1
  loadTodos()
}

function handleReset(): void {
  query.keyword = ''
  query.tagId = undefined
  query.page = 1
  loadTodos()
}

async function handleToggle(todo: Todo): Promise<void> {
  try {
    await updateTodo(todo.id, { completed: todo.completed })
  } catch {
    await loadTodos() // 失败时回滚显示
  }
}

async function handleDelete(todo: Todo): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除「${todo.title}」吗?删除后可在回收站恢复`, '提示', {
      type: 'warning',
      showClose: false,
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return // 用户取消
  }

  try {
    await deleteTodo(todo.id)
    ElMessage.success('已移入回收站')
    await loadTodos()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  }
}

onMounted(() => {
  loadTags()
  loadTodos()
})
</script>

<template>
  <div class="list-page">
    <div class="page-header">
      <div class="page-title">TODO 列表</div>
      <el-button type="primary" @click="openAddDialog">
        <el-icon><Plus /></el-icon>
        添加 TODO
      </el-button>
    </div>

    <div class="filter-bar">
      <el-input
        v-model="query.keyword"
        placeholder="搜索 TODO"
        clearable
        class="search-input"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />

      <el-select
        v-model="query.tagId"
        placeholder="按标签筛选"
        clearable
        class="tag-select"
        @change="handleSearch"
      >
        <el-option v-for="tag in tags" :key="tag.id" :label="tag.name" :value="tag.id" />
      </el-select>

      <el-button type="primary" @click="handleSearch">查询</el-button>
      <el-button class="reset-btn" @click="handleReset">重置</el-button>
    </div>

    <el-skeleton v-if="loading && todos.length === 0" :rows="6" animated class="list-skeleton" />

    <el-table v-else :data="todos">
      <el-table-column label="完成" width="80" align="center">
        <template #default="{ row }">
          <el-switch v-model="row.completed" @change="handleToggle(row)" />
        </template>
      </el-table-column>

      <el-table-column label="内容" min-width="220">
        <template #default="{ row }">
          <span :class="{ 'todo-done': row.completed }">{{ row.title }}</span>
        </template>
      </el-table-column>

      <el-table-column label="标签" min-width="160">
        <template #default="{ row }">
          <el-tag v-for="tag in row.tags" :key="tag.id" class="tag-item" type="info">{{ tag.name }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">
          {{ new Date(row.createdAt).toLocaleString() }}
        </template>
      </el-table-column>

      <el-table-column label="操作" width="160" align="center">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
          <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>

      <template #empty>
        <el-empty description="还没有 TODO,点击「添加 TODO」创建一条" />
      </template>
    </el-table>

    <div v-if="todos.length > 0" class="pagination-container">
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="loadTodos"
        @size-change="handleSearch"
      />
    </div>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="min(640px, 94vw)" :show-close="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="内容" prop="title">
          <el-input
            v-model="form.title"
            placeholder="请输入 TODO 内容"
            maxlength="100"
            show-word-limit
            @keyup.enter="handleSubmit"
          />
        </el-form-item>
        <el-form-item label="标签">
          <el-select v-model="form.tagIds" multiple collapse-tags placeholder="可选" style="width: 100%">
            <el-option v-for="tag in tags" :key="tag.id" :label="tag.name" :value="tag.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>

.search-input {
  width: 210px;
}

.tag-select {
  width: 210px;
}

.tag-item {
  margin-right: 6px;
}


.todo-done {
  color: #909399;
  text-decoration: line-through;
}

@media (max-width: 768px) {
  .search-input,
  .tag-select {
    width: 100%;
  }
}
</style>
