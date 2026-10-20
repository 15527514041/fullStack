<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { ArrowDown, Plus } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { createTag, deleteTag, getTags, updateTag } from '@/api/tags'
import {
  createDictionary,
  deleteDictionary,
  getDictionaries,
  updateDictionary
} from '@/api/dictionaries'
import ColorDot from '@/components/ColorDot.vue'
import { useIsMobile } from '@/composables/useIsMobile'
import { formatDateTime } from '@/utils/datetime'
import type { DictionaryTab } from '@/utils/dictionary'
import type { DictionaryItem, DictionaryKind, TagItem, TagScope } from '@/types'

type DictionaryRow = TagItem | DictionaryItem

const { t } = useI18n()
const { isMobile } = useIsMobile()
const route = useRoute()
const router = useRouter()

const tabs = computed<Array<{ value: DictionaryTab; label: string }>>(() => [
  { value: 'TODO', label: t('tag.tabTodo') },
  { value: 'ACCOUNTING', label: t('tag.tabAccounting') },
  { value: 'ACCOUNT_KIND', label: t('dictionary.accountKind') },
  { value: 'EXPENSE_CATEGORY', label: t('dictionary.expenseCategory') },
  { value: 'INCOME_CATEGORY', label: t('dictionary.incomeCategory') }
])

const activeTab = ref<DictionaryTab>('TODO')
const isTagTab = computed(() => activeTab.value === 'TODO' || activeTab.value === 'ACCOUNTING')
const activeTagScope = computed<TagScope>(() => activeTab.value as TagScope)
const activeDictionaryKind = computed<DictionaryKind>(() => activeTab.value as DictionaryKind)
const activeTabLabel = computed(() => tabs.value.find((tab) => tab.value === activeTab.value)?.label || '')

const tagRows = ref<TagItem[]>([])
const dictionaryRows = ref<DictionaryItem[]>([])
const rows = computed<DictionaryRow[]>(() => (isTagTab.value ? tagRows.value : dictionaryRows.value))
const loading = ref(false)
let loadSeq = 0

const addButtonLabel = computed(() =>
  t('dictionary.addButton', { type: activeTabLabel.value })
)
const emptyDescription = computed(() =>
  t('dictionary.empty', { type: activeTabLabel.value })
)
const usageColumnLabel = computed(() => {
  if (activeTab.value === 'TODO') return t('tag.colTodoCount')
  if (activeTab.value === 'ACCOUNT_KIND') return t('dictionary.colUsageAccount')
  return t('dictionary.colUsageCategory')
})

function switchTab(tab: DictionaryTab): void {
  if (tab === activeTab.value) return
  activeTab.value = tab
  tagRows.value = []
  dictionaryRows.value = []
  router.replace({ query: { ...route.query, tab } })
  loadItems()
}

function tabFromQuery(): DictionaryTab | null {
  const value = route.query.tab
  if (typeof value !== 'string') return null
  return tabs.value.some((tab) => tab.value === value) ? (value as DictionaryTab) : null
}

