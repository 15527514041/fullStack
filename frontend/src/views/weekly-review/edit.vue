<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import {
  createWeeklyReview,
  getWeeklyReview,
  getWeeklyReviewContext,
  updateWeeklyReview
} from '@/api/weeklyReview'
import BackButton from '@/components/BackButton.vue'
import WeeklyContextPanel from '@/views/weekly-review/components/WeeklyContextPanel.vue'
import WeeklyPeriodCard from '@/views/weekly-review/components/WeeklyPeriodCard.vue'
import {
  addDateDays,
  currentWeekStart,
  formatWeekRange,
  parseDateOnly,
  toDateString,
  weekStartOf
} from '@/utils/datetime'
import type {
  WeeklyReview,
  WeeklyReviewContext,
  WeeklyReviewPayload,
  WeeklyReviewStatus
} from '@/types'

type ListField = 'wins' | 'challenges' | 'learnings' | 'nextActions'
type SubmitMode = 'draft' | 'complete' | 'changes'

interface FormItem {
  content: string
}

interface ReviewForm {
  weekStart: string
  summary: string
  wins: FormItem[]
  challenges: FormItem[]
  learnings: FormItem[]
  nextActions: FormItem[]
}

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()

const editingId = computed(() => (route.params.id ? Number(route.params.id) : null))
const isNew = computed(() => editingId.value === null)
const pageTitle = computed(() =>
  isNew.value ? t('weeklyReview.addTitle') : t('weeklyReview.editTitle')
)
const backTarget = computed<RouteLocationRaw>(() =>
  isNew.value
    ? { name: 'weekly-reviews' }
    : { name: 'weekly-review-detail', params: { id: editingId.value as number } }
)

const loading = ref(false)
const contextLoading = ref(false)
const submitting = ref<SubmitMode | null>(null)
const context = ref<WeeklyReviewContext | null>(null)
const contextFrozen = ref(false)
const recordStatus = ref<WeeklyReviewStatus>('DRAFT')
const weekValue = ref('')
const savedSnapshot = ref('')

const form = reactive<ReviewForm>({
  weekStart: '',
  summary: '',
  wins: [emptyItem()],
  challenges: [emptyItem()],
  learnings: [emptyItem()],
  nextActions: [emptyItem()]
})

const sections = computed<Array<{
  field: ListField
  label: string
  hint: string
  placeholder: string
}>>(() => [
  {
    field: 'wins',
    label: t('weeklyReview.wins'),
    hint: t('weeklyReview.winsHint'),
    placeholder: t('weeklyReview.winsPlaceholder')
  },
  {
    field: 'challenges',
    label: t('weeklyReview.challenges'),
    hint: t('weeklyReview.challengesHint'),
    placeholder: t('weeklyReview.challengesPlaceholder')
  },
  {
    field: 'learnings',
    label: t('weeklyReview.learnings'),
    hint: t('weeklyReview.learningsHint'),
    placeholder: t('weeklyReview.learningsPlaceholder')
  },
  {
    field: 'nextActions',
    label: t('weeklyReview.nextActions'),
    hint: t('weeklyReview.nextActionsHint'),
    placeholder: t('weeklyReview.nextActionsPlaceholder')
  }
])

const weekEnd = computed(() => (form.weekStart ? addDateDays(form.weekStart, 6) : ''))
const weekPickerFormat = computed(() =>
  locale.value === 'en_US' ? '[Week] ww, YYYY' : 'YYYY 年第 ww 周'
)
const isCompleted = computed(() => recordStatus.value === 'COMPLETED')
const hasSelectedPeriod = computed(() => Boolean(form.weekStart))
const periodExists = computed(() => isNew.value && Boolean(context.value?.existingReviewId))
const showReviewWorkspace = computed(
  () => !isNew.value ||
    (hasSelectedPeriod.value && !contextLoading.value && !periodExists.value)
)
const isDirty = computed(() => Boolean(savedSnapshot.value) && serializeForm() !== savedSnapshot.value)

function emptyItem(): FormItem {
  return { content: '' }
}

