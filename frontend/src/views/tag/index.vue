<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { createTag, deleteTag, getTags, updateTag } from '@/api/tags'
import {
  createDictionary,
  deleteDictionary,
  getDictionaries,
  updateDictionary
} from '@/api/dictionaries'
import { useIsMobile } from '@/composables/useIsMobile'
import { formatDateTime } from '@/utils/datetime'
import type {
  DictionaryItem,
  DictionaryKind,
  TagItem,
  TagScope,
  TagType
} from '@/types'

type DictionaryTab = TagScope | DictionaryKind
type DictionaryRow = TagItem | DictionaryItem

const { t } = useI18n()
const { isMobile } = useIsMobile()

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
  isTagTab.value ? t('tag.addButton') : t('dictionary.addButton', { type: activeTabLabel.value })
)
const emptyDescription = computed(() =>
  isTagTab.value ? t('tag.empty') : t('dictionary.empty', { type: activeTabLabel.value })
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
  loadItems()
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

function rowTagType(row: DictionaryRow): TagType {
  return (row as TagItem).type || 'primary'
}

// ===== 标签弹窗 =====
const tagDialogVisible = ref(false)
const tagSubmitting = ref(false)
const tagFormRef = ref<FormInstance>()
const editingTagId = ref<number | null>(null)
const tagForm = reactive<{ name: string; type: TagType; scope: TagScope }>({
  name: '',
  type: 'primary',
  scope: 'TODO'
})

const scopeOptions = computed<Array<{ value: TagScope; label: string }>>(() => [
  { value: 'TODO', label: t('tag.scopeTodo') },
  { value: 'ACCOUNTING', label: t('tag.scopeAccounting') }
])
const tagTypeOptions = computed<Array<{ value: TagType; label: string }>>(() => [
  { value: 'primary', label: t('tag.typePrimary') },
  { value: 'success', label: t('tag.typeSuccess') },
  { value: 'info', label: t('tag.typeInfo') },
  { value: 'warning', label: t('tag.typeWarning') },
  { value: 'danger', label: t('tag.typeDanger') }
])
const tagDialogTitle = computed(() =>
  editingTagId.value === null ? t('tag.dialogTitle') : t('tag.dialogEdit')
)
const tagRules = computed<FormRules>(() => ({
  name: [
    { required: true, message: t('validation.tagNameRequired'), trigger: 'blur' },
    { min: 1, max: 20, message: t('validation.tagNameLength'), trigger: 'blur' }
  ],
  scope: [{ required: true, message: t('validation.tagScopeRequired'), trigger: 'change' }]
}))

function openTagDialog(): void {
  editingTagId.value = null
  tagForm.name = ''
  tagForm.type = 'primary'
  tagForm.scope = activeTagScope.value
  tagFormRef.value?.clearValidate()
  tagDialogVisible.value = true
}

function openTagEdit(tag: TagItem): void {
  editingTagId.value = tag.id
  tagForm.name = tag.name
  tagForm.type = tag.type || 'primary'
  tagForm.scope = tag.scope || 'TODO'
  tagFormRef.value?.clearValidate()
  tagDialogVisible.value = true
}

async function submitTag(): Promise<void> {
  const valid = await tagFormRef.value?.validate().catch(() => false)
  if (!valid) return

  tagSubmitting.value = true
  try {
    const payload = { name: tagForm.name.trim(), type: tagForm.type }
    if (editingTagId.value === null) {
      await createTag({ ...payload, scope: tagForm.scope })
    } else {
      await updateTag(editingTagId.value, payload)
    }
    tagDialogVisible.value = false
    ElMessage.success(
      editingTagId.value === null ? t('tag.created') : t('tag.updated')
    )
    await loadItems()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  } finally {
    tagSubmitting.value = false
  }
}

// ===== 账户类型 / 分类弹窗 =====
const dictionaryDialogVisible = ref(false)
const dictionarySubmitting = ref(false)
const dictionaryFormRef = ref<FormInstance>()
const editingDictionaryId = ref<number | null>(null)
const dictionaryForm = reactive<{
  kind: DictionaryKind
  name: string
}>({
  kind: 'ACCOUNT_KIND',
  name: ''
})

const dictionaryRules = computed<FormRules>(() => ({
  name: [
    { required: true, message: t('dictionary.namePlaceholder'), trigger: 'blur' },
    { min: 1, max: 20, message: t('dictionary.namePlaceholder'), trigger: 'blur' }
  ]
}))
const dictionaryKindOptions = computed<Array<{ value: DictionaryKind; label: string }>>(() => [
  { value: 'ACCOUNT_KIND', label: t('dictionary.accountKind') },
  { value: 'EXPENSE_CATEGORY', label: t('dictionary.expenseCategory') },
  { value: 'INCOME_CATEGORY', label: t('dictionary.incomeCategory') }
])
const dictionaryDialogTitle = computed(() => {
  const kindLabel = dictionaryKindOptions.value.find((item) => item.value === dictionaryForm.kind)?.label || ''
  return t(editingDictionaryId.value === null ? 'dictionary.dialogAdd' : 'dictionary.dialogEdit', {
    type: kindLabel
  })
})

function openDictionaryDialog(): void {
  editingDictionaryId.value = null
  dictionaryForm.kind = activeDictionaryKind.value
  dictionaryForm.name = ''
  dictionaryFormRef.value?.clearValidate()
  dictionaryDialogVisible.value = true
}

function openDictionaryEdit(item: DictionaryItem): void {
  editingDictionaryId.value = item.id
  dictionaryForm.kind = item.kind
  dictionaryForm.name = item.name
  dictionaryFormRef.value?.clearValidate()
  dictionaryDialogVisible.value = true
}

async function submitDictionary(): Promise<void> {
  const valid = await dictionaryFormRef.value?.validate().catch(() => false)
  if (!valid) return

  dictionarySubmitting.value = true
  try {
    if (editingDictionaryId.value === null) {
      await createDictionary({
        kind: dictionaryForm.kind,
        name: dictionaryForm.name.trim()
      })
    } else {
      await updateDictionary(editingDictionaryId.value, {
        name: dictionaryForm.name.trim()
      })
    }
    dictionaryDialogVisible.value = false
    ElMessage.success(
      editingDictionaryId.value === null ? t('dictionary.created') : t('dictionary.updated')
    )
    await loadItems()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  } finally {
    dictionarySubmitting.value = false
  }
}

function openAddDialog(): void {
  if (isTagTab.value) openTagDialog()
  else openDictionaryDialog()
}

function openEditDialog(row: DictionaryRow): void {
  if (isTagTab.value) openTagEdit(row as TagItem)
  else openDictionaryEdit(row as DictionaryItem)
}

async function handleDelete(row: DictionaryRow): Promise<void> {
  try {
    await ElMessageBox.confirm(
      isTagTab.value
        ? t('tag.deleteConfirm', { name: row.name })
        : t('dictionary.deleteConfirm', { name: row.name }),
      t('common.tip'),
      {
        type: 'warning',
        showClose: false,
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
    ElMessage.success(isTagTab.value ? t('tag.deleted') : t('dictionary.deleted'))
    await loadItems()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  }
}

onMounted(loadItems)
</script>

<template>
  <div class="dictionary-view">
    <!-- 所有字典入口放在同一个胶囊里,卡片内只保留标题和列表 -->
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

      <!-- 移动端:卡片列表 -->
      <div v-else-if="isMobile" class="card-list">
        <el-empty v-if="rows.length === 0" :description="emptyDescription" />

        <div v-for="row in rows" :key="row.id" class="list-card">
          <div class="card-head">
            <template v-if="isTagTab">
              <el-tag :type="rowTagType(row)">{{ row.name }}</el-tag>
            </template>
            <span v-else class="dict-name">{{ row.name }}</span>
          </div>

          <div class="card-meta">
            <span>{{ usageColumnLabel }}:{{ rowUsage(row) }}</span>
            <span>{{ $t('common.createdAt') }}:{{ formatDateTime(row.createdAt) }}</span>
          </div>

          <div class="card-actions">
            <el-button link type="primary" @click="openEditDialog(row)">{{ $t('common.edit') }}</el-button>
            <el-button link type="danger" @click="handleDelete(row)">{{ $t('common.delete') }}</el-button>
          </div>
        </div>
      </div>

      <el-table v-else :data="rows">
        <el-table-column :label="isTagTab ? $t('tag.colName') : $t('dictionary.name')" min-width="220">
          <template #default="{ row }">
            <template v-if="isTagTab">
              <el-tag :type="rowTagType(row)">{{ row.name }}</el-tag>
            </template>
            <span v-else class="dict-name">{{ row.name }}</span>
          </template>
        </el-table-column>

        <el-table-column :label="usageColumnLabel" width="120" align="center">
          <template #default="{ row }">{{ rowUsage(row) }}</template>
        </el-table-column>

        <el-table-column :label="$t('common.createdAt')" width="180">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>

        <el-table-column :label="$t('common.actions')" width="160" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEditDialog(row)">{{ $t('common.edit') }}</el-button>
            <el-button link type="danger" @click="handleDelete(row)">{{ $t('common.delete') }}</el-button>
          </template>
        </el-table-column>

        <template #empty>
          <el-empty :description="emptyDescription" />
        </template>
      </el-table>

      <!-- 标签编辑 -->
      <el-dialog v-model="tagDialogVisible" :title="tagDialogTitle" width="min(640px, 94vw)" :show-close="false">
        <el-form ref="tagFormRef" :model="tagForm" :rules="tagRules" label-position="top">
          <el-form-item :label="$t('tag.colScope')" prop="scope">
            <div class="scope-field">
              <el-select v-model="tagForm.scope" disabled style="width: 100%">
                <el-option v-for="opt in scopeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
              <span class="scope-locked">{{ $t('tag.scopeLocked') }}</span>
            </div>
          </el-form-item>

          <el-form-item :label="$t('tag.colName')" prop="name">
            <el-input
              v-model="tagForm.name"
              :placeholder="$t('tag.namePlaceholder')"
              maxlength="20"
              show-word-limit
              @keyup.enter="submitTag"
            />
          </el-form-item>

          <el-form-item :label="$t('tag.colType')" prop="type">
            <el-select v-model="tagForm.type" style="width: 100%">
              <template #label="{ label, value }">
                <el-tag :type="value">{{ label }}</el-tag>
              </template>
              <el-option v-for="opt in tagTypeOptions" :key="opt.value" :label="opt.label" :value="opt.value">
                <el-tag :type="opt.value">{{ opt.label }}</el-tag>
              </el-option>
            </el-select>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="tagDialogVisible = false">{{ $t('common.cancel') }}</el-button>
          <el-button type="primary" :loading="tagSubmitting" @click="submitTag">{{ $t('common.confirm') }}</el-button>
        </template>
      </el-dialog>

      <!-- 账户类型 / 分类编辑 -->
      <el-dialog
        v-model="dictionaryDialogVisible"
        :title="dictionaryDialogTitle"
        width="min(640px, 94vw)"
        :show-close="false"
      >
        <el-form
          ref="dictionaryFormRef"
          :model="dictionaryForm"
          :rules="dictionaryRules"
          label-position="top"
        >
          <el-form-item :label="$t('dictionary.kind')">
            <div class="scope-field">
              <el-select v-model="dictionaryForm.kind" disabled style="width: 100%">
                <el-option
                  v-for="opt in dictionaryKindOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
              <span class="scope-locked">{{ $t('dictionary.kindLocked') }}</span>
            </div>
          </el-form-item>

          <el-form-item :label="$t('dictionary.name')" prop="name">
            <el-input
              v-model="dictionaryForm.name"
              :placeholder="$t('dictionary.namePlaceholder')"
              maxlength="20"
              show-word-limit
              @keyup.enter="submitDictionary"
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dictionaryDialogVisible = false">{{ $t('common.cancel') }}</el-button>
          <el-button type="primary" :loading="dictionarySubmitting" @click="submitDictionary">
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

/* 胶囊 Tab:五个入口共用一条横向胶囊 */
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

.scope-field {
  width: 100%;
}

.scope-locked {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-3);
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
