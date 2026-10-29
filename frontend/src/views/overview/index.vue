<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowRight, RefreshRight } from '@element-plus/icons-vue'
import { getOverview } from '@/api/overview'
import { updateTodo } from '@/api/todo'
import AmountVisibilityIcon from '@/components/AmountVisibilityIcon.vue'
import ColorTag from '@/components/ColorTag.vue'
import MenuIcon from '@/components/MenuIcon.vue'
import { useAuthStore } from '@/stores/auth'
import {
  formatCents
} from '@/utils/money'
import {
  formatDayHeading,
  formatDuration,
  formatWeekRange,
  toDateString
} from '@/utils/datetime'
import type { OverviewData, OverviewTodo } from '@/types'

const router = useRouter()
const authStore = useAuthStore()
const { t, locale } = useI18n()

const today = ref(toDateString(new Date()))
const overview = ref<OverviewData | null>(null)
const loading = ref(false)
const loadFailed = ref(false)
const completingTodoId = ref<number | null>(null)
const amountsVisible = ref(false)
const MASKED_AMOUNT = '••••••'

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return t('overview.greetingEvening')
  if (hour < 12) return t('overview.greetingMorning')
  if (hour < 14) return t('overview.greetingNoon')
  if (hour < 18) return t('overview.greetingAfternoon')
  return t('overview.greetingEvening')
})

const todayHeading = computed(() => {
  locale.value
  return formatDayHeading(today.value)
})

const planPercentage = computed(() => {
  const plan = overview.value?.plan
  if (!plan?.todoTotal) return 0
  return Math.round((plan.todoCompleted / plan.todoTotal) * 100)
})

const planTarget = computed(() =>
  overview.value?.plan.id ? `/plans/${overview.value.plan.id}` : '/plans'
)

const weeklyReviewTarget = computed(() => {
  const review = overview.value?.weeklyReview
  if (!review?.existingReviewId) return '/weekly-reviews/new'
  return review.status === 'COMPLETED'
    ? `/weekly-reviews/${review.existingReviewId}`
    : `/weekly-reviews/${review.existingReviewId}/edit`
})

const weeklyReviewStatus = computed(() => {
  const status = overview.value?.weeklyReview.status
  if (status === 'COMPLETED') return t('overview.reviewCompleted')
  if (status === 'DRAFT') return t('overview.reviewDraft')
  return t('overview.reviewNotStarted')
})

const weeklyReviewAction = computed(() => {
  const review = overview.value?.weeklyReview
  if (!review?.existingReviewId) return t('overview.startReview')
  return review.status === 'COMPLETED' ? t('overview.viewReview') : t('overview.continueReview')
})

const weeklySummary = computed(() => {
  return overview.value?.weeklyReview.summary || t('weeklyReview.summaryEmpty')
})

const amountToggleLabel = computed(() =>
  t(amountsVisible.value ? 'overview.hideAmounts' : 'overview.showAmounts')
)

function displayAmount(cents: number): string {
  return amountsVisible.value ? formatCents(cents) : MASKED_AMOUNT
}

function dueLabel(todo: OverviewTodo): string {
  return todo.dueDate < today.value ? t('overview.overdue') : t('overview.dueToday')
}

async function loadOverview(showLoading = true): Promise<void> {
  if (showLoading) loading.value = true
  loadFailed.value = false
  try {
    overview.value = await getOverview(today.value)
  } catch {
    loadFailed.value = true
  } finally {
    if (showLoading) loading.value = false
  }
}

async function completeTodo(todo: OverviewTodo): Promise<void> {
  if (todo.completed || completingTodoId.value !== null) return
  completingTodoId.value = todo.id
  try {
    await updateTodo(todo.id, { completed: true })
    ElMessage.success(t('overview.taskCompleted'))
    await loadOverview(false)
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  } finally {
    completingTodoId.value = null
  }
}

onMounted(() => loadOverview())
</script>

