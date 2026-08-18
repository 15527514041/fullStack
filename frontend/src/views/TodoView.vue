<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { createTodo, deleteTodo, getTodos, updateTodo } from '@/api/todo'
import { useAuthStore } from '@/stores/auth'
import type { Todo } from '@/types'

const router = useRouter()
const authStore = useAuthStore()

const todos = ref<Todo[]>([])
const loading = ref(false)

const editingId = ref<number | null>(null)
const editingTitle = ref('')

// 添加 TODO 弹窗
const addDialogVisible = ref(false)
const submitting = ref(false)
const addFormRef = ref<FormInstance>()
const addForm = reactive({
  title: ''
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

function openAddDialog(): void {
  addForm.title = ''
  addFormRef.value?.clearValidate()
  addDialogVisible.value = true
}

async function handleAddSubmit(): Promise<void> {
  if (!addFormRef.value) return
  const valid = await addFormRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    await createTodo(addForm.title.trim())
    addDialogVisible.value = false
    ElMessage.success('添加成功')
    await loadTodos()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  } finally {
    submitting.value = false
  }
}

async function loadTodos(): Promise<void> {
  loading.value = true
  try {
    todos.value = await getTodos()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  } finally {
    loading.value = false
  }
}

async function handleToggle(todo: Todo): Promise<void> {
  try {
    await updateTodo(todo.id, { completed: todo.completed })
  } catch {
    // 失败时回滚显示状态
    await loadTodos()
  }
}

function startEdit(todo: Todo): void {
  editingId.value = todo.id
  editingTitle.value = todo.title
}

function cancelEdit(): void {
  editingId.value = null
  editingTitle.value = ''
}

async function handleEditSave(todo: Todo): Promise<void> {
  const title = editingTitle.value.trim()
  if (!title) {
    ElMessage.warning('内容不能为空')
    return
  }
  try {
    await updateTodo(todo.id, { title })
    editingId.value = null
    await loadTodos()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  }
}

async function handleDelete(todo: Todo): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除「${todo.title}」吗?`, '提示', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return // 用户取消
  }

  try {
    await deleteTodo(todo.id)
    ElMessage.success('删除成功')
    await loadTodos()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  }
}

function handleLogout(): void {
  authStore.logout()
  router.replace('/login')
}

onMounted(loadTodos)
</script>

<template>
  <el-container class="todo-page">
    <el-header class="todo-header">
      <span class="todo-title">我的 TODO</span>
      <el-button text @click="handleLogout">退出登录</el-button>
    </el-header>

    <el-main>
      <el-card>
        <div class="toolbar">
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
                @blur="handleEditSave(row)"
              />
              <span v-else :class="{ 'todo-done': row.completed }">{{ row.title }}</span>
            </template>
          </el-table-column>

          <el-table-column label="创建时间" width="180">
            <template #default="{ row }">
              {{ new Date(row.createdAt).toLocaleString() }}
            </template>
          </el-table-column>

          <el-table-column label="操作" width="140" align="center">
            <template #default="{ row }">
              <el-button v-if="editingId !== row.id" link type="primary" @click="startEdit(row)">编辑</el-button>
              <el-button v-else link @click="cancelEdit">取消</el-button>
              <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </el-main>

    <el-dialog v-model="addDialogVisible" title="添加 TODO" width="480px">
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
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleAddSubmit">确定</el-button>
      </template>
    </el-dialog>
  </el-container>
</template>

<style scoped>
.todo-page {
  min-height: 100vh;
  background: #f5f7fa;
}

.todo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}

.todo-title {
  font-size: 18px;
  font-weight: 600;
}

.toolbar {
  margin-bottom: 16px;
}

.todo-done {
  color: #909399;
  text-decoration: line-through;
}
</style>