function serializeForm(): string {
  return JSON.stringify({
    weekStart: form.weekStart,
    summary: form.summary,
    wins: form.wins.map((item) => item.content),
    challenges: form.challenges.map((item) => item.content),
    learnings: form.learnings.map((item) => item.content),
    nextActions: form.nextActions.map((item) => item.content)
  })
}

function markClean(): void {
  savedSnapshot.value = serializeForm()
}

function resetForm(weekStart = ''): void {
  form.weekStart = weekStart
  form.summary = ''
  form.wins = [emptyItem()]
  form.challenges = [emptyItem()]
  form.learnings = [emptyItem()]
  form.nextActions = [emptyItem()]
  weekValue.value = weekStart
  recordStatus.value = 'DRAFT'
  context.value = null
  contextFrozen.value = false
}

function fillForm(record: WeeklyReview): void {
  form.weekStart = record.weekStart
  form.summary = record.summary || ''
  form.wins = toFormItems(record.wins)
  form.challenges = toFormItems(record.challenges)
  form.learnings = toFormItems(record.learnings)
  form.nextActions = toFormItems(record.nextActions)
  weekValue.value = record.weekStart
  recordStatus.value = record.status
  contextFrozen.value = record.snapshotFrozen
  context.value = {
    weekStart: record.weekStart,
    weekEnd: record.weekEnd,
    metrics: record.metrics,
    days: record.days
  }
}

function toFormItems(items: Array<{ content: string }>): FormItem[] {
  return [{ content: items[0]?.content || '' }]
}

function hasContent(): boolean {
  if (form.summary.trim()) return true
  return sections.value.some(({ field }) =>
    form[field].some((item) => Boolean(item.content.trim()))
  )
}

function buildPayload(status?: WeeklyReviewStatus): WeeklyReviewPayload {
  const buildItems = (items: FormItem[]) =>
    items
      .map((item) => ({ content: item.content.trim() }))
      .filter((item) => item.content)

  return {
    weekStart: form.weekStart,
    summary: form.summary.trim() || null,
    wins: buildItems(form.wins),
    challenges: buildItems(form.challenges),
    learnings: buildItems(form.learnings),
    nextActions: buildItems(form.nextActions),
    ...(status ? { status } : {})
  }
}

function disabledWeekDate(date: Date): boolean {
  return weekStartOf(date) > currentWeekStart()
}

async function loadContext(weekStart: string): Promise<void> {
  contextLoading.value = true
  try {
    const result = await getWeeklyReviewContext(weekStart)
    context.value = result
  } catch {
    // 错误提示由请求拦截器统一处理
  } finally {
    contextLoading.value = false
  }
}

async function openExisting(): Promise<void> {
  if (!context.value?.existingReviewId) return
  await router.push({
    name: 'weekly-review-detail',
    params: { id: context.value.existingReviewId }
  })
}

async function handleWeekChange(value: string | null): Promise<void> {
  if (!value) return
  // Element Plus 的周选择器返回的是当前 locale 的“一周起点”。
  // 周日作为起点时，它属于次日的周一到周日周期；不能按普通日期归到上一周。
  const selected = parseDateOnly(value)
  if (selected.getDay() === 0) selected.setDate(selected.getDate() + 1)
  form.weekStart = weekStartOf(toDateString(selected))
  await loadContext(form.weekStart)
}

async function initialize(): Promise<void> {
  loading.value = true
  savedSnapshot.value = ''

  try {
    if (isNew.value) {
      const thisWeek = currentWeekStart()
      contextLoading.value = true
      try {
        const currentContext = await getWeeklyReviewContext(thisWeek)
        if (currentContext.existingReviewId) {
          // 本周已有复盘:周期留空,但立即显示提示方便用户跳到已有记录
          resetForm('')
          context.value = currentContext
        } else {
          resetForm(thisWeek)
          context.value = currentContext
        }
      } catch {
        // 无法确认本周状态时保持空周期,避免误选到已有复盘
        resetForm('')
      } finally {
        contextLoading.value = false
      }
      await nextTick()
      markClean()
      return
    }

    const record = await getWeeklyReview(editingId.value as number)
    fillForm(record)
    await nextTick()
    markClean()
  } catch {
    await router.replace({ name: 'weekly-reviews' })
  } finally {
    loading.value = false
  }
}

