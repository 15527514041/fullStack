<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import {
  createLedgerRecord,
  getAccounts,
  getLedgerRecord,
  getLedgerRecords,
  updateLedgerRecord
} from '@/api/ledger'
import { getTags } from '@/api/tags'
import { getDictionaries } from '@/api/dictionaries'
import ColorDot from '@/components/ColorDot.vue'
import ActionIcon from '@/components/ActionIcon.vue'
import BackButton from '@/components/BackButton.vue'
import { centsToYuan, formatCents, yuanToCents } from '@/utils/money'
import { DICTIONARY_CREATE_VALUE, dictionaryTabRoute } from '@/utils/dictionary'
import type {
  DictionaryItem,
  LedgerAccount,
  LedgerItem,
  LedgerItemPayload,
  LedgerItemType,
  LedgerRecordDetail,
  LedgerRecordSource,
  LedgerRecordSummary,
  TagItem
} from '@/types'
import { getModeMeta } from '../constants'
import {
  currentPeriodStart,
  formatPeriodLabel,
  formatPeriodRange,
  normalizeWeekStart,
  periodEndFor
} from '../utils'
import LedgerAmountText from './LedgerAmountText.vue'
import LedgerTagList from './LedgerTagList.vue'

const ACCOUNT_CREATE_VALUE = '__account_create__'

interface EditorRow {
  key: number
  categoryId: number | null
  accountId: number | null
  amountYuan: number | undefined
  tagIds: number[]
  remark: string
}

const props = defineProps<{
  source: LedgerRecordSource
  recordId?: number
}>()

const router = useRouter()
const route = useRoute()
const { t, locale } = useI18n()
const meta = getModeMeta(props.source)

const isNew = computed(() => props.recordId === undefined)
const fromList = computed(() => route.query.from === 'list')
const loading = ref(true)
const submitting = ref(false)
const baseline = ref('')

const accounts = ref<LedgerAccount[]>([])
const tags = ref<TagItem[]>([])
const incomeCategories = ref<DictionaryItem[]>([])
const expenseCategories = ref<DictionaryItem[]>([])

const itemDialogVisible = ref(false)
const editingItemKey = ref<number | null>(null)
const itemFormRef = ref<FormInstance>()
const itemForm = reactive<{
  type: LedgerItemType
  categoryId: number | null
  accountId: number | null
  amountYuan: number | undefined
  tagIds: number[]
  remark: string
}>({
  type: 'EXPENSE',
  categoryId: null,
  accountId: null,
  amountYuan: undefined,
  tagIds: [],
  remark: ''
})

const dayValue = ref(currentPeriodStart('manual_day'))
const weekValue = ref(currentPeriodStart('manual_week'))
const monthValue = ref(currentPeriodStart('manual_month').slice(0, 7))

const expenseRows = ref<EditorRow[]>([])
const incomeRows = ref<EditorRow[]>([])
let rowSequence = 0

const existingRecord = ref<LedgerRecordSummary | null>(null)
const checkingPeriod = ref(false)
let checkSequence = 0

const periodStart = computed(() => {
  if (props.source === 'manual_day') return dayValue.value
  if (props.source === 'manual_week') return weekValue.value ? normalizeWeekStart(weekValue.value) : ''
  return monthValue.value ? `${monthValue.value}-01` : ''
})
const periodEnd = computed(() => periodEndFor(props.source, periodStart.value))
const periodLabel = computed(() =>
  formatPeriodLabel(props.source, periodStart.value, periodEnd.value)
)
const periodRange = computed(() =>
  formatPeriodRange(props.source, periodStart.value, periodEnd.value)
)
const periodTooltip = computed(() =>
  t('ledger.entries.periodTooltip', {
    unit: t(
      props.source === 'manual_day'
        ? 'ledger.entries.periodUnitDate'
        : props.source === 'manual_week'
          ? 'ledger.entries.periodUnitWeek'
          : 'ledger.entries.periodUnitMonth'
    )
  })
)
const weekPickerFormat = computed(() =>
  locale.value === 'en_US' ? '[Week] ww, YYYY' : 'YYYY 年第 ww 周'
)
const monthPickerFormat = computed(() =>
  locale.value === 'en_US' ? 'MMMM YYYY' : 'YYYY 年 MM 月'
)
const periodExists = computed(() => isNew.value && Boolean(existingRecord.value))
const pageTitle = computed(() => t(isNew.value ? meta.addTitleKey : meta.editTitleKey))
const backTarget = computed(() =>
  isNew.value || fromList.value
    ? { name: meta.listRoute }
    : { name: meta.detailRoute, params: { id: props.recordId as number } }
)
const hasNoAccounts = computed(() => !loading.value && accounts.value.length === 0)