<template>
  <div class="overview-page">
    <section class="overview-hero">
      <div class="hero-copy">
        <h1 class="hero-title">{{ greeting }}，{{ authStore.user?.username || $t('navbar.defaultUser') }}</h1>
        <div class="hero-date">{{ todayHeading }}</div>
      </div>
    </section>

    <div v-if="loading && !overview" class="overview-skeleton">
      <el-skeleton :rows="8" animated />
    </div>

    <div v-else-if="loadFailed && !overview" class="overview-error">
      <el-empty :description="$t('overview.loadingFailed')">
        <el-button type="primary" plain @click="loadOverview()">
          <el-icon><RefreshRight /></el-icon>
          {{ $t('overview.retry') }}
        </el-button>
      </el-empty>
    </div>

    <div v-else-if="overview" class="overview-grid">
      <section class="overview-card task-card">
        <header class="card-header">
          <div class="card-heading">
            <span class="card-icon"><MenuIcon name="checklist" :size="22" /></span>
            <div>
              <h2>{{ $t('overview.taskTitle') }}</h2>
              <p>{{ $t('overview.taskSubtitle') }}</p>
            </div>
          </div>
          <el-button link type="primary" class="card-link" @click="router.push('/todos')">
            {{ $t('overview.openChecklist') }}
            <el-icon><ArrowRight /></el-icon>
          </el-button>
        </header>

        <div class="task-metrics">
          <div class="task-metric">
            <strong>{{ overview.tasks.dueToday }}</strong>
            <span>{{ $t('overview.dueToday') }}</span>
          </div>
          <div class="task-metric is-overdue">
            <strong>{{ overview.tasks.overdue }}</strong>
            <span>{{ $t('overview.overdue') }}</span>
          </div>
        </div>

        <div v-if="overview.tasks.focus.length" class="focus-list">
          <div v-for="todo in overview.tasks.focus" :key="todo.id" class="focus-item">
            <el-checkbox
              :model-value="todo.completed"
              :disabled="completingTodoId !== null"
              :aria-label="todo.title"
              @change="completeTodo(todo)"
            />
            <button type="button" class="focus-main" @click="router.push(`/todos/${todo.id}`)">
              <span class="focus-title">{{ todo.title }}</span>
              <span v-if="todo.tags.length" class="focus-tags">
                <ColorTag
                  v-for="tag in todo.tags"
                  :key="tag.id"
                  :name="tag.name"
                  :color="tag.color"
                  size="small"
                />
              </span>
            </button>
            <span class="due-badge" :class="{ 'is-overdue': todo.dueDate < today }">
              {{ dueLabel(todo) }}
            </span>
          </div>
        </div>

        <el-empty v-else :image-size="58" class="card-empty">
          <template #description>
            <div class="empty-title">{{ $t('overview.taskEmpty') }}</div>
            <div class="empty-text">{{ $t('overview.taskEmptyHint') }}</div>
          </template>
        </el-empty>
      </section>

      <section class="overview-card plan-card">
        <header class="card-header">
          <div class="card-heading">
            <span class="card-icon"><MenuIcon name="schedule" :size="22" /></span>
            <div>
              <h2>{{ $t('overview.planTitle') }}</h2>
              <p>{{ $t('overview.planSubtitle') }}</p>
            </div>
          </div>
          <el-button link type="primary" class="card-link" @click="router.push(planTarget)">
            {{ overview.plan.id ? $t('overview.viewPlan') : $t('overview.startPlan') }}
            <el-icon><ArrowRight /></el-icon>
          </el-button>
        </header>

        <template v-if="overview.plan.id">
          <div class="plan-progress">
            <div class="progress-copy">
              <span>{{ $t('overview.planProgress') }}</span>
              <strong>{{ overview.plan.todoCompleted }} / {{ overview.plan.todoTotal }}</strong>
            </div>
            <el-progress
              :percentage="planPercentage"
              :show-text="false"
              :stroke-width="8"
            />
          </div>

          <div class="time-summary">
            <div>
              <span>{{ $t('overview.planned') }}</span>
              <strong>{{ formatDuration(overview.plan.plannedMinutes) || '0m' }}</strong>
            </div>
            <div>
              <span>{{ $t('overview.actual') }}</span>
              <strong>{{ formatDuration(overview.plan.actualMinutes) || '0m' }}</strong>
            </div>
          </div>

          <div v-if="overview.plan.timeline.length" class="timeline">
            <div
              v-for="item in overview.plan.timeline"
              :key="item.id"
              class="timeline-item"
            >
              <span class="timeline-time">{{ item.startTime }}</span>
              <span class="timeline-dot" :class="{ 'is-important': item.important }" />
              <div class="timeline-copy">
                <span class="timeline-name">{{ item.name }}</span>
                <span class="timeline-duration">
                  {{ item.startTime }}–{{ item.endTime }}
                  <template v-if="item.durationMinutes !== null"> · {{ formatDuration(item.durationMinutes) }}</template>
                </span>
              </div>
            </div>
          </div>
          <div v-else class="quiet-empty">{{ $t('overview.noTimeline') }}</div>
        </template>

        <el-empty v-else :image-size="58" class="card-empty plan-empty">
          <template #description>
            <div class="empty-title">{{ $t('overview.noPlanTitle') }}</div>
            <div class="empty-text">{{ $t('overview.noPlanText') }}</div>
          </template>
        </el-empty>
      </section>

      <section class="overview-card weekly-card">
        <header class="card-header">
          <div class="card-heading">
            <span class="card-icon"><MenuIcon name="review" :size="22" /></span>
            <div>
              <h2>{{ $t('overview.weeklyTitle') }}</h2>
              <p>{{ formatWeekRange(overview.weeklyReview.weekStart, overview.weeklyReview.weekEnd) }}</p>
            </div>
          </div>
          <span class="status-pill" :class="`is-${(overview.weeklyReview.status || 'none').toLowerCase()}`">
            {{ weeklyReviewStatus }}
          </span>
        </header>

        <div class="weekly-metrics">
          <div>
            <span>{{ $t('overview.planDays') }}</span>
            <strong>{{ overview.weeklyReview.metrics.planDays }}<small>/7</small></strong>
          </div>
          <div>
            <span>{{ $t('overview.reflectionDays') }}</span>
            <strong>{{ overview.weeklyReview.metrics.reflectionDays }}<small>/7</small></strong>
          </div>
        </div>

        <div class="review-panel">
          <div class="review-copy">
            <span>{{ $t('weeklyReview.title') }}</span>
            <p>{{ weeklySummary }}</p>
          </div>
          <el-button type="primary" plain @click="router.push(weeklyReviewTarget)">
            {{ weeklyReviewAction }}
          </el-button>
        </div>

      </section>

      <section class="overview-card finance-card">
        <header class="card-header">
          <div class="card-heading">
            <span class="card-icon"><MenuIcon name="wallet" :size="22" /></span>
            <h2>{{ $t('overview.financeTitle') }}</h2>
          </div>
          <el-tooltip :content="amountToggleLabel" placement="top">
            <button
              type="button"
              class="amount-toggle"
              :aria-label="amountToggleLabel"
              :aria-pressed="amountsVisible"
              @click="amountsVisible = !amountsVisible"
            >
              <AmountVisibilityIcon :visible="amountsVisible" :size="18" />
            </button>
          </el-tooltip>
        </header>

        <div class="finance-hero">
          <span>{{ $t('overview.netAssets') }}</span>
          <strong :class="{ 'is-negative': overview.finance.netAssetsCents < 0 }">
            {{ displayAmount(overview.finance.netAssetsCents) }}
          </strong>
        </div>

        <div class="asset-row">
          <div>
            <span>{{ $t('overview.assets') }}</span>
            <strong>{{ displayAmount(overview.finance.totalAssetsCents) }}</strong>
          </div>
          <div>
            <span>{{ $t('overview.debt') }}</span>
            <strong class="is-debt">{{ displayAmount(overview.finance.totalDebtCents) }}</strong>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.overview-page {
  width: 100%;
  max-width: 1380px;
  margin: 0 auto;
}