async function returnToDetail(recordId: number): Promise<void> {
  // 从详情进入编辑时直接回退,移除编辑页;不要 replace 出第二份详情历史
  if (!isNew.value && route.query.from === 'detail' && window.history.state?.back) {
    router.back()
    return
  }
  // 新建或直接打开编辑链接时,用 replace 避免返回后再进入已提交表单
  await router.replace({ name: 'weekly-review-detail', params: { id: recordId } })
}

async function save(mode: SubmitMode): Promise<void> {
  if (!form.weekStart) {
    ElMessage.warning(t('weeklyReview.weekRequired'))
    return
  }
  if (isNew.value && context.value?.existingReviewId) {
    ElMessage.warning(t('weeklyReview.existingWeekHint'))
    return
  }
  if (!hasContent()) {
    ElMessage.warning(t('weeklyReview.contentRequired'))
    return
  }
  if (mode === 'complete' && !form.summary.trim()) {
    ElMessage.warning(t('weeklyReview.summaryRequired'))
    return
  }

  submitting.value = mode
  try {
    let record: WeeklyReview
    if (isNew.value) {
      record = await createWeeklyReview(
        buildPayload(mode === 'complete' ? 'COMPLETED' : 'DRAFT')
      )
    } else {
      record = await updateWeeklyReview(
        editingId.value as number,
        buildPayload(mode === 'complete' ? 'COMPLETED' : undefined)
      )
    }

    const message = mode === 'complete'
      ? t('weeklyReview.completedSuccess')
      : mode === 'draft'
        ? t('weeklyReview.draftSaved')
        : t('weeklyReview.changesSaved')
    ElMessage.success(message)
    await returnToDetail(record.id)
  } catch {
    // 重复周等错误由请求拦截器统一提示
  } finally {
    submitting.value = null
  }
}

async function goBack(): Promise<void> {
  if (isDirty.value) {
    try {
      await ElMessageBox.confirm(t('weeklyReview.discardConfirm'), t('common.tip'), {
        type: 'warning',
        showClose: false,
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel')
      })
    } catch {
      return
    }
  }

  if (!isNew.value && window.history.state?.back) {
    router.back()
    return
  }
  await router.push(backTarget.value)
}

watch(
  () => [route.name, route.params.id].join('|'),
  initialize,
  { immediate: true }
)
</script>

