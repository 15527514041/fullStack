<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ArrowRight, RefreshRight } from '@element-plus/icons-vue'
import { getOverview } from '@/api/overview'
import { updateTodo } from '@/api/todo'
import AmountVisibilityIcon from '@/components/AmountVisibilityIcon.vue'
import ColorTag from '@/components/ColorTag.vue'
import MenuIcon from '@/components/MenuIcon.vue'
import OverviewEmptyArt from '@/components/OverviewEmptyArt.vue'
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
  return todo.dueDate < today.value ? t('overview.pending') : t('common.today')
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
      <section class="overview-card today-card">
        <header class="card-header">
          <div class="card-heading">
            <span class="card-icon"><MenuIcon name="overview" :size="22" /></span>
            <h2>{{ $t('overview.todayTitle') }}</h2>
          </div>
        </header>

        <div class="today-body">
          <section class="today-section">
            <header class="section-header">
              <h3>{{ $t('overview.continueThings') }}</h3>
              <el-button link type="primary" class="quiet-link" @click="router.push('/todos')">
                {{ $t('overview.openChecklist') }}
                <el-icon><ArrowRight /></el-icon>
              </el-button>
            </header>

            <div v-if="overview.tasks.focus.length" class="focus-list">
              <div
                v-for="todo in overview.tasks.focus.slice(0, 3)"
                :key="todo.id"
                class="focus-item"
              >
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
                    />
                  </span>
                </button>
                <span class="due-badge">{{ dueLabel(todo) }}</span>
              </div>
            </div>
            <div v-else class="calm-empty">
              <OverviewEmptyArt kind="tasks" />
              <div class="empty-title">{{ $t('overview.taskEmpty') }}</div>
              <div class="empty-text">{{ $t('overview.taskEmptyHint') }}</div>
            </div>
          </section>

          <section class="today-section plan-section">
            <header class="section-header">
              <h3>{{ $t('overview.planTitle') }}</h3>
              <el-button link type="primary" class="quiet-link" @click="router.push(planTarget)">
                {{ overview.plan.id ? $t('overview.viewPlan') : $t('overview.startPlan') }}
                <el-icon><ArrowRight /></el-icon>
              </el-button>
            </header>

            <template v-if="overview.plan.id">
              <div v-if="overview.plan.timeline.length" class="timeline">
                <div
                  v-for="item in overview.plan.timeline.slice(0, 3)"
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
              <div v-else class="calm-empty">
                <div class="empty-text">{{ $t('overview.noTimeline') }}</div>
              </div>

              <div class="plan-time-note">
                {{ $t('overview.planned') }} {{ formatDuration(overview.plan.plannedMinutes) || '0m' }}
                <span>·</span>
                {{ $t('overview.actual') }} {{ formatDuration(overview.plan.actualMinutes) || '0m' }}
              </div>
            </template>

            <div v-else class="calm-empty">
                <OverviewEmptyArt kind="schedule" />
              <div class="empty-title">{{ $t('overview.noPlanTitle') }}</div>
              <div class="empty-text">{{ $t('overview.noPlanText') }}</div>
            </div>
          </section>
        </div>
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
        </header>

        <div class="weekly-narrative">
          <template v-if="overview.weeklyReview.metrics.planDays || overview.weeklyReview.metrics.reflectionDays">
            <span v-if="overview.weeklyReview.metrics.planDays">
              {{ $t('overview.weeklyPlans', { count: overview.weeklyReview.metrics.planDays }) }}
            </span>
            <span
              v-if="overview.weeklyReview.metrics.planDays && overview.weeklyReview.metrics.reflectionDays"
              class="narrative-divider"
            >{{ locale === 'en_US' ? ' · ' : '、' }}</span>
            <span v-if="overview.weeklyReview.metrics.reflectionDays">
              {{ $t('overview.weeklyReflections', { count: overview.weeklyReview.metrics.reflectionDays }) }}
            </span>
          </template>
          <span v-else>{{ $t('overview.weeklyEmptyNarrative') }}</span>
        </div>

        <div class="review-panel">
          <div class="review-copy">
            <span>{{ $t('weeklyReview.title') }} · {{ weeklyReviewStatus }}</span>
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
  display: flex;
  width: 100%;
  max-width: 1380px;
  min-height: 100%;
  flex-direction: column;
  margin: 0 auto;
}

.overview-hero {
  display: flex;
  min-height: 144px;
  align-items: center;
  padding: 24px 28px;
  border-radius: 24px;
  background: var(--color-brand-6);
  color: var(--color-on-brand);
}

.hero-title {
  margin: 0 0 6px;
  color: var(--color-on-brand);
  font-size: clamp(24px, 2.8vw, 34px);
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
  grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.75fr);
  gap: 18px;
  flex: 1;
  align-items: stretch;
  margin-top: 18px;
}

.overview-card {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  padding: 22px;
  border: 1px solid var(--color-border);
  border-radius: 20px;
  background: var(--color-bg-card);
}

.today-card {
  grid-row: span 2;
}

.weekly-card {
  grid-column: 2;
  grid-row: 1;
}

.finance-card {
  grid-column: 2;
  grid-row: 2;
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

.today-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  flex: 1;
  column-gap: 44px;
  margin-top: 22px;
}

.today-section {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.today-section + .today-section {
  position: relative;
}

.today-section + .today-section::before {
  position: absolute;
  top: 18px;
  bottom: 18px;
  left: -22px;
  width: 1px;
  background: var(--color-divider);
  content: '';
}

.section-header {
  display: flex;
  min-height: 30px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.section-header h3 {
  margin: 0;
  color: var(--color-text-2);
  font-size: 13px;
  font-weight: 600;
}

.section-header .el-icon {
  margin-left: 2px;
}

.section-header .quiet-link {
  color: var(--color-text-3);
  font-size: 12px;
}

.section-header .quiet-link:hover {
  color: var(--color-brand-6);
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
  background: var(--color-bg-bottom);
  color: var(--color-text-3);
  font-size: 11px;
  line-height: 18px;
}

.calm-empty {
  display: flex;
  flex: 1;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  min-height: 180px;
  padding: 16px;
  text-align: center;
}

.empty-title {
  color: var(--color-text-2);
  font-size: 14px;
  font-weight: 500;
}

.empty-text {
  max-width: 230px;
  margin-top: 4px;
  color: var(--color-text-3);
  font-size: 12px;
  line-height: 18px;
}

.plan-time-note {
  margin-top: auto;
  padding-top: 12px;
  color: var(--color-text-3);
  font-size: 11px;
}

.plan-time-note span {
  margin: 0 5px;
  color: var(--color-text-4);
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

.weekly-narrative {
  margin: 22px 0 14px;
  color: var(--color-text-2);
  font-size: 14px;
  line-height: 22px;
}

.narrative-divider {
  margin: 0 5px;
  color: var(--color-text-4);
}

.review-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px;
  border-radius: 16px;
  background: var(--color-bg-bottom);
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

@media (max-width: 1080px) {
  .overview-grid {
    grid-template-columns: 1fr;
    flex: none;
  }

  .today-card,
  .weekly-card,
  .finance-card {
    grid-column: auto;
    grid-row: auto;
  }

  .overview-card {
    min-height: 0;
  }
}

@media (max-width: 768px) {
  .overview-hero {
    min-height: 116px;
    padding: 20px;
    border-radius: 20px;
  }

  .hero-title {
    margin-top: 0;
    font-size: 25px;
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

  .today-body {
    grid-template-columns: 1fr;
  }

  .today-section + .today-section {
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px solid var(--color-divider);
  }

  .today-section + .today-section::before {
    display: none;
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