const sections = computed<
  Array<{ type: LedgerItemType; titleKey: string; addKey: string; rows: EditorRow[] }>
>(() => [
  {
    type: 'EXPENSE',
    titleKey: 'ledger.entries.expenseSection',
    addKey: 'ledger.entries.addExpense',
    rows: expenseRows.value
  },
  {
    type: 'INCOME',
    titleKey: 'ledger.entries.incomeSection',
    addKey: 'ledger.entries.addIncome',
    rows: incomeRows.value
  }
])

const totals = computed(() => {
  let expenseCents = 0
  let incomeCents = 0

  for (const row of expenseRows.value) {
    if (typeof row.amountYuan === 'number' && row.amountYuan > 0) {
      expenseCents += yuanToCents(row.amountYuan)
    }
  }
  for (const row of incomeRows.value) {
    if (typeof row.amountYuan === 'number' && row.amountYuan > 0) {
      incomeCents += yuanToCents(row.amountYuan)
    }
  }

  return { expenseCents, incomeCents, netCents: incomeCents - expenseCents }
})
const netClass = computed(() => {
  if (totals.value.netCents > 0) return 'is-positive'
  if (totals.value.netCents < 0) return 'is-negative'
  return ''
})
const itemDialogTitle = computed(() => {
  const typeLabel =
    itemForm.type === 'EXPENSE' ? t('ledger.entries.expense') : t('ledger.entries.income')
  return editingItemKey.value === null
    ? t('ledger.entries.addTypeItem', { type: typeLabel })
    : t('ledger.entries.editTypeItem', { type: typeLabel })
})
const itemRules = computed<FormRules>(() => ({
  categoryId: [{ required: true, message: t('ledger.entries.categoryRequired'), trigger: 'change' }],
  accountId: [{ required: true, message: t('ledger.entries.accountRequired'), trigger: 'change' }],
  amountYuan: [
    {
      validator: (_rule, value, callback) => {
        if (typeof value !== 'number' || value <= 0) {
          callback(new Error(t('ledger.entries.amountPositive')))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}))

function serializeRow(row: EditorRow) {
  return {
    categoryId: row.categoryId,
    accountId: row.accountId,
    amountYuan: typeof row.amountYuan === 'number' ? row.amountYuan : null,
    tagIds: [...row.tagIds],
    remark: row.remark
  }
}

const currentSnapshot = computed(() =>
  JSON.stringify({
    periodStart: periodStart.value,
    expense: expenseRows.value.map(serializeRow),
    income: incomeRows.value.map(serializeRow)
  })
)
const dirty = computed(() => !loading.value && currentSnapshot.value !== baseline.value)

function emptyRow(accountId: number | null = null): EditorRow {
  rowSequence += 1
  return {
    key: rowSequence,
    categoryId: null,
    accountId,
    amountYuan: undefined,
    tagIds: [],
    remark: ''
  }
}

function rowsFor(type: LedgerItemType) {
  return type === 'EXPENSE' ? expenseRows : incomeRows
}

function removeRow(type: LedgerItemType, index: number): void {
  rowsFor(type).value.splice(index, 1)
}

function openAddItem(type: LedgerItemType = 'EXPENSE'): void {
  const list = rowsFor(type).value
  const previous = list[list.length - 1]
  editingItemKey.value = null
  itemForm.type = type
  itemForm.categoryId = null
  itemForm.accountId = previous?.accountId ?? null
  itemForm.amountYuan = undefined
  itemForm.tagIds = []
  itemForm.remark = ''
  itemDialogVisible.value = true
  void nextTick(() => itemFormRef.value?.clearValidate())
}

function openEditItem(row: EditorRow, type: LedgerItemType): void {
  editingItemKey.value = row.key
  itemForm.type = type
  itemForm.categoryId = row.categoryId
  itemForm.accountId = row.accountId
  itemForm.amountYuan = row.amountYuan
  itemForm.tagIds = [...row.tagIds]
  itemForm.remark = row.remark
  itemDialogVisible.value = true
  void nextTick(() => itemFormRef.value?.clearValidate())
}

async function saveItem(): Promise<void> {
  const valid = await itemFormRef.value?.validate().catch(() => false)
  if (!valid) return

  const row: EditorRow = {
    key: editingItemKey.value ?? ++rowSequence,
    categoryId: itemForm.categoryId as number,
    accountId: itemForm.accountId as number,
    amountYuan: itemForm.amountYuan as number,
    tagIds: [...itemForm.tagIds],
    remark: itemForm.remark.trim()
  }

  expenseRows.value = expenseRows.value.filter((item) => item.key !== row.key)
  incomeRows.value = incomeRows.value.filter((item) => item.key !== row.key)
  rowsFor(itemForm.type).value.push(row)

  itemDialogVisible.value = false
}

function handleWeekChange(value: string | null): void {
  weekValue.value = value ? normalizeWeekStart(value) : ''
}

function categoriesFor(type: LedgerItemType): DictionaryItem[] {
  return type === 'EXPENSE' ? expenseCategories.value : incomeCategories.value
}

function categoryOptions(type: LedgerItemType): Array<{ value: number; label: string }> {
  return categoriesFor(type)
    .filter((category) => category.enabled || category.id === itemForm.categoryId)
    .map((category) => ({
      value: category.id,
      label: category.name
    }))
}

function accountLabel(account: LedgerAccount): string {
  return account.enabled ? account.name : `${account.name} (${t('ledger.accounts.disabled')})`
}

function categoryLabel(categoryId?: number | null): string {
  if (!categoryId) return '—'
  return [...incomeCategories.value, ...expenseCategories.value].find((item) => item.id === categoryId)?.name || '—'
}

function categoryColor(categoryId?: number | null): string {
  return (
    [...incomeCategories.value, ...expenseCategories.value].find((item) => item.id === categoryId)
      ?.color || '#0bb06d'
  )
}

const tagOptions = computed(() =>
  tags.value.filter((tag) => tag.enabled || itemForm.tagIds.includes(tag.id))
)

function tagColorOf(tagId: number): string {
  return tags.value.find((tag) => tag.id === tagId)?.color || '#0bb06d'
}

function tagChipStyle(tagId: number) {
  const color = tagColorOf(tagId)
  return { color, backgroundColor: `${color}14`, borderColor: `${color}33` }
}

function handleCategoryChange(value: string | number): void {
  if (value !== DICTIONARY_CREATE_VALUE) return
  itemForm.categoryId = null
  router.push(
    dictionaryTabRoute(itemForm.type === 'EXPENSE' ? 'EXPENSE_CATEGORY' : 'INCOME_CATEGORY')
  )
}

function handleEditorTagChange(values: Array<string | number>): void {
  if (!values.includes(DICTIONARY_CREATE_VALUE)) return
  itemForm.tagIds = values.filter((value): value is number => typeof value === 'number')
  router.push(dictionaryTabRoute('ACCOUNTING'))
}

function handleAccountChange(value: string | number): void {
  if (value !== ACCOUNT_CREATE_VALUE) return
  itemForm.accountId = null
  router.push({ name: 'ledger-accounts', query: { create: '1' } })
}

const categoryAddLabel = computed(() =>
  t('dictionary.addButton', {
    type: t(
      itemForm.type === 'EXPENSE'
        ? 'dictionary.expenseCategory'
        : 'dictionary.incomeCategory'
    )
  })
)

function rowAccount(row: EditorRow): LedgerAccount | null {
  return accounts.value.find((account) => account.id === row.accountId) || null
}

function rowTags(row: EditorRow): TagItem[] {
  return tags.value.filter((tag) => row.tagIds.includes(tag.id))
}

function rowAmountCents(row: EditorRow): number {
  return typeof row.amountYuan === 'number' ? yuanToCents(row.amountYuan) : 0
}

function rowHasContent(row: EditorRow): boolean {
  return Boolean(
    row.categoryId ||
      typeof row.amountYuan === 'number' ||
      row.remark.trim() ||
      row.tagIds.length
  )
}

function rowError(sectionKey: string, index: number, messageKey: string): null {
  ElMessage.warning(
    t('ledger.entries.rowError', {
      section: t(sectionKey),
      index: index + 1,
      message: t(messageKey)
    })
  )
  return null
}

function buildSection(
  type: LedgerItemType,
  rows: EditorRow[],
  sectionKey: string
): LedgerItemPayload[] | null {
  const result: LedgerItemPayload[] = []

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (!rowHasContent(row)) continue
    if (!row.categoryId) return rowError(sectionKey, index, 'ledger.entries.categoryRequired')
    if (!row.accountId) return rowError(sectionKey, index, 'ledger.entries.accountRequired')
    if (typeof row.amountYuan !== 'number' || row.amountYuan <= 0) {
      return rowError(sectionKey, index, 'ledger.entries.amountPositive')
    }

    result.push({
      type,
      categoryId: row.categoryId,
      accountId: row.accountId,
      amountCents: yuanToCents(row.amountYuan),
      tagIds: row.tagIds,
      remark: row.remark.trim() || null
    })
  }

  return result
}

function buildPayload(): LedgerItemPayload[] | null {
  const expense = buildSection('EXPENSE', expenseRows.value, 'ledger.entries.expenseSection')
  if (!expense) return null
  const income = buildSection('INCOME', incomeRows.value, 'ledger.entries.incomeSection')
  if (!income) return null

  const items = [...expense, ...income]
  if (!items.length) {
    ElMessage.warning(t('ledger.entries.itemRequired'))
    return null
  }
  return items
}

function toEditorRow(item: LedgerItem): EditorRow {
  return {
    ...emptyRow(item.accountId),
    categoryId: item.categoryId,
    amountYuan: centsToYuan(item.amountCents),
    tagIds: item.tags?.map((tag) => tag.id) || [],
    remark: item.remark || ''
  }
}

function fillRecord(detail: LedgerRecordDetail): void {
  if (props.source === 'manual_day') dayValue.value = detail.periodStart
  else if (props.source === 'manual_week') weekValue.value = detail.periodStart
  else monthValue.value = detail.periodStart.slice(0, 7)

  expenseRows.value = detail.items
    .filter((item) => item.type === 'EXPENSE')
    .map(toEditorRow)
  incomeRows.value = detail.items
    .filter((item) => item.type === 'INCOME')
    .map(toEditorRow)
}

function resetForm(): void {
  dayValue.value = currentPeriodStart('manual_day')
  weekValue.value = currentPeriodStart('manual_week')
  monthValue.value = currentPeriodStart('manual_month').slice(0, 7)
  expenseRows.value = []
  incomeRows.value = []
}

async function checkPeriod(): Promise<void> {
  if (!isNew.value) {
    existingRecord.value = null
    return
  }

  const start = periodStart.value
  if (!start) {
    existingRecord.value = null
    return
  }

  const sequence = ++checkSequence
  checkingPeriod.value = true
  try {
    const result = await getLedgerRecords({
      source: props.source,
      page: 1,
      pageSize: 1,
      from: start,
      to: start
    })
    if (sequence === checkSequence) {
      existingRecord.value = result.list[0] || null
    }
  } catch {
    if (sequence === checkSequence) existingRecord.value = null
  } finally {
    if (sequence === checkSequence) checkingPeriod.value = false
  }
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const [accountList, tagList, incomeList, expenseList] = await Promise.all([
      getAccounts(),
      getTags({ scope: 'ACCOUNTING' }),
      getDictionaries('INCOME_CATEGORY'),
      getDictionaries('EXPENSE_CATEGORY')
    ])
    accounts.value = accountList
    tags.value = tagList
    incomeCategories.value = incomeList
    expenseCategories.value = expenseList

    if (props.recordId !== undefined) {
      fillRecord(await getLedgerRecord(props.recordId))
    } else {
      resetForm()
    }
  } catch {
    router.replace({ name: meta.listRoute })
  } finally {
    baseline.value = currentSnapshot.value
    loading.value = false
  }
}

async function handleSubmit(): Promise<void> {
  if (!periodStart.value) {
    ElMessage.warning(t('ledger.entries.periodRequired'))
    return
  }

  // 新建页的周期已存在时不提供「去编辑」入口,点保存只给 toast
  if (periodExists.value) {
    ElMessage.warning(t('ledger.entries.periodExistsToast', { period: periodLabel.value }))
    return
  }

  const items = buildPayload()
  if (!items) return

  submitting.value = true
  try {
    const saved =
      props.recordId === undefined
        ? await createLedgerRecord({ source: props.source, periodStart: periodStart.value, items })
        : await updateLedgerRecord(props.recordId as number, { items })

    ElMessage.success(t(isNew.value ? 'ledger.entries.created' : 'ledger.entries.updated'))
    baseline.value = currentSnapshot.value
    router.replace(
      fromList.value
        ? { name: meta.listRoute }
        : { name: meta.detailRoute, params: { id: saved.id } }
    )
  } catch {
    // 错误提示由 axios 拦截器统一处理
  } finally {
    submitting.value = false
  }
}

function goAccounts(): void {
  router.push({ name: 'ledger-accounts' })
}

watch(periodStart, () => {
  void checkPeriod()
}, { immediate: true })

watch(() => props.recordId, () => {
  void load()
})

onBeforeRouteLeave(async () => {
  if (!dirty.value || submitting.value) return true
  try {
    await ElMessageBox.confirm(t('ledger.entries.leaveConfirm'), t('common.tip'), {
      type: 'warning',
      showClose: false,
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel')
    })
    return true
  } catch {
    return false
  }
})

onMounted(load)
</script>

<template>
  <div class="detail-page is-full has-actions ledger-entry-editor">
    <div class="detail-header ledger-editor-header">
      <BackButton :to="backTarget" />
      <div class="detail-title">{{ pageTitle }}</div>
    </div>

    <div class="detail-container ledger-editor-container">
      <el-skeleton v-if="loading" :rows="10" animated />

      <div v-else class="ledger-editor-layout">
        <div class="ledger-stats-card">
          <div class="ledger-stats-grid">
            <div class="ledger-stat">
              <span>{{ t('ledger.entries.totalExpense') }}</span>
              <strong class="is-expense">{{ formatCents(totals.expenseCents) }}</strong>
            </div>
            <div class="ledger-stat">
              <span>{{ t('ledger.entries.totalIncome') }}</span>
              <strong class="is-income">{{ formatCents(totals.incomeCents) }}</strong>
            </div>
            <div class="ledger-stat">
              <span>{{ t('ledger.entries.net') }}</span>
              <strong :class="netClass">{{ formatCents(totals.netCents) }}</strong>
            </div>
          </div>
        </div>

        <div class="info-card ledger-editor-card">
          <section class="editor-section period-section">
            <div class="period-row" :class="{ 'period-row--stacked': isNew }">
              <div class="period-label-wrap">
                <h3 class="editor-section__title period-label">{{ t('ledger.entries.periodSection') }}</h3>
                <el-tooltip
                  v-if="isNew"
                  :content="periodTooltip"
                  placement="top"
                  popper-class="period-help-popper"
                >
                  <span
                    class="period-help"
                    tabindex="0"
                    :aria-label="periodTooltip"
                  >
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <circle cx="10" cy="10" r="7.4" stroke="currentColor" stroke-width="1.5" />
                      <path
                        d="M10 5.9V10.7"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                      />
                      <circle cx="10" cy="13.8" r="1" fill="currentColor" />
                    </svg>
                  </span>
                </el-tooltip>
              </div>

              <div class="period-field">
                <div class="period-value-row">
                  <div v-if="isNew" class="period-controls">
                    <el-date-picker
                      v-if="source === 'manual_day'"
                      v-model="dayValue"
                      type="date"
                      value-format="YYYY-MM-DD"
                      :placeholder="t('ledger.entries.periodDate')"
                    />
                    <el-date-picker
                      v-else-if="source === 'manual_week'"
                      v-model="weekValue"
                      type="week"
                      value-format="YYYY-MM-DD"
                      :format="weekPickerFormat"
                      :placeholder="t('ledger.entries.periodWeek')"
                      @change="handleWeekChange"
                    />
                    <el-date-picker
                      v-else
                      v-model="monthValue"
                      type="month"
                      value-format="YYYY-MM"
                      :format="monthPickerFormat"
                      :placeholder="t('ledger.entries.periodMonth')"
                    />
                    <span v-if="periodRange" class="period-range">{{ periodRange }}</span>
                    <span v-if="checkingPeriod" class="period-checking">
                      {{ t('common.loading') }}
                    </span>
                  </div>
                  <div v-else class="period-readonly">
                    <span>{{ periodLabel }}</span>
                    <span v-if="periodRange" class="period-range">{{ periodRange }}</span>
                  </div>

                  <el-alert
                    v-if="periodExists"
                    class="period-exists-alert"
                    type="warning"
                    show-icon
                    :closable="false"
                    :title="t('ledger.entries.periodExists', { period: periodLabel })"
                  />
                </div>

                <el-alert
                  v-if="hasNoAccounts"
                  class="no-account-alert"
                  type="warning"
                  show-icon
                  :closable="false"
                  :title="t('ledger.entries.noAccounts')"
                >
                  <el-button link type="primary" @click="goAccounts">{{ t('ledger.entries.goCreateAccount') }}</el-button>
                </el-alert>
              </div>
            </div>
          </section>

          <div class="editor-divider" />

          <div class="ledger-items-toolbar">
            <h3 class="editor-section__title">{{ t('ledger.entries.itemsTitle') }}</h3>
          </div>

          <div class="ledger-sections-stack">
            <section v-for="section in sections" :key="section.type" class="ledger-section">
              <div class="editor-section__head">
                <div class="editor-section__title-wrap">
                  <h3 class="editor-section__title">{{ t(section.titleKey) }}</h3>
                  <span class="section-count">
                    {{ t('ledger.entries.itemCount', { count: section.rows.length }) }}
                  </span>
                </div>
                <el-button type="primary" plain size="small" @click="openAddItem(section.type)">
                  {{ t(section.addKey) }}
                </el-button>
              </div>

              <div v-if="!section.rows.length" class="section-empty">
                {{ t('ledger.entries.noItems') }}
              </div>

              <div v-else class="ledger-compact-list">
                <div class="ledger-compact-head">
                  <span>{{ t('ledger.entries.category') }}</span>
                  <span>{{ t('ledger.entries.account') }}</span>
                  <span>{{ t('ledger.entries.amount') }}</span>
                  <span>{{ t('ledger.entries.tags') }}</span>
                  <span>{{ t('ledger.entries.remark') }}</span>
                  <span class="align-right">{{ t('common.actions') }}</span>
                </div>
                <div
                  v-for="(row, index) in section.rows"
                  :key="row.key"
                  class="ledger-compact-row"
                  @click="openEditItem(row, section.type)"
                >
                  <span class="compact-category">
                    <ColorDot :color="categoryColor(row.categoryId)" />
                    {{ categoryLabel(row.categoryId) }}
                  </span>
                  <span class="compact-account">
                    <ColorDot :color="rowAccount(row)?.kind?.color" />
                    {{ rowAccount(row)?.name || '—' }}
                  </span>
                  <span class="compact-amount">
                    <LedgerAmountText :amount-cents="rowAmountCents(row)" :type="section.type" />
                  </span>
                  <span class="compact-tags">
                    <LedgerTagList :tags="rowTags(row)" />
                  </span>
                  <span class="compact-remark">{{ row.remark || '—' }}</span>
                  <span class="compact-actions" @click.stop>
                    <el-tooltip :content="t('common.edit')" placement="top">
                      <el-button
                        class="row-action"
                        link
                        :aria-label="t('common.edit')"
                        @click="openEditItem(row, section.type)"
                      >
                        <ActionIcon name="edit" :size="18" />
                      </el-button>
                    </el-tooltip>
                    <el-tooltip :content="t('common.delete')" placement="top">
                      <el-button
                        class="row-action row-action--danger"
                        link
                        :aria-label="t('common.delete')"
                        @click="removeRow(section.type, index)"
                      >
                        <ActionIcon name="delete" :size="18" />
                      </el-button>
                    </el-tooltip>
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>

      </div>
    </div>

    <el-dialog
      v-model="itemDialogVisible"
      class="ledger-item-dialog"
      :title="itemDialogTitle"
      width="min(720px, 94vw)"
      :show-close="false"
      :close-on-click-modal="false"
    >
      <el-form ref="itemFormRef" :model="itemForm" :rules="itemRules" label-position="top">
        <el-form-item :label="t('ledger.entries.colType')">
          <el-select v-model="itemForm.type" disabled style="width: 100%">
            <el-option value="EXPENSE" :label="t('ledger.entries.expense')" />
            <el-option value="INCOME" :label="t('ledger.entries.income')" />
          </el-select>
        </el-form-item>

        <el-form-item :label="t('ledger.entries.category')" prop="categoryId">
          <el-select
            v-model="itemForm.categoryId"
            filterable
            :placeholder="t('ledger.entries.category')"
            style="width: 100%"
            @change="handleCategoryChange"
          >
            <el-option
              v-for="option in categoryOptions(itemForm.type)"
              :key="option.value"
              :value="option.value"
              :label="option.label"
            >
              <span class="color-option">
                <ColorDot :color="categoryColor(option.value)" />
                {{ option.label }}
              </span>
            </el-option>
            <el-option
              :value="DICTIONARY_CREATE_VALUE"
              :label="categoryAddLabel"
            >
              <span class="dictionary-add-option">
                <el-icon><Plus /></el-icon>
                {{ categoryAddLabel }}
              </span>
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item :label="t('ledger.entries.account')" prop="accountId">
          <el-select
            v-model="itemForm.accountId"
            filterable
            :placeholder="t('ledger.entries.account')"
            style="width: 100%"
            @change="handleAccountChange"
          >
            <el-option
              v-for="account in accounts"
              :key="account.id"
              :value="account.id"
              :label="accountLabel(account)"
            >
              <span class="account-option">
                <ColorDot :color="account.kind?.color" />
                <span>{{ account.name }}</span>
                <el-tag v-if="!account.enabled" size="small" type="info">
                  {{ t('ledger.accounts.disabled') }}
                </el-tag>
              </span>
            </el-option>
            <el-option
              :value="ACCOUNT_CREATE_VALUE"
              :label="t('ledger.accounts.addButton')"
            >
              <span class="dictionary-add-option">
                <el-icon><Plus /></el-icon>
                {{ t('ledger.accounts.addButton') }}
              </span>
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item :label="t('ledger.entries.amount')" prop="amountYuan">
          <el-input-number
            v-model="itemForm.amountYuan"
            :precision="2"
            :controls="false"
            :min="0"
            :max="9999999.99"
            placeholder="0.00"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item :label="t('ledger.entries.tags')">
          <el-select
            v-model="itemForm.tagIds"
            multiple
            clearable
            filterable
            :placeholder="t('ledger.entries.tags')"
            style="width: 100%"
            @change="handleEditorTagChange"
          >
            <template #tag="{ data, deleteTag, selectDisabled }">
              <el-tag
                v-for="item in data"
                :key="item.value"
                :style="tagChipStyle(item.value)"
                :closable="!selectDisabled && !item.isDisabled"
                @close="deleteTag($event, item)"
              >
                {{ item.currentLabel }}
              </el-tag>
            </template>
            <el-option v-for="tag in tagOptions" :key="tag.id" :value="tag.id" :label="tag.name">
              <span class="color-option"><ColorDot :color="tag.color" />{{ tag.name }}</span>
            </el-option>
            <el-option
              :value="DICTIONARY_CREATE_VALUE"
              :label="t('dictionary.addButton', { type: t('tag.tabAccounting') })"
            >
              <span class="dictionary-add-option">
                <el-icon><Plus /></el-icon>
                {{ t('dictionary.addButton', { type: t('tag.tabAccounting') }) }}
              </span>
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item :label="t('ledger.entries.remark')">
          <el-input
            v-model="itemForm.remark"
            maxlength="500"
            :placeholder="t('ledger.entries.remark')"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="itemDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveItem">
          {{ editingItemKey === null ? t('ledger.entries.addToEntry') : t('common.save') }}
        </el-button>
      </template>
    </el-dialog>

    <div class="detail-actions">
      <el-button @click="router.push(backTarget)">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ t('common.save') }}
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.ledger-editor-container {
  max-width: 1000px;
}