.overview-hero {
  display: flex;
  min-height: 150px;
  align-items: center;
  padding: 28px 30px;
  border-radius: 24px;
  background: var(--color-brand-6);
  color: var(--color-on-brand);
}

.hero-title {
  margin: 0 0 6px;
  color: var(--color-on-brand);
  font-size: clamp(26px, 3vw, 38px);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.035em;
}

.hero-date {
  color: var(--color-on-brand-secondary);
  font-size: 14px;
  font-weight: 500;
}

.overview-skeleton,
.overview-error {
  margin-top: 18px;
  padding: 32px;
  border: 1px solid var(--color-border);
  border-radius: 24px;
  background: var(--color-bg-card);
}

.overview-grid {
  --overview-metric-height: 74px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin-top: 18px;
}

.overview-card {
  display: flex;
  min-width: 0;
  min-height: 330px;
  flex-direction: column;
  padding: 24px;
  border: 1px solid var(--color-border);
  border-radius: 24px;
  background: var(--color-bg-card);
  box-shadow: var(--shadow-control);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.overview-card:hover {
  border-color: var(--color-brand-2);
  box-shadow: var(--shadow-card-lg);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.card-heading {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.card-icon {
  display: inline-flex;
  width: 44px;
  height: 44px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: var(--color-brand-1);
  color: var(--color-brand-6);
}

.card-heading h2 {
  margin: 0;
  color: var(--color-text-1);
  font-size: 17px;
  font-weight: 650;
  line-height: 24px;
}

.card-heading p {
  margin: 2px 0 0;
  overflow: hidden;
  color: var(--color-text-3);
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-link {
  flex: none;
  min-height: 30px;
}

.card-link .el-icon {
  margin-left: 2px;
}

.task-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 22px 0 16px;
}

.task-metric {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--color-bg-bottom);
}

.task-metric strong {
  color: var(--color-text-1);
  font-size: 24px;
  line-height: 1;
}

.task-metric span {
  color: var(--color-text-3);
  font-size: 12px;
}

.task-metric.is-overdue strong {
  color: var(--el-color-danger);
}

.focus-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.focus-item {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  padding: 10px 2px;
  border-bottom: 1px solid var(--color-divider);
}

.focus-item:last-child {
  border-bottom: 0;
}

.focus-main {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.focus-main:hover .focus-title {
  color: var(--color-brand-6);
}

.focus-title {
  overflow: hidden;
  color: var(--color-text-1);
  font-size: 14px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.2s ease;
}

.focus-tags {
  display: inline-flex;
  min-width: 0;
  gap: 4px;
  overflow: hidden;
}

.due-badge {
  flex: none;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--color-brand-1);
  color: var(--color-brand-6);
  font-size: 11px;
  line-height: 18px;
}

.due-badge.is-overdue {
  background: var(--color-danger-1);
  color: var(--color-danger-7);
}

.card-empty {
  flex: 1;
  padding: 4px 0 0;
}

.empty-title {
  color: var(--color-text-2);
  font-size: 14px;
  font-weight: 500;
}

.empty-text {
  margin-top: 4px;
  color: var(--color-text-3);
  font-size: 12px;
  line-height: 18px;
}

.plan-progress {
  margin-top: 24px;
}

.progress-copy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 9px;
  color: var(--color-text-3);
  font-size: 12px;
}

.progress-copy strong {
  color: var(--color-text-1);
  font-size: 14px;
}

.plan-progress :deep(.el-progress-bar__outer) {
  background: var(--color-bg-bottom);
}

.time-summary {
  display: flex;
  gap: 22px;
  margin: 14px 0 10px;
}

.time-summary div {
  display: flex;
  align-items: baseline;
  gap: 7px;
}

.time-summary span {
  color: var(--color-text-3);
  font-size: 12px;
}

.time-summary strong {
  color: var(--color-text-1);
  font-size: 14px;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
}

.timeline-item {
  display: grid;
  grid-template-columns: 46px 10px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 46px;
}

.timeline-time {
  color: var(--color-text-3);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.timeline-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-brand-3);
  box-shadow: 0 0 0 4px var(--color-brand-1);
}