async function loadItems(): Promise<void> {
  const seq = ++loadSeq
  const tab = activeTab.value
  loading.value = true
  try {
    if (tab === 'TODO' || tab === 'ACCOUNTING') {
      const list = await getTags({ scope: tab })
      if (seq === loadSeq) tagRows.value = list
    } else {
      const list = await getDictionaries(tab)
      if (seq === loadSeq) dictionaryRows.value = list
    }
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

function rowUsage(row: DictionaryRow): number {
  if (isTagTab.value) {
    const count = (row as TagItem)._count
    return activeTab.value === 'TODO' ? count?.todos || 0 : count?.ledgerItems || 0
  }
  const count = (row as DictionaryItem)._count
  return activeTab.value === 'ACCOUNT_KIND' ? count?.accounts || 0 : count?.ledgerItems || 0
}

function rowClassName(data: { row: DictionaryRow }): string {
  return data.row.enabled ? '' : 'is-off'
}

// ===== 统一的新增 / 编辑弹窗 =====
const dialogVisible = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance>()
const editingId = ref<number | null>(null)
const form = reactive({
  name: '',
  color: '#0bb06d',
  sortOrder: 0
})

const colorOptions = [
  '#0bb06d',
  '#67c23a',
  '#2d9cdb',
  '#2f80ed',
  '#9254de',
  '#bb6bd9',
  '#f2994a',
  '#e6a23c',
  '#f2c94c',
  '#eb5757',
  '#f56c6c',
  '#909399'
]

const dialogTitle = computed(() =>
  t(editingId.value === null ? 'dictionary.dialogAdd' : 'dictionary.dialogEdit', {
    type: activeTabLabel.value
  })
)
const rules = computed<FormRules>(() => ({
  name: [
    { required: true, message: t('dictionary.namePlaceholder'), trigger: 'blur' },
    { min: 1, max: 20, message: t('dictionary.namePlaceholder'), trigger: 'blur' }
  ]
}))

function openAddDialog(): void {
  const maxSort = rows.value.reduce((max, row) => Math.max(max, row.sortOrder || 0), -1)
  editingId.value = null
  form.name = ''
  form.color = '#0bb06d'
  form.sortOrder = maxSort + 1
  formRef.value?.clearValidate()
  dialogVisible.value = true
}

function openEditDialog(row: DictionaryRow): void {
  editingId.value = row.id
  form.name = row.name
  form.color = row.color || '#0bb06d'
  form.sortOrder = row.sortOrder || 0
  formRef.value?.clearValidate()
  dialogVisible.value = true
}

async function submitItem(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    if (isTagTab.value) {
      if (editingId.value === null) {
        await createTag({
          name: form.name.trim(),
          color: form.color,
          scope: activeTagScope.value,
          enabled: true,
          sortOrder: form.sortOrder
        })
      } else {
        await updateTag(editingId.value, {
          name: form.name.trim(),
          color: form.color,
          sortOrder: form.sortOrder
        })
      }
    } else if (editingId.value === null) {
      await createDictionary({
        kind: activeDictionaryKind.value,
        name: form.name.trim(),
        color: form.color,
        enabled: true,
        sortOrder: form.sortOrder
      })
    } else {
      await updateDictionary(editingId.value, {
        name: form.name.trim(),
        color: form.color,
        sortOrder: form.sortOrder
      })
    }
    dialogVisible.value = false
    ElMessage.success(editingId.value === null ? t('dictionary.created') : t('dictionary.updated'))
    await loadItems()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  } finally {
    submitting.value = false
  }
}

async function updateEnabled(row: DictionaryRow, enabled: boolean): Promise<boolean> {
  try {
    if (isTagTab.value) await updateTag(row.id, { enabled })
    else await updateDictionary(row.id, { enabled })
    row.enabled = enabled
    ElMessage.success(enabled ? t('common.enabled') : t('common.disabled'))
    return true
  } catch {
    row.enabled = !enabled
    return false
  }
}

function handleEnabledChange(row: DictionaryRow, value: unknown): void {
  updateEnabled(row, Boolean(value))
}

async function handleDelete(row: DictionaryRow): Promise<void> {
  const related = rowUsage(row)
  if (related > 0) {
    if (!row.enabled) {
      await ElMessageBox.alert(
        t('dictionary.inUseDisabled', { name: row.name, count: related }),
        t('dictionary.inUseTitle'),
        { type: 'warning', confirmButtonText: t('common.gotIt') }
      )
      return
    }

    try {
      await ElMessageBox.confirm(
        t('dictionary.inUseDisable', { name: row.name, count: related }),
        t('dictionary.inUseTitle'),
        {
          type: 'warning',
          confirmButtonText: t('dictionary.disable'),
          cancelButtonText: t('common.cancel')
        }
      )
    } catch {
      return
    }
    await updateEnabled(row, false)
    return
  }

  try {
    await ElMessageBox.confirm(
      t('dictionary.deleteConfirm', { name: row.name }),
      t('common.tip'),
      {
        type: 'warning',
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel')
      }
    )
  } catch {
    return
  }

  try {
    if (isTagTab.value) await deleteTag(row.id)
    else await deleteDictionary(row.id)
    ElMessage.success(t('dictionary.deleted'))
    await loadItems()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  }
}

onMounted(() => {
  const initialTab = tabFromQuery()
  if (initialTab) activeTab.value = initialTab
  loadItems()
})

watch(
  () => route.query.tab,
  () => {
    const tab = tabFromQuery()
    if (!tab || tab === activeTab.value) return
    activeTab.value = tab
    tagRows.value = []
    dictionaryRows.value = []
    loadItems()
  }
)
</script>

<template>
  <div class="dictionary-view">
    <div class="scope-tabs" role="tablist" :aria-label="$t('tag.title')">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        role="tab"
        class="scope-tab"
        :class="{ 'is-active': tab.value === activeTab }"
        :aria-selected="tab.value === activeTab"
        @click="switchTab(tab.value)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="list-page">
      <div class="page-header">
        <div class="page-title">{{ $t('tag.title') }}</div>
        <el-button type="primary" @click="openAddDialog">
          <el-icon><Plus /></el-icon>
          {{ addButtonLabel }}
        </el-button>
      </div>

      <el-skeleton v-if="loading && rows.length === 0" :rows="6" animated class="list-skeleton" />

      <div v-else-if="isMobile" class="card-list">
        <el-empty v-if="rows.length === 0" :description="emptyDescription" />

        <div v-for="row in rows" :key="row.id" class="list-card" :class="{ 'is-off': !row.enabled }">
          <div class="card-head">
            <span class="dict-name">
              <ColorDot :color="row.color" :size="9" />
              {{ row.name }}
            </span>
            <el-switch
              v-model="row.enabled"
              @change="handleEnabledChange(row, $event)"
            />
          </div>

          <div class="card-meta">
            <span>{{ $t('dictionary.sortOrder') }}:{{ row.sortOrder }}</span>
            <span>{{ usageColumnLabel }}:{{ rowUsage(row) }}</span>
            <span>{{ $t('common.createdAt') }}:{{ formatDateTime(row.createdAt) }}</span>
          </div>

          <div class="card-actions">
            <el-button link type="primary" @click="openEditDialog(row)">{{ $t('common.edit') }}</el-button>
            <el-button link type="danger" @click="handleDelete(row)">{{ $t('common.delete') }}</el-button>
          </div>
        </div>
      </div>

      <el-table v-else :data="rows" :row-class-name="rowClassName">
        <el-table-column :label="$t('dictionary.name')" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="dict-name">
              <ColorDot :color="row.color" :size="9" />
              {{ row.name }}
            </span>
          </template>
        </el-table-column>

        <el-table-column :label="usageColumnLabel" min-width="150" align="center">
          <template #default="{ row }">{{ rowUsage(row) }}</template>
        </el-table-column>

        <el-table-column :label="$t('dictionary.status')" min-width="150" align="center">
          <template #default="{ row }">
            <el-switch
              v-model="row.enabled"
              @change="handleEnabledChange(row, $event)"
            />
          </template>
        </el-table-column>

        <el-table-column :label="$t('common.createdAt')" min-width="150" align="center">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>

        <el-table-column :label="$t('common.actions')" min-width="150" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEditDialog(row)">{{ $t('common.edit') }}</el-button>
            <el-button link type="danger" @click="handleDelete(row)">{{ $t('common.delete') }}</el-button>
          </template>
        </el-table-column>

        <template #empty>
          <el-empty :description="emptyDescription" />
        </template>
      </el-table>

      <el-dialog v-model="dialogVisible" :title="dialogTitle" width="min(640px, 94vw)" :show-close="false">
        <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
          <el-form-item :label="$t('dictionary.name')" prop="name">
            <el-input
              v-model="form.name"
              :placeholder="$t('dictionary.namePlaceholder')"
              maxlength="20"
              show-word-limit
              @keyup.enter="submitItem"
            />
          </el-form-item>

          <el-form-item :label="$t('dictionary.sortOrder')">
            <el-input-number
              v-model="form.sortOrder"
              class="sort-order-input"
              :controls="false"
              :min="0"
              :max="9999"
            />
          </el-form-item>

          <el-form-item :label="$t('dictionary.color')">
            <div class="color-field">
              <span class="color-field__preview" :style="{ backgroundColor: form.color }" />
              <span class="color-field__value">{{ form.color }}</span>
              <el-icon class="color-field__arrow"><ArrowDown /></el-icon>
              <el-color-picker
                v-model="form.color"
                class="color-field__picker"
                :predefine="colorOptions"
                :aria-label="$t('dictionary.color')"
              />
            </div>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dialogVisible = false">{{ $t('common.cancel') }}</el-button>
          <el-button type="primary" :loading="submitting" @click="submitItem">
            {{ $t('common.confirm') }}
          </el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<style scoped>
.dictionary-view {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.scope-tabs {
  align-self: flex-start;
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: #fff;
  border: 1px solid var(--color-border);
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
}

.scope-tab {
  min-width: 92px;
  height: 34px;
  padding: 0 18px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-2);
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

.scope-tab:hover {
  background: var(--color-bg-bottom);
  color: var(--color-text-1);
}

.scope-tab.is-active {
  background: var(--el-color-primary);
  color: #fff;
  box-shadow: 0 2px 8px rgba(11, 176, 109, 0.28);
}

.scope-tab.is-active:hover {
  background: var(--el-color-primary);
  color: #fff;
}

.scope-tab:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.dictionary-view > .list-page {
  flex: 1;
  height: auto;
  min-height: 0;
}

.dict-name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.color-field {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  width: 100%;
  height: 50px;
  padding: 0 14px;
  border: 1px solid var(--el-border-color);
  border-radius: 16px;
  background: var(--el-fill-color-blank);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.color-field:hover {
  border-color: var(--el-color-primary-light-5);
}

.color-field:focus-within {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary-light-7);
}

.color-field__preview {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px rgba(16, 24, 40, 0.08);
}

.color-field__value {
  color: var(--color-text-1);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.color-field__arrow {
  margin-left: auto;
  color: var(--color-text-3);
  pointer-events: none;
}

/* 透明覆盖整行:点到颜色项任意位置都能打开取色面板 */
.color-field :deep(.color-field__picker) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
}

.color-field :deep(.color-field__picker .el-color-picker__trigger) {
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
}

.sort-order-input {
  width: 100%;
  height: 50px;
}

.sort-order-input :deep(.el-input__wrapper) {
  min-height: 50px;
  height: 50px;
  box-sizing: border-box;
}

.sort-order-input :deep(.el-input__inner) {
  height: 100%;
  line-height: normal;
}

:deep(.row-off),
.list-card.is-off {
  opacity: 0.55;
}

@media (max-width: 768px) {
  .dictionary-view {
    height: auto;
    min-height: 0;
    gap: 12px;
  }

  .scope-tabs {
    align-self: stretch;
    display: flex;
    width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .scope-tabs::-webkit-scrollbar {
    display: none;
  }

  .scope-tab {
    flex: 1 0 68px;
    min-width: 68px;
    padding: 0 6px;
    font-size: 13px;
  }
}
</style>