.ledger-editor-header {
  max-width: 1000px;
}

.ledger-editor-layout {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.ledger-editor-card {
  padding-top: 24px;
  padding-bottom: 28px;
}

.editor-section {
  min-width: 0;
}

.editor-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.editor-section__title-wrap {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.section-count {
  font-size: 12px;
  color: var(--color-text-3);
}

.editor-section__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
}

.period-row {
  display: flex;
  align-items: flex-start;
  gap: 20px;
}

.period-label-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 92px;
}

.period-label {
  line-height: 32px;
}

.period-row--stacked {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.period-row--stacked .period-label-wrap {
  flex: none;
}

.period-row--stacked .period-label {
  line-height: 24px;
}

.period-help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex: none;
  color: var(--color-text-3);
  cursor: help;
}

.period-help:hover,
.period-help:focus-visible {
  color: var(--el-color-primary);
}

.period-help svg {
  display: block;
  width: 18px;
  height: 18px;
}

.period-value-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  min-height: 32px;
}

.period-field {
  flex: 1;
  min-width: 0;
}

.period-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.period-controls :deep(.el-date-editor) {
  width: 240px;
}

.period-readonly {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 500;
  color: var(--color-text-1);
}

.period-range {
  font-size: 13px;
  font-weight: 400;
  color: var(--color-text-3);
}

