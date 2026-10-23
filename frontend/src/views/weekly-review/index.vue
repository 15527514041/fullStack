<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Plus } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { getWeeklyReviews } from '@/api/weeklyReview'
import InfoTipIcon from '@/components/InfoTipIcon.vue'
import { useFeedList } from '@/composables/useFeedList'
import {
  currentWeekStart,
  formatWeekRange,
  previousWeekStart
} from '@/utils/datetime'
import type { WeeklyReviewListItem } from '@/types'

const router = useRouter()
const { t } = useI18n()

const range = ref<{ from?: string; to?: string }>({})
const sentinelRef = ref<HTMLElement | null>(null)
const fetchReviews = (params: { page: number; pageSize: number }) => getWeeklyReviews(params)
const { items, loading, loadingMore, hasMore } = useFeedList<WeeklyReviewListItem>(
  fetchReviews,
  range,
  sentinelRef
)

const thisWeek = currentWeekStart()
const lastWeek = previousWeekStart()
const currentReview = computed(() => items.value.find((item) => item.weekStart === thisWeek))
const showCurrentPlaceholder = computed(() => !loading.value && !currentReview.value)

function badge(row: { weekStart: string }): string {
  if (row.weekStart === thisWeek) return t('weeklyReview.currentBadge')
  if (row.weekStart === lastWeek) return t('weeklyReview.previousBadge')
  return ''
}

function statusText(status: WeeklyReviewListItem['status']): string {
  return status === 'COMPLETED'
    ? t('weeklyReview.statusCompleted')
    : t('weeklyReview.statusDraft')
}

function todoText(row: WeeklyReviewListItem): string {
  return row.metrics.todoTotal
    ? t('weeklyReview.todoMetric', {
        done: row.metrics.todoCompleted,
        total: row.metrics.todoTotal
      })
    : t('weeklyReview.noTodo')
}

function summaryMetrics(row: WeeklyReviewListItem): Array<{
  key: string
  text: string
  help: string
}> {
  return [
    {
      key: 'plan',
      text: t('weeklyReview.planMetric', { days: row.metrics.planDays }),
      help: t('weeklyReview.planDaysHelp')
    },
    {
      key: 'todo',
      text: todoText(row),
      help: t('weeklyReview.todoCompletionHelp')
    },
    {
      key: 'reflection',
      text: t('weeklyReview.reflectionMetric', { days: row.metrics.reflectionDays }),
      help: t('weeklyReview.reflectionDaysHelp')
    }
  ]
}

function openCreate(): void {
  router.push({ name: 'weekly-review-new' })
}

function openDetail(row: WeeklyReviewListItem): void {
  router.push({ name: 'weekly-review-detail', params: { id: row.id } })
}
</script>

<template>
  <div class="feed-page">
    <div class="feed-head">
      <div class="title-section">
        <div class="main-title">{{ $t('weeklyReview.title') }}</div>
        <div class="subtitle">{{ $t('weeklyReview.subtitle') }}</div>
      </div>
      <el-button type="primary" class="add-button" @click="openCreate">
        <el-icon><Plus /></el-icon>{{ $t('weeklyReview.addButton') }}
      </el-button>
    </div>

    <div class="feed-section weekly-feed">
      <el-skeleton v-if="loading" :rows="4" animated />

      <template v-else>
        <div
          v-if="showCurrentPlaceholder"
          class="feed-card weekly-card weekly-card--pending"
          @click="openCreate"
        >
          <div class="card-content">
            <div class="card-left">
              <div class="card-title-row">
                <span class="card-title">{{ formatWeekRange(thisWeek) }}</span>
                <span class="pill pill--current">{{ $t('weeklyReview.currentBadge') }}</span>
                <span class="pill pill--status">{{ $t('weeklyReview.notStarted') }}</span>
              </div>
              <div class="card-summary">{{ $t('weeklyReview.currentEmptySummary') }}</div>
            </div>
            <div class="card-right"><el-icon><ArrowRight /></el-icon></div>
          </div>
        </div>

        <div
          v-for="row in items"
          :key="row.id"
          class="feed-card weekly-card"
          @click="openDetail(row)"
        >
          <div class="card-content">
            <div class="card-left">
              <div class="card-title-row">
                <span class="card-title">{{ formatWeekRange(row.weekStart, row.weekEnd) }}</span>
                <span v-if="badge(row)" class="pill" :class="{ 'pill--current': row.weekStart === thisWeek }">
                  {{ badge(row) }}
                </span>
                <span
                  class="pill pill--status"
                  :class="{ 'pill--completed': row.status === 'COMPLETED' }"
                >
                  {{ statusText(row.status) }}
                </span>
              </div>
              <div class="weekly-card__summary">
                {{ row.summary || $t('weeklyReview.summaryEmpty') }}
              </div>
              <div class="weekly-card__metrics">
                <span
                  v-for="metric in summaryMetrics(row)"
                  :key="metric.key"
                  class="weekly-card__metric"
                >
                  <InfoTipIcon :content="metric.help" :size="12" />
                  <span>{{ metric.text }}</span>
                </span>
              </div>
            </div>
            <div class="card-right"><el-icon><ArrowRight /></el-icon></div>
          </div>
        </div>

        <el-empty
          v-if="!items.length && !showCurrentPlaceholder"
          class="feed-empty"
          :description="$t('weeklyReview.empty')"
        />

        <div v-if="items.length" ref="sentinelRef" class="feed-more">
          <span v-if="loadingMore">{{ $t('common.loading') }}</span>
          <span v-else-if="!hasMore">{{ $t('common.noMore') }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.weekly-feed {
  padding-top: 4px;
}

.weekly-card__summary {
  overflow: hidden;
  color: var(--color-text-3);
  font-size: 13px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weekly-card__metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-top: 8px;
  color: var(--color-text-2);
  font-size: 12px;
}

.weekly-card__metric {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.weekly-card__metric + .weekly-card__metric::before {
  content: '';
  display: inline-block;
  width: 1px;
  height: 10px;
  margin-right: 16px;
  vertical-align: -1px;
  background: var(--color-border);
}

.weekly-card--pending {
  border-style: dashed;
  border-color: var(--color-border);
  box-shadow: none;
}

.pill--current {
  background: var(--color-warning-1) !important;
  color: var(--color-warning-6) !important;
}

.pill--status {
  background: var(--color-bg-bottom) !important;
  color: var(--color-text-3) !important;
}

.pill--completed {
  background: var(--color-brand-2) !important;
  color: var(--color-brand-6) !important;
}

@media (max-width: 768px) {
  .weekly-card__metric + .weekly-card__metric::before {
    display: none;
  }
}
</style>
