<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { createTodo, deleteTodo, getTodos, updateTodo } from '@/api/todo'
import { getTags } from '@/api/tags'
import { useIsMobile } from '@/composables/useIsMobile'
import { useInfiniteScroll } from '@/composables/useInfiniteScroll'
import { formatDateTime } from '@/utils/datetime'
import OssUploader from '@/components/OssUploader.vue'
import OssAttachmentPreview from '@/components/OssAttachmentPreview.vue'
import type { TagItem, Todo } from '@/types'

const { t } = useI18n()
const { isMobile } = useIsMobile()

const todos = ref<Todo[]>([])
const tags = ref<TagItem[]>([])
const total = ref(0)
const loading = ref(false)
const loadingMore = ref(false)
const sentinelRef = ref<HTMLElement | null>(null)
const hasMore = computed(() => todos.value.length < total.value)

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
  remark: '',
  attachmentOssIds: [] as string[],
  tagIds: [] as number[]
})

const dialogTitle = computed(() => (editingTodoId.value === null ? t('todo.dialogAdd') : t('todo.dialogEdit')))

// 校验文案跟随语言,切换语言后重新生成
const rules = computed<FormRules>(() => ({
  title: [
    {
      required: true,
      validator: (_rule, value: string, callback) => {
        if (!value || !value.trim()) {
          callback(new Error(t('validation.todoTitleRequired')))
        } else if (value.trim().length > 100) {
          callback(new Error(t('validation.todoTitleLength')))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}))

async function loadTags(): Promise<void> {
  try {
    tags.value = await getTags()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  }
}

async function loadTodos(append = false): Promise<void> {
  if (append) loadingMore.value = true
  else loading.value = true
  try {
    const result = await getTodos({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword.trim() || undefined,
      tagId: query.tagId
    })
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
  loadTodos(true)
})

function openAddDialog(): void {
  editingTodoId.value = null
  form.title = ''
  form.remark = ''
  form.attachmentOssIds = []
  form.tagIds = []
  formRef.value?.clearValidate()
  dialogVisible.value = true
}

// 编辑复用同一个弹窗:回显内容、备注、附件与标签
function openEditDialog(todo: Todo): void {
  editingTodoId.value = todo.id
  form.title = todo.title
  form.remark = todo.remark || ''
  form.attachmentOssIds = (todo.attachments || []).map((item) => item.ossId)
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
    const payload = {
      title: form.title.trim(),
      // 备注空串统一传 null(后端也做了归一化)
      remark: form.remark.trim() || null,
      attachmentOssIds: form.attachmentOssIds,
      tagIds: form.tagIds
    }
    if (editingTodoId.value === null) {
      await createTodo(payload)
      ElMessage.success(t('todo.created'))
    } else {
      await updateTodo(editingTodoId.value, payload)
      ElMessage.success(t('todo.saved'))
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

// 附件列的 ossId 列表(后端已按 sortOrder 排好)
function attachmentIds(todo: Todo): string[] {
  return (todo.attachments || []).map((item) => item.ossId)
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
    await ElMessageBox.confirm(t('todo.deleteConfirm', { title: todo.title }), t('common.tip'), {
      type: 'warning',
      showClose: false,
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel')
    })
  } catch {
    return // 用户取消
  }

  try {
    await deleteTodo(todo.id)
    ElMessage.success(t('todo.deleted'))
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
      <div class="page-title">{{ $t('todo.title') }}</div>
      <el-button type="primary" @click="openAddDialog">
        <el-icon><Plus /></el-icon>
        {{ $t('todo.addButton') }}
      </el-button>
    </div>

    <div class="filter-bar">
      <el-input
        v-model="query.keyword"
        :placeholder="$t('todo.searchPlaceholder')"
        clearable
        class="search-input"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />

      <el-select
        v-model="query.tagId"
        :placeholder="$t('todo.tagFilterPlaceholder')"
        clearable
        class="tag-select"
        @change="handleSearch"
      >
        <el-option v-for="tag in tags" :key="tag.id" :label="tag.name" :value="tag.id" />
      </el-select>

      <el-button type="primary" @click="handleSearch">{{ $t('common.search') }}</el-button>
      <el-button class="reset-btn" @click="handleReset">{{ $t('common.reset') }}</el-button>
    </div>

    <el-skeleton v-if="loading && todos.length === 0" :rows="6" animated class="list-skeleton" />

    <!-- 移动端:卡片列表(字段完整、点击区域更大) -->
    <div v-else-if="isMobile" class="card-list">
      <el-empty v-if="todos.length === 0" :description="$t('todo.empty')" />

      <div v-for="row in todos" :key="row.id" class="list-card">
        <div class="card-head">
          <div class="card-title" :class="{ 'is-done': row.completed }">{{ row.title }}</div>
          <el-switch v-model="row.completed" @change="handleToggle(row)" />
        </div>

        <div v-if="row.remark" class="card-remark">{{ row.remark }}</div>

        <div v-if="row.tags && row.tags.length" class="card-tags">
          <el-tag v-for="tag in row.tags" :key="tag.id" type="info">{{ tag.name }}</el-tag>
        </div>

        <div v-if="attachmentIds(row).length" class="card-attachment">
          <OssAttachmentPreview :value="attachmentIds(row)" :size="56" :max="3" :radius="8" />
        </div>

        <div class="card-meta">
          <span>{{ $t('common.createdAt') }}:{{ formatDateTime(row.createdAt) }}</span>
        </div>

        <div class="card-actions">
          <el-button link type="primary" @click="openEditDialog(row)">{{ $t('common.edit') }}</el-button>
          <el-button link type="danger" @click="handleDelete(row)">{{ $t('common.delete') }}</el-button>
        </div>
      </div>
    </div>

    <el-table v-else :data="todos">
      <el-table-column :label="$t('todo.colDone')" width="80" align="center">
        <template #default="{ row }">
          <el-switch v-model="row.completed" @change="handleToggle(row)" />
        </template>
      </el-table-column>

      <el-table-column :label="$t('todo.colTitle')" min-width="220">
        <template #default="{ row }">
          <div class="todo-title-cell">
            <span :class="{ 'todo-done': row.completed }">{{ row.title }}</span>
            <span v-if="row.remark" class="todo-remark">{{ row.remark }}</span>
          </div>
        </template>
      </el-table-column>

      <el-table-column :label="$t('todo.colTags')" min-width="140">
        <template #default="{ row }">
          <el-tag v-for="tag in row.tags" :key="tag.id" class="tag-item" type="info">{{ tag.name }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column :label="$t('todo.colAttachment')" width="170" class-name="cell-attachment">
        <template #default="{ row }">
          <OssAttachmentPreview v-if="attachmentIds(row).length" :value="attachmentIds(row)" :size="36" :max="3" :radius="6" />
          <span v-else class="todo-empty-cell">-</span>
        </template>
      </el-table-column>

      <el-table-column :label="$t('common.createdAt')" width="170">
        <template #default="{ row }">
          {{ formatDateTime(row.createdAt) }}
        </template>
      </el-table-column>

      <el-table-column :label="$t('common.actions')" width="160" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEditDialog(row)">{{ $t('common.edit') }}</el-button>
          <el-button link type="danger" @click="handleDelete(row)">{{ $t('common.delete') }}</el-button>
        </template>
      </el-table-column>

      <template #empty>
        <el-empty :description="$t('todo.empty')" />
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
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="loadTodos"
        @size-change="handleSearch"
      />
    </div>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="min(640px, 94vw)" :show-close="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item :label="$t('todo.formTitle')" prop="title">
          <el-input
            v-model="form.title"
            :placeholder="$t('todo.titlePlaceholder')"
            maxlength="100"
            show-word-limit
            @keyup.enter="handleSubmit"
          />
        </el-form-item>

        <el-form-item :label="$t('todo.formRemark')">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            :placeholder="$t('todo.remarkPlaceholder')"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <el-form-item :label="$t('todo.formTags')">
          <el-select v-model="form.tagIds" multiple collapse-tags :placeholder="$t('common.optional')" style="width: 100%">
            <el-option v-for="tag in tags" :key="tag.id" :label="tag.name" :value="tag.id" />
          </el-select>
        </el-form-item>

        <el-form-item :label="$t('todo.formAttachment')">
          <OssUploader
            v-model="form.attachmentOssIds"
            folder="todos"
            visibility="PRIVATE"
            :limit="9"
            :max-size-mb="10"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ $t('common.confirm') }}</el-button>
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

/* 内容列:标题 + 备注(小字两行) */
.todo-title-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.todo-remark {
  font-size: 12px;
  line-height: 18px;
  color: var(--color-text-3);
  word-break: break-word;
}

.todo-empty-cell {
  color: var(--color-text-4);
}

/* 附件列:内容垂直居中(单元格比内容高时不再顶到上边) */
:deep(.cell-attachment .cell) {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 卡片里的备注与附件缩略图 */
.card-remark {
  margin-top: 6px;
  font-size: 13px;
  line-height: 20px;
  color: var(--color-text-2);
  word-break: break-word;
}

.card-attachment {
  margin-top: 10px;
}

@media (max-width: 768px) {
  .search-input,
  .tag-select {
    width: 100%;
  }
}
</style>