.period-checking {
  font-size: 12px;
  color: var(--color-text-3);
}

/* 已有周期提示跟在选择器右侧,做成一条轻量提示而不是整行 alert */
.period-exists-alert {
  flex: 0 0 auto;
  width: auto;
  margin: 0;
  padding: 6px 14px;
  border-radius: 10px;
}

.period-exists-alert :deep(.el-alert__title) {
  font-size: 13px;
  line-height: 20px;
}

.no-account-alert {
  margin-top: 12px;
}

.editor-divider {
  height: 1px;
  margin: 22px 0;
  background: var(--color-border);
}

.ledger-sections-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  align-items: start;
}

.ledger-section {
  min-width: 0;
}

.section-empty {
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--color-bg-bottom);
  font-size: 13px;
  color: var(--color-text-3);
}

.ledger-items-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.ledger-items-toolbar__title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.ledger-sections-stack {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.ledger-compact-list {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 14px;
}

.ledger-compact-head,
.ledger-compact-row {
  display: grid;
  grid-template-columns:
    minmax(0, 1.1fr)
    minmax(0, 1.1fr)
    130px
    minmax(0, 1.2fr)
    minmax(0, 1.4fr)
    78px;
  gap: 12px;
  align-items: center;
  padding: 10px 14px;
}

.ledger-compact-head {
  background: var(--color-bg-bottom);
  font-size: 12px;
  color: var(--color-text-3);
}

.ledger-compact-row {
  border-top: 1px solid var(--color-border);
  font-size: 13px;
  color: var(--color-text-2);
  cursor: pointer;
}

.ledger-compact-row:hover {
  background: var(--color-bg-bottom);
}

.compact-category {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  font-weight: 500;
  color: var(--color-text-1);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compact-account {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.compact-amount {
  text-align: left;
}

.compact-tags {
  min-width: 0;
}

.compact-remark {
  overflow: hidden;
  color: var(--color-text-3);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compact-actions {
  display: flex;
  justify-content: flex-end;
  gap: 2px;
}

.ledger-item-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ledger-item-card {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: var(--color-bg-card-1);
}

.ledger-item-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-bottom);
}

.ledger-item-card__title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.row-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  background: var(--color-bg-card-1);
  color: var(--color-text-3);
  font-size: 12px;
}

.ledger-item-card__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-1);
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.row-action {
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 8px;
  color: var(--color-text-3);
}

