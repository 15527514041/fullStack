<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import InfoTipIcon from '@/components/InfoTipIcon.vue'
import type { WeeklyReviewDay, WeeklyReviewMetrics } from '@/types'
import {
  formatDate,
  formatDuration,
  formatWeekRange,
  formatWeekday
} from '@/utils/datetime'

const props = withDefaults(
  defineProps<{
    weekStart: string
    weekEnd: string
    metrics: WeeklyReviewMetrics
    days: WeeklyReviewDay[]
    frozen?: boolean
    interactive?: boolean
  }>(),
  { frozen: false, interactive: false }
)

const router = useRouter()
const { t } = useI18n()

const metricItems = computed(() => [
  {
    key: 'plan',
    text: t('weeklyReview.planMetric', { days: props.metrics.planDays }),
    help: t('weeklyReview.planDaysHelp')
  },
  {
    key: 'todo',
    text: props.metrics.todoTotal
      ? t('weeklyReview.todoMetric', { total: props.metrics.todoTotal })
      : t('weeklyReview.noTodo'),
    help: t('weeklyReview.todoCompletionHelp')
  },
  {
    key: 'planned',
    text: t('weeklyReview.plannedMetric', {
      duration: formatDuration(props.metrics.plannedMinutes) || '0m'
    }),
    help: t('weeklyReview.plannedMinutesHelp')
  },
  {
    key: 'actual',
    text: t('weeklyReview.actualMetric', {
      duration: formatDuration(props.metrics.actualMinutes) || '0m'
    }),
    help: t('weeklyReview.actualMinutesHelp')
  },
  {
    key: 'reflection',
    text: t('weeklyReview.reflectionMetric', { days: props.metrics.reflectionDays }),
    help: t('weeklyReview.reflectionDaysHelp')
  }
])

function openPlan(day: WeeklyReviewDay): void {
  if (!day.planId) return
  router.push({ name: 'plan-detail', params: { id: day.planId } })
}

function openReflection(day: WeeklyReviewDay): void {
  if (!day.reflectionId) return
  router.push({ name: 'reflection-detail', params: { id: day.reflectionId } })
}
</script>

<template>
  <section class="weekly-context">
    <div class="weekly-context__head">
      <div>
        <h3 class="weekly-context__title">{{ $t('weeklyReview.weeklyData') }}</h3>
        <p class="weekly-context__range">{{ formatWeekRange(weekStart, weekEnd) }}</p>
      </div>
      <span class="weekly-context__mode">
        {{ frozen ? $t('weeklyReview.snapshotData') : $t('weeklyReview.liveData') }}
      </span>
    </div>

    <div class="weekly-context__metrics">
      <div v-for="metric in metricItems" :key="metric.key" class="metric">
        <InfoTipIcon :content="metric.help" :size="12" />
        <span class="metric__text">{{ metric.text }}</span>
      </div>
    </div>

    <div class="weekly-context__days">
      <article v-for="day in days" :key="day.date" class="context-day">
        <div class="context-day__date">
          <span class="context-day__weekday">{{ formatWeekday(day.date) }}</span>
          <span class="context-day__number">{{ formatDate(day.date).slice(5) }}</span>
        </div>

        <div class="context-day__body">
          <div class="context-day__facts">
            <span>
              {{
                day.planId && day.todoTotal
                  ? $t('weeklyReview.todoMetric', { total: day.todoTotal })
                  : $t('weeklyReview.noData')
              }}
            </span>
            <span v-if="day.planId">
              {{ $t('weeklyReview.dayDuration', {
                planned: formatDuration(day.plannedMinutes) || '0m',
                actual: formatDuration(day.actualMinutes) || '0m'
              }) }}
            </span>
            <span>{{ day.reflectionCount ? $t('weeklyReview.reflectionCount', { count: day.reflectionCount }) : $t('weeklyReview.noData') }}</span>
          </div>
          <p v-if="day.reflectionSummary" class="context-day__summary">{{ day.reflectionSummary }}</p>
        </div>

        <div v-if="interactive" class="context-day__actions">
          <el-button v-if="day.planId" link type="primary" @click="openPlan(day)">
            {{ $t('weeklyReview.openPlan') }}
          </el-button>
          <el-button v-if="day.reflectionId" link type="primary" @click="openReflection(day)">
            {{ $t('weeklyReview.openReflection') }}
          </el-button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.weekly-context {
  padding: 22px;
  border-radius: 30px;
  background: var(--color-bg-card-1);
  box-shadow: var(--shadow-card-lg);
}

.weekly-context__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.weekly-context__title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
}

.weekly-context__range {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-3);
}

.weekly-context__mode {
  flex-shrink: 0;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--color-bg-bottom);
  color: var(--color-text-3);
  font-size: 11px;
}

.weekly-context__metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 16px;
  padding: 12px 6px;
  border-radius: 16px;
  background: var(--color-bg-bottom);
}

.metric {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: var(--color-text-2);
  font-size: 12px;
}

.metric__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric :deep(.info-tip) {
  flex-shrink: 0;
}

.weekly-context__days {
  display: flex;
  flex-direction: column;
}

.context-day {
  display: flex;
  gap: 10px;
  min-width: 0;
  padding: 12px 0;
  border-top: 1px solid var(--color-border);
}

.context-day:first-child {
  border-top: none;
}

.context-day__date {
  flex: 0 0 42px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.context-day__weekday {
  color: var(--color-text-1);
  font-size: 12px;
  font-weight: 500;
}

.context-day__number {
  color: var(--color-text-3);
  font-size: 11px;
}

.context-day__body {
  flex: 1;
  min-width: 0;
}

.context-day__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  color: var(--color-text-2);
  font-size: 12px;
  line-height: 18px;
}

.context-day__summary {
  display: -webkit-box;
  overflow: hidden;
  margin: 4px 0 0;
  color: var(--color-text-3);
  font-size: 12px;
  line-height: 18px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.context-day__actions {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.context-day__actions :deep(.el-button) {
  height: 20px;
  padding: 0;
  font-size: 12px;
}

@media (max-width: 1180px) {
  .weekly-context__metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    row-gap: 10px;
  }
}

@media (max-width: 768px) {
  .weekly-context {
    padding: 18px;
    border-radius: 24px;
  }

  .weekly-context__metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .context-day {
    flex-wrap: wrap;
  }

  .context-day__actions {
    flex: 1 1 100%;
    flex-direction: row;
    justify-content: flex-end;
    padding-left: 52px;
  }
}
</style>