.timeline-dot.is-important {
  background: var(--color-brand-accent);
  box-shadow: 0 0 0 4px var(--color-warning-1);
}

.timeline-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
}

.timeline-name {
  overflow: hidden;
  color: var(--color-text-1);
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timeline-duration {
  color: var(--color-text-3);
  font-size: 11px;
}

.quiet-empty {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 100px;
  color: var(--color-text-3);
  font-size: 13px;
}

.plan-empty {
  justify-content: center;
}

.status-pill {
  flex: none;
  padding: 4px 9px;
  border-radius: 999px;
  background: var(--color-bg-bottom);
  color: var(--color-text-3);
  font-size: 11px;
}

.status-pill.is-draft {
  background: var(--color-warning-1);
  color: var(--color-warning-7);
}

.status-pill.is-completed {
  background: var(--color-success-1);
  color: var(--color-success-7);
}

.weekly-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 22px 0 14px;
}

.weekly-metrics > div {
  display: flex;
  height: var(--overview-metric-height);
  box-sizing: border-box;
  flex-direction: column;
  justify-content: center;
  padding: 13px;
  border-radius: 14px;
  background: var(--color-bg-bottom);
}

.weekly-metrics span {
  display: block;
  color: var(--color-text-3);
  font-size: 11px;
}