.row-action:hover {
  color: var(--el-color-primary);
  background: var(--color-bg-card-1);
}

.row-action--danger:hover {
  color: var(--el-color-danger);
}

.ledger-item-card__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
}

.ledger-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.ledger-field__label {
  font-size: 12px;
  color: var(--color-text-3);
}

.row-field {
  width: 100%;
  min-width: 0;
}

.row-amount :deep(.el-input__inner) {
  text-align: right;
}

.account-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.color-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ledger-stats-card {
  padding: 22px 26px;
  border-radius: 24px;
  background: var(--color-brand-6);
  color: #fff;
}

.ledger-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.ledger-stat {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.ledger-stat span {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
}

.ledger-stat strong {
  overflow: hidden;
  font-size: 24px;
  font-weight: 600;
  color: #fff;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ledger-stat strong.is-expense,
.ledger-stat strong.is-negative {
  color: #ffe0e0;
}

.ledger-stat strong.is-income,
.ledger-stat strong.is-positive {
  color: #d9ffe5;
}

@media (max-width: 768px) {
  .period-row {
    flex-direction: column;
    gap: 8px;
  }

  .period-label-wrap {
    flex: none;
  }

  .period-label {
    padding-top: 0;
    line-height: 24px;
  }

  .period-value-row {
    flex-direction: column;
    align-items: stretch;
    min-height: 0;
  }

  .period-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .period-controls :deep(.el-date-editor) {
    width: 100%;
  }

  .period-exists-alert {
    flex: none;
    width: 100%;
  }

  .ledger-compact-head {
    display: none;
  }

  .ledger-compact-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    padding: 12px;
  }

  .compact-category {
    grid-column: 1;
    grid-row: 1;
  }

  .compact-amount {
    grid-column: 2;
    grid-row: 1;
  }

  .compact-account {
    grid-column: 1;
    grid-row: 2;
  }

  .compact-actions {
    grid-column: 2;
    grid-row: 2;
  }

  .compact-tags {
    grid-column: 1 / -1;
    grid-row: 3;
  }

  .compact-remark {
    grid-column: 1 / -1;
    grid-row: 4;
    white-space: normal;
  }

  .ledger-sections-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }

  .ledger-stats-card {
    padding: 16px 18px;
    border-radius: 18px;
  }

  .ledger-stats-head {
    align-items: flex-start;
  }

  .ledger-stats-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }

  .ledger-stat {
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
  }

  .ledger-stat strong {
    font-size: 18px;
  }

  .row-action {
    width: 34px;
    height: 34px;
  }
}
</style>

<style>
/* tooltip 会挂到 body 上,不能用 scoped;限宽让长文案换行,气泡贴着 icon 显示 */
.period-help-popper.el-popper {
  max-width: 280px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.6;
}

/* 明细弹窗:上下留白,内容超高时只滚动表单区 */
.ledger-item-dialog.el-dialog {
  --el-dialog-margin-top: 6vh;
  display: flex;
  max-height: 88vh;
  margin-bottom: 6vh;
  flex-direction: column;
}

.ledger-item-dialog .el-dialog__body {
  overflow-y: auto;
}

.ledger-item-dialog .el-dialog__header,
.ledger-item-dialog .el-dialog__footer {
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .ledger-item-dialog.el-dialog {
    --el-dialog-margin-top: 4vh;
    max-height: 92vh;
    margin-bottom: 4vh;
  }
}
</style>