<template>
  <div class="detail-page is-full has-actions">
    <div class="detail-header">
      <BackButton :fallback="backTarget" :custom-action="goBack" />
      <div class="detail-title">{{ pageTitle }}</div>
    </div>

    <div class="detail-container">
      <el-skeleton v-if="loading" :rows="10" animated />

      <div v-else class="weekly-editor-stack">
        <div class="weekly-period-block">
          <div v-if="periodExists" class="weekly-period-alert">
            <span>
              {{ $t('weeklyReview.existingWeekHint') }}
            </span>
            <el-button link type="primary" @click="openExisting">
              {{ $t('weeklyReview.openExisting') }}
            </el-button>
          </div>

          <WeeklyPeriodCard
            :title="$t('weeklyReview.weekLabel')"
          >
            <template v-if="isNew">
              <el-date-picker
                v-model="weekValue"
                type="week"
                value-format="YYYY-MM-DD"
                :format="weekPickerFormat"
                :placeholder="$t('weeklyReview.weekPlaceholder')"
                :disabled-date="disabledWeekDate"
                :clearable="false"
                class="weekly-form__period-picker"
                @change="handleWeekChange"
              />
              <span v-if="form.weekStart" class="weekly-form__period-range">
                {{ formatWeekRange(form.weekStart, weekEnd) }}
              </span>
              <span v-if="contextLoading" class="weekly-form__period-loading">
                {{ $t('common.loading') }}
              </span>
            </template>
            <div v-else class="weekly-period-card__readonly">
              {{ formatWeekRange(form.weekStart, weekEnd) }}
            </div>
          </WeeklyPeriodCard>
        </div>

        <template v-if="showReviewWorkspace">
          <el-skeleton v-if="contextLoading" :rows="8" animated class="weekly-context-skeleton" />
          <WeeklyContextPanel
            v-else-if="context"
            :week-start="context.weekStart"
            :week-end="context.weekEnd"
            :metrics="context.metrics"
            :days="context.days"
            :frozen="contextFrozen"
          />
        </template>

        <div v-if="showReviewWorkspace" class="info-card weekly-form">
          <section class="weekly-form__section">
            <div class="weekly-form__head">
              <h3 class="weekly-form__title">{{ $t('weeklyReview.summary') }}</h3>
            </div>
            <el-input
              v-model="form.summary"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 6 }"
              :maxlength="500"
              show-word-limit
              :placeholder="$t('weeklyReview.summaryPlaceholder')"
            />
          </section>

          <template v-for="section in sections" :key="section.field">
            <section class="weekly-form__section">
              <div class="weekly-form__head">
                <div>
                  <h3 class="weekly-form__title">{{ section.label }}</h3>
                  <p class="weekly-form__hint">{{ section.hint }}</p>
                </div>
              </div>

              <el-input
                v-model="form[section.field][0].content"
                class="weekly-form__input"
                type="textarea"
                :autosize="{ minRows: 3, maxRows: 6 }"
                :maxlength="500"
                show-word-limit
                :placeholder="section.placeholder"
              />
            </section>
          </template>
        </div>
      </div>
    </div>

    <div v-if="showReviewWorkspace" class="detail-actions">
      <el-button @click="goBack">{{ $t('common.cancel') }}</el-button>
      <template v-if="isCompleted">
        <el-button
          type="primary"
          :loading="submitting === 'changes'"
          :disabled="loading || contextLoading || periodExists || Boolean(submitting)"
          @click="save('changes')"
        >
          {{ $t('weeklyReview.saveChanges') }}
        </el-button>
      </template>
      <template v-else>
        <el-button
          :loading="submitting === 'draft'"
          :disabled="loading || contextLoading || periodExists || Boolean(submitting)"
          @click="save('draft')"
        >
          {{ $t('weeklyReview.saveDraft') }}
        </el-button>
        <el-button
          type="primary"
          :loading="submitting === 'complete'"
          :disabled="loading || contextLoading || periodExists || Boolean(submitting)"
          @click="save('complete')"
        >
          {{ $t('weeklyReview.completeReview') }}
        </el-button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.weekly-editor-stack {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.weekly-context-skeleton {
  min-height: 360px;
  padding: 24px;
  border-radius: 30px;
  background: var(--color-bg-card-1);
}

.weekly-period-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.weekly-period-alert {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 12px;
  padding: 10px 14px;
  border-radius: 14px;
  background: var(--color-warning-1);
  color: var(--color-warning-6);
  font-size: 12px;
  line-height: 18px;
}

.weekly-period-alert :deep(.el-button) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

.weekly-period-card__readonly {
  color: var(--color-text-1);
  font-size: 16px;
  font-weight: 500;
}

.weekly-form {
  padding-top: 24px;
}

.weekly-form__section {
  min-width: 0;
}

.weekly-form__section + .weekly-form__section {
  margin-top: 20px;
}

.weekly-form__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px 12px;
  margin-bottom: 12px;
}

.weekly-form__title {
  margin: 0;
  color: var(--color-text-1);
  font-size: 16px;
  font-weight: 500;
  line-height: 22px;
}

.weekly-form__hint {
  margin: 2px 0 0;
  color: var(--color-text-3);
  font-size: 12px;
  line-height: 18px;
}

.weekly-form__period-picker {
  width: 240px;
}

.weekly-form__period-range {
  color: var(--color-text-3);
  font-size: 13px;
}

.weekly-form__period-loading {
  color: var(--color-text-3);
  font-size: 12px;
}

.weekly-form__input {
  width: 100%;
  min-width: 0;
}

@media (max-width: 768px) {
  .weekly-form {
    padding-top: 18px;
  }

  .weekly-form__section + .weekly-form__section {
    margin-top: 16px;
  }

  .weekly-form__period-picker {
    width: 100%;
  }

}
</style>