.weekly-metrics strong {
  display: block;
  margin-top: 5px;
  color: var(--color-text-1);
  font-size: 22px;
  font-weight: 650;
}

.weekly-metrics small {
  margin-left: 2px;
  color: var(--color-text-3);
  font-size: 11px;
  font-weight: 500;
}

.review-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 16px;
}

.review-copy {
  min-width: 0;
}

.review-copy span {
  color: var(--color-text-3);
  font-size: 11px;
}

.review-copy p {
  margin: 3px 0 0;
  overflow: hidden;
  color: var(--color-text-2);
  font-size: 13px;
  line-height: 19px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.amount-toggle {
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex: none;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--color-text-3);
  cursor: pointer;
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
}

.amount-toggle:hover {
  background: var(--color-brand-1);
  color: var(--color-brand-6);
}

.amount-toggle:focus-visible {
  outline: 2px solid var(--color-brand-2);
  outline-offset: 1px;
}

.finance-hero {
  display: flex;
  height: var(--overview-metric-height);
  box-sizing: border-box;
  flex-direction: column;
  justify-content: center;
  margin-top: 22px;
  padding: 10px 20px;
  border: 1px solid var(--color-brand-2);
  border-radius: 18px;
  background: var(--color-brand-1);
  color: var(--color-text-1);
}

.finance-hero span {
  color: var(--color-text-2);
  font-size: 12px;
}

.finance-hero strong {
  display: block;
  margin-top: 4px;
  font-size: clamp(22px, 2.4vw, 29px);
  line-height: 1.15;
  letter-spacing: -0.02em;
  word-break: break-all;
}

.finance-hero strong.is-negative {
  color: var(--el-color-danger);
}

.asset-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.asset-row div {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.asset-row span {
  color: var(--color-text-3);
  font-size: 11px;
}

.asset-row strong {
  color: var(--color-text-1);
  font-size: 14px;
}

.asset-row strong.is-debt {
  color: var(--color-warning-7);
}

@media (max-width: 1080px) {
  .overview-grid {
    grid-template-columns: 1fr;
  }

  .overview-card {
    min-height: 0;
  }
}

@media (max-width: 768px) {
  .overview-hero {
    min-height: 124px;
    padding: 22px 20px;
    border-radius: 20px;
  }

  .hero-title {
    margin-top: 12px;
    font-size: 27px;
  }

  .overview-grid {
    gap: 12px;
    margin-top: 12px;
  }

  .overview-card {
    padding: 18px;
    border-radius: 20px;
  }

  .card-header {
    gap: 10px;
  }

  .card-icon {
    width: 40px;
    height: 40px;
    border-radius: 13px;
  }

  .card-heading h2 {
    font-size: 16px;
  }

  .card-link {
    padding-left: 4px;
    padding-right: 0;
  }

  .weekly-metrics > div {
    padding: 11px 10px;
  }

  .weekly-metrics strong {
    font-size: 19px;
  }

  .review-panel {
    align-items: stretch;
    flex-direction: column;
  }

  .review-panel .el-button {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .task-metrics,
  .asset-row {
    grid-template-columns: 1fr;
  }

  .focus-item {
    align-items: flex-start;
  }

  .focus-main {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }

  .focus-tags {
    flex-wrap: wrap;
  }

  .card-heading p {
    max-width: 180px;
  }
}
</style>
