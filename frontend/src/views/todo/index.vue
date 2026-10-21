<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { createTodo, deleteTodo, getTodos, updateTodo } from '@/api/todo'
import { getTags } from '@/api/tags'
import { useIsMobile } from '@/composables/useIsMobile'
import { useInfiniteScroll } from '@/composables/useInfiniteScroll'
import { formatDate, formatDateTime, toDateString } from '@/utils/datetime'
import { DICTIONARY_CREATE_VALUE, dictionaryTabRoute } from '@/utils/dictionary'
import OssUploader from '@/components/OssUploader.vue'
import ColorDot from '@/components/ColorDot.vue'
import ColorTag from '@/components/ColorTag.vue'
import type { TagItem, Todo } from '@/types'

const { t } = useI18n()
const router = useRouter()
const { isMobile } = useIsMobile()

const todos = ref<Todo[]>([])
const tags = ref<TagItem[]>([])
const total = ref(0)
const loading = ref(false)
const loadingMore = ref(false)
const sentinelRef = ref<HTMLElement | null>(null)
const hasMore = computed(() => todos.value.length < total.value)
type DueFilter = '' | 'today' | 'next7' | 'overdue' | 'none'

const query = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  tagId: undefined as number | undefined,
  /** 时间筛选:'' = 全部(不传给后端) */
  dateRange: '',
  dueFilter: '' as DueFilter
})

// 时间筛选选项(前端维护);「过去 7 天 / 30 天」复用已有的公共文案
const dateOptions = computed(() => [
  { value: '', label: t('common.all') },
  { value: 'today', label: t('common.today') },
  { value: 'week', label: t('growth.last7') },
  { value: 'month', label: t('growth.last30') }
])

const dueFilterOptions = computed(() => [
  { value: '', label: t('todo.dueAll') },
  { value: 'today', label: t('todo.dueToday') },
  { value: 'next7', label: t('todo.dueNext7') },
  { value: 'overdue', label: t('todo.dueOverdue') },
  { value: 'none', label: t('todo.dueNone') }
])

function dateWithOffset(offset: number): string {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + offset)
  return toDateString(date)
}

/**
 * 时间筛选 → 后端参数
 * createdAt 是时间戳,这里按「用户本地时区」算出当天的起止时刻再转成 UTC ISO;
 * 选「全部」或没选都返回空对象,后端就不加时间条件
 */
function dateRangeParams(): { from?: string; to?: string } {
  if (!query.dateRange) return {}

  const start = new Date()
  start.setHours(0, 0, 0, 0)
  if (query.dateRange === 'week') start.setDate(start.getDate() - 6)
  if (query.dateRange === 'month') start.setDate(start.getDate() - 29)

  const end = new Date()
  end.setHours(23, 59, 59, 999)

  return { from: start.toISOString(), to: end.toISOString() }
}

function dueFilterParams(): {
  dueFrom?: string
  dueTo?: string
  dueDateMissing?: boolean
  completed?: boolean
} {
  if (query.dueFilter === 'today') {
    const today = dateWithOffset(0)
    return { dueFrom: today, dueTo: today }
  }
  if (query.dueFilter === 'next7') {
    return { dueFrom: dateWithOffset(0), dueTo: dateWithOffset(6) }
  }
  if (query.dueFilter === 'overdue') {
    return { dueTo: dateWithOffset(-1), completed: false }
  }
  if (query.dueFilter === 'none') {
    return { dueDateMissing: true }
  }
  return {}
}

