<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getPlanCalendar } from '@/api/plan'
import BackButton from '@/components/BackButton.vue'
import YearHeatmap from '@/components/year-heatmap/YearHeatmap.vue'
import type { YearHeatmapDay } from '@/components/year-heatmap/types'
import { useRecentYearQuery } from '@/composables/useRecentYearQuery'
import { formatDayLabel } from '@/utils/datetime'
import type { PlanCalendarResult } from '@/types'

const router = useRouter()
const { t } = useI18n()

const result = ref<PlanCalendarResult | null>(null)
const loading = ref(true)
const loadFailed = ref(false)
let requestSequence = 0

const heatmapDays = computed<YearHeatmapDay[]>(
  () =>
    result.value?.days.map((day) => ({
      id: day.id,
      date: day.date,
      count: day.todoCount
    })) ?? []
)

const summaryTitle = computed(() => {
  if (!result.value) return String(selectedYear.value)
  return t('plan.calendarSummaryTitle', {
    year: selectedYear.value
  })
})

const summaryMeta = computed(() => {
  if (!result.value) return ''
  const total = result.value.summary.todoTotal
  return total
    ? t('plan.calendarSummaryDetail', { count: total })
    : t('plan.calendarSummaryEmpty')
})

function tooltipForDate(date: string, day: YearHeatmapDay | null): string {
  const label = formatDayLabel(date)
  if (!day) return t('plan.calendarNoPlan', { date: label })
  return t('plan.calendarTodoCount', { date: label, count: day.count })
}

function openLabelForDate(date: string): string {
  return t('plan.calendarOpenPlan', { date: formatDayLabel(date) })
}

async function loadCalendar(year: number): Promise<void> {
  const sequence = ++requestSequence
  loading.value = true
  loadFailed.value = false
  result.value = null

  try {
    const data = await getPlanCalendar(year)
    if (sequence === requestSequence) result.value = data
  } catch {
    if (sequence === requestSequence) loadFailed.value = true
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

const { availableYears, selectedYear, selectYear } = useRecentYearQuery(loadCalendar)

function openPlan(day: YearHeatmapDay): void {
  void router.push({ name: 'plan-detail', params: { id: day.id } })
}
</script>

<template>
  <div class="calendar-page">
    <header class="calendar-header">
      <BackButton :to="{ name: 'plans' }" />
      <div class="calendar-header__copy">
        <h1>{{ $t('plan.calendarTitle') }}</h1>
        <p class="calendar-subtitle">{{ $t('plan.calendarSubtitle') }}</p>
      </div>
    </header>

    <YearHeatmap
      :year="selectedYear"
      :available-years="availableYears"
      :days="heatmapDays"
      :loading="loading"
      :error="loadFailed"
      :summary-title="summaryTitle"
      :summary-meta="summaryMeta"
      :empty-legend="$t('plan.calendarNoPlanLegend')"
      :tooltip-for-date="tooltipForDate"
      :open-label-for-date="openLabelForDate"
      @update:year="selectYear"
      @select="openPlan"
      @retry="loadCalendar(selectedYear)"
    />
  </div>
</template>

<style scoped>
.calendar-page {
  min-height: 100%;
  padding: 20px 32px 52px;
  background: var(--el-bg-color);
}

.calendar-header {
  position: relative;
  width: 100%;
  max-width: 1200px;
  min-height: 56px;
  margin: 0 auto 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.calendar-header__copy {
  max-width: 86%;
  text-align: center;
}

.calendar-header h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-text-1);
}

.calendar-subtitle {
  margin: 5px 0 0;
  font-size: 14px;
  line-height: 20px;
  color: var(--color-text-3);
}

@media (max-width: 768px) {
  .calendar-page {
    padding: 12px 12px 40px;
  }

  .calendar-header {
    min-height: 46px;
    margin-bottom: 22px;
    justify-content: flex-start;
    padding-left: 38px;
  }

  .calendar-header__copy {
    max-width: 100%;
    text-align: left;
  }

  .calendar-header h1 {
    font-size: 19px;
  }

  .calendar-subtitle {
    font-size: 13px;
  }
}
</style>
