<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
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

const editingId = ref<number | null>(null)
const editingTitle = ref('')
const editingTagIds = ref<number[]>([])

// 新增弹窗
const addDialogVisible = ref(false)
const submitting = ref(false)
const addFormRef = ref<FormInstance>()
const addForm = reactive({
  title: '',
  tagIds: [] as number[]
})

const addRules: FormRules = {
  title: [
    {
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
  addForm.title = ''
  addForm.tagIds = []
  addFormRef.value?.clearValidate()
  addDialogVisible.value = true
}

async function handleAddSubmit(): Promise<void> {
  if (!addFormRef.value) return
  const valid = await addFormRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    await createTodo({ title: addForm.title.trim(), tagIds: addForm.tagIds })
    addDialogVisible.value = false
    ElMessage.success('添加成功')
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

function startEdit(todo: Todo): void {
  editingId.value = todo.id
  editingTitle.value = todo.title
  editingTagIds.value = (todo.tags || []).map((tag) => tag.id)
}

function cancelEdit(): void {
  editingId.value = null
  editingTitle.value = ''
  editingTagIds.value = []
}

async function handleEditSave(todo: Todo): Promise<void> {
  const title = editingTitle.value.trim()
  if (!title) {
    ElMessage.warning('内容不能为空')
    return
  }
  try {
    await updateTodo(todo.id, { title, tagIds: editingTagIds.value })
    editingId.value = null
    ElMessage.success('已保存')
    await loadTodos()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  }
}

async function handleDelete(todo: Todo): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除「${todo.title}」吗?删除后可在回收站恢复`, '提示', {
      type: 'warning',
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
  <el-card>
    <div class="toolbar">
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

      <el-button @click="handleReset">重置</el-button>
      <el-button type="primary" @click="openAddDialog">添加 TODO</el-button>
    </div>

    <el-table v-loading="loading" :data="todos" empty-text="还没有 TODO,点击「添加 TODO」创建一条">
      <el-table-column label="完成" width="80" align="center">
        <template #default="{ row }">
          <el-switch v-model="row.completed" @change="handleToggle(row)" />
        </template>
      </el-table-column>

      <el-table-column label="内容" min-width="220">
        <template #default="{ row }">
          <el-input
            v-if="editingId === row.id"
            v-model="editingTitle"
            size="small"
            @keyup.enter="handleEditSave(row)"
          />
          <span v-else :class="{ 'todo-done': row.completed }">{{ row.title }}</span>
        </template>
      </el-table-column>

      <el-table-column label="标签" min-width="160">
        <template #default="{ row }">
          <el-select
            v-if="editingId === row.id"
            v-model="editingTagIds"
            multiple
            size="small"
            collapse-tags
            placeholder="选择标签"
          >
            <el-option v-for="tag in tags" :key="tag.id" :label="tag.name" :value="tag.id" />
          </el-select>
          <template v-else>
            <el-tag v-for="tag in row.tags" :key="tag.id" class="tag-item" type="info">{{ tag.name }}</el-tag>
          </template>
        </template>
      </el-table-column>

      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">
          {{ new Date(row.createdAt).toLocaleString() }}
        </template>
      </el-table-column>

      <el-table-column label="操作" width="160" align="center">
        <template #default="{ row }">
          <el-button v-if="editingId !== row.id" link type="primary" @click="startEdit(row)">编辑</el-button>
          <template v-else>
            <el-button link type="primary" @click="handleEditSave(row)">保存</el-button>
            <el-button link @click="cancelEdit">取消</el-button>
          </template>
          <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination">
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

    <el-dialog v-model="addDialogVisible" title="添加 TODO" width="min(480px, 92vw)">
      <el-form ref="addFormRef" :model="addForm" :rules="addRules" label-width="60px">
        <el-form-item label="内容" prop="title">
          <el-input
            v-model="addForm.title"
            placeholder="请输入 TODO 内容"
            maxlength="100"
            show-word-limit
            @keyup.enter="handleAddSubmit"
          />
        </el-form-item>
        <el-form-item label="标签">
          <el-select v-model="addForm.tagIds" multiple collapse-tags placeholder="可选" style="width: 100%">
            <el-option v-for="tag in tags" :key="tag.id" :label="tag.name" :value="tag.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleAddSubmit">确定</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.search-input {
  width: 220px;
}

.tag-select {
  width: 180px;
}

.tag-item {
  margin-right: 6px;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  margin-top: 16px;
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