// 新增 / 编辑弹窗:editingTodoId 为 null 表示新增
const dialogVisible = ref(false)
const editingTodoId = ref<number | null>(null)
const submitting = ref(false)
const formRef = ref<FormInstance>()
const form = reactive({
  title: '',
  dueDate: '' as string | null,
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
    // 只要任务域的标签:记账分类的标签挂不到 TODO 上,不该出现在筛选和表单里
    tags.value = await getTags({ scope: 'TODO' })
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
      tagId: query.tagId,
      ...dateRangeParams(),
      ...dueFilterParams()
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
  form.dueDate = ''
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
  form.dueDate = todo.dueDate || ''
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
      dueDate: form.dueDate || null,
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
  query.dateRange = ''
  query.dueFilter = ''
  query.page = 1
  loadTodos()
}

function handleTagFormChange(values: Array<string | number>): void {
  if (!values.includes(DICTIONARY_CREATE_VALUE)) return
  form.tagIds = values.filter((value): value is number => typeof value === 'number')
  router.push(dictionaryTabRoute('TODO'))
}

const tagOptions = computed(() =>
  tags.value.filter((tag) => tag.enabled || form.tagIds.includes(tag.id))
)

function tagColorOf(tagId: number): string {
  return tags.value.find((item) => item.id === tagId)?.color || '#0bb06d'
}

function tagChipStyle(tagId: number) {
  const color = tagColorOf(tagId)
  return {
    color,
    backgroundColor: `${color}14`,
    borderColor: `${color}33`
  }
}

function isOverdue(todo: Todo): boolean {
  return Boolean(todo.dueDate && !todo.completed && todo.dueDate < dateWithOffset(0))
}

// 详情单独一个页面(样式参考 client 的详情页)
function openDetail(todo: Todo): void {
  router.push({ name: 'todo-detail', params: { id: todo.id } })
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
        <el-option v-for="tag in tags" :key="tag.id" :label="tag.name" :value="tag.id">
          <span class="tag-option"><ColorDot :color="tag.color" />{{ tag.name }}</span>
        </el-option>
      </el-select>

      <el-select
        v-model="query.dateRange"
        class="date-select"
        :placeholder="$t('todo.dateFilterPlaceholder')"
        :value-on-clear="''"
        clearable
        @change="handleSearch"
      >
        <el-option v-for="option in dateOptions" :key="option.value" :label="option.label" :value="option.value" />
      </el-select>

      <el-select
        v-model="query.dueFilter"
        class="due-select"
        :placeholder="$t('todo.dueFilterPlaceholder')"
        :value-on-clear="''"
        clearable
        @change="handleSearch"
      >
        <el-option
          v-for="option in dueFilterOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
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
          <ColorTag v-for="tag in row.tags" :key="tag.id" :name="tag.name" :color="tag.color" />
        </div>

        <div class="card-meta">
          <span>
            {{ $t('todo.colDueDate') }}:
            <span v-if="row.dueDate" class="due-date" :class="{ 'is-overdue': isOverdue(row) }">
              {{ formatDate(row.dueDate) }}
            </span>
            <span v-else>—</span>
            <el-tag v-if="isOverdue(row)" size="small" type="danger" class="overdue-tag">
              {{ $t('todo.overdue') }}
            </el-tag>
          </span>
          <span>{{ $t('common.createdAt') }}:{{ formatDateTime(row.createdAt) }}</span>
        </div>

        <div class="card-actions">
          <el-button link type="primary" @click="openDetail(row)">{{ $t('common.detail') }}</el-button>
          <el-button link type="primary" @click="openEditDialog(row)">{{ $t('common.edit') }}</el-button>
          <el-button link type="danger" @click="handleDelete(row)">{{ $t('common.delete') }}</el-button>
        </div>
      </div>
    </div>

    <el-table v-else :data="todos">
      <el-table-column :label="$t('todo.colDone')" min-width="120" align="center">
        <template #default="{ row }">
          <el-switch v-model="row.completed" @change="handleToggle(row)" />
        </template>
      </el-table-column>

      <el-table-column :label="$t('todo.colTitle')" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">
          <span :class="{ 'todo-done': row.completed }">{{ row.title }}</span>
        </template>
      </el-table-column>

      <el-table-column :label="$t('todo.colDueDate')" min-width="150" align="center">
        <template #default="{ row }">
          <span v-if="row.dueDate" class="due-date" :class="{ 'is-overdue': isOverdue(row) }">
            {{ formatDate(row.dueDate) }}
          </span>
          <span v-else class="todo-empty-cell">—</span>
          <el-tag v-if="isOverdue(row)" size="small" type="danger" class="overdue-tag">
            {{ $t('todo.overdue') }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column :label="$t('todo.colTags')" min-width="120">
        <template #default="{ row }">
          <ColorTag v-for="tag in row.tags" :key="tag.id" :name="tag.name" :color="tag.color" class="tag-item" />
        </template>
      </el-table-column>

      <el-table-column :label="$t('common.createdAt')" min-width="120" align="center">
        <template #default="{ row }">
          {{ formatDateTime(row.createdAt) }}
        </template>
      </el-table-column>

      <el-table-column
        :label="$t('common.actions')"
        width="170"
        align="center"
        fixed="right"
        class-name="table-actions"
      >
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">{{ $t('common.detail') }}</el-button>
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

    <el-dialog
      v-model="dialogVisible"
      class="todo-edit-dialog"
      :title="dialogTitle"
      width="min(640px, 94vw)"
      :show-close="false"
    >
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

        <el-form-item :label="$t('todo.formDueDate')">
          <el-date-picker
            v-model="form.dueDate"
            type="date"
            value-format="YYYY-MM-DD"
            clearable
            style="width: 100%"
            :placeholder="$t('todo.dueDatePlaceholder')"
          />
          <div class="due-date-hint">{{ $t('todo.dueDateHint') }}</div>
        </el-form-item>

        <el-form-item :label="$t('todo.formTags')">
          <!-- 选中的标签用各自的类型颜色回显(EP 默认是一律中性灰) -->
          <el-select
            v-model="form.tagIds"
            multiple
            class="tag-multiselect"
            :placeholder="$t('common.optional')"
            style="width: 100%"
            @change="handleTagFormChange"
          >
            <template #tag="{ data, deleteTag, selectDisabled }">
              <el-tag
                v-for="item in data"
                :key="item.value"
                class="tag-multiselect__chip"
                :style="tagChipStyle(item.value)"
                :closable="!selectDisabled && !item.isDisabled"
                @close="deleteTag($event, item)"
              >
                {{ item.currentLabel }}
              </el-tag>
            </template>
            <el-option v-for="tag in tagOptions" :key="tag.id" :label="tag.name" :value="tag.id">
              <span class="tag-option"><ColorDot :color="tag.color" />{{ tag.name }}</span>
            </el-option>
            <el-option
              :value="DICTIONARY_CREATE_VALUE"
              :label="$t('dictionary.addButton', { type: $t('tag.tabTodo') })"
            >
              <span class="dictionary-add-option">
                <el-icon><Plus /></el-icon>
                {{ $t('dictionary.addButton', { type: $t('tag.tabTodo') }) }}
              </span>
            </el-option>
          </el-select>
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

/* 时间筛选:和搜索 / 标签两个筛选框等宽 */
.date-select {
  width: 210px;
}

.due-select {
  width: 210px;
}

/* 表单里的多选标签:选中项换成各自颜色的标签,多选时自动换行 */
.tag-multiselect :deep(.el-select__selection) {
  flex-wrap: wrap;
  row-gap: 4px;
}

.tag-multiselect__chip {
  height: 28px !important;
  padding: 0 10px !important;
  line-height: 28px !important;
  border-radius: 8px !important;
}

.tag-item {
  margin-right: 6px;
}


.todo-done {
  color: #909399;
  text-decoration: line-through;
}

.todo-empty-cell {
  color: var(--color-text-4);
}

.due-date {
  color: var(--color-text-2);
}

.due-date.is-overdue {
  color: var(--el-color-danger);
  font-weight: 500;
}

.overdue-tag {
  margin-left: 6px;
}

.due-date-hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 18px;
  color: var(--color-text-3);
}

/* 卡片里的备注 */
.card-remark {
  margin-top: 6px;
  font-size: 13px;
  line-height: 20px;
  color: var(--color-text-2);
  word-break: break-word;
}

.tag-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 768px) {
  .search-input,
  .tag-select,
  .date-select,
  .due-select {
    width: 100%;
  }
}
</style>

<style>
/* 计划新增/编辑弹窗:与视口上下留白,内容超高时仅表单区域滚动 */
.todo-edit-dialog.el-dialog {
  display: flex;
  max-height: 84vh;
  margin: 8vh auto !important;
  flex-direction: column;
}

.todo-edit-dialog .el-dialog__body {
  flex: 1;
  min-height: 0;
  max-height: none;
  overflow-y: auto;
}

.todo-edit-dialog .el-dialog__header,
.todo-edit-dialog .el-dialog__footer {
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .todo-edit-dialog.el-dialog {
    max-height: 90vh;
    margin: 5vh auto !important;
  }
}
</style>
