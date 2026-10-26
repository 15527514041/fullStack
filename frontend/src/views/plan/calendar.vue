<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getPlanCalendar } from '@/api/plan'
import BackButton from '@/components/BackButton.vue'
import { formatDayLabel, toDateString } from '@/utils/datetime'
import type { PlanCalendarResult } from '@/types'

/**
 * 每日规划年度视图:
 * - 只允许切换当前年份及前两年,范围随日期动态变化
 * - 用周一至周日排列全年,颜色只由待办条数决定
 * - 有规划的日期可进入详情;无规划日期只展示提示
 */
interface CalendarCell {
  date: string | null
  planId: number | null
  todoCount: number | null
  level: number
}

interface MonthLabel {
  label: string
  left: number
}

const CELL_SIZE = 14
const CELL_GAP = 4

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()

const currentYear = new Date().getFullYear()
const availableYears = [currentYear - 2, currentYear - 1, currentYear]
const selectedYear = ref(currentYear)
const result = ref<PlanCalendarResult | null>(null)
const loading = ref(true)
const loadFailed = ref(false)

// 快速切换年份时丢弃旧请求,避免晚到的响应覆盖当前年份
let requestSequence = 0

const localeCode = computed(() => (locale.value === 'en_US' ? 'en-US' : 'zh-CN'))

const dayByDate = computed(() => {
  const map = new Map<string, { id: number; todoCount: number }>()
  result.value?.days.forEach((day) => {
    map.set(day.date, { id: day.id, todoCount: day.todoCount })
  })
  return map
})

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365
}

function dayOfYear(date: Date): number {
  const current = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  const first = Date.UTC(date.getFullYear(), 0, 1)
  return Math.floor((current - first) / 86_400_000) + 1
}

// 规划有 0 条待办时也要着色,因此从浅到深分成四档
function heatLevel(todoCount: number): number {
  if (todoCount <= 0) return 1
  if (todoCount <= 2) return 2
  if (todoCount <= 5) return 3
  return 4
}

const weeks = computed<CalendarCell[][]>(() => {
  const year = selectedYear.value
  const jan1 = new Date(year, 0, 1)
  // JavaScript 以周日为 0;这里换算成周一为 0
  const leadingDays = (jan1.getDay() + 6) % 7
  const totalDays = daysInYear(year)
  const weekCount = Math.ceil((leadingDays + totalDays) / 7)
  const rows: CalendarCell[][] = []

  for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
    const week: CalendarCell[] = []
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const ordinal = weekIndex * 7 + weekday - leadingDays + 1
      if (ordinal < 1 || ordinal > totalDays) {
        week.push({ date: null, planId: null, todoCount: null, level: -1 })
        continue
      }

      const date = toDateString(new Date(year, 0, ordinal))
      const plan = dayByDate.value.get(date)
      week.push({
        date,
        planId: plan?.id ?? null,
        todoCount: plan?.todoCount ?? null,
        level: plan ? heatLevel(plan.todoCount) : 0
      })
    }
    rows.push(week)
  }

  return rows
})

const heatmapWidth = computed(
  () => weeks.value.length * CELL_SIZE + Math.max(0, weeks.value.length - 1) * CELL_GAP
)

const monthLabels = computed<MonthLabel[]>(() => {
  const year = selectedYear.value
  const leadingDays = (new Date(year, 0, 1).getDay() + 6) % 7
  const formatter = new Intl.DateTimeFormat(localeCode.value, { month: 'short' })

  return Array.from({ length: 12 }, (_, month) => {
    const date = new Date(year, month, 1)
    const weekIndex = Math.floor((leadingDays + dayOfYear(date) - 1) / 7)
    return {
      label: formatter.format(date),
      left: weekIndex * (CELL_SIZE + CELL_GAP)
    }
  })
})

const weekdayLabels = computed(() => [
  t('plan.calendarWeekdayMon'),
  '',
  t('plan.calendarWeekdayWed'),
  '',
  t('plan.calendarWeekdayFri'),
  '',
  ''
])

function cellLabel(cell: CalendarCell): string {
  if (!cell.date) return ''
  const date = formatDayLabel(cell.date)
  if (cell.planId === null) return t('plan.calendarNoPlan', { date })
  return t('plan.calendarTodoCount', { date, count: cell.todoCount ?? 0 })
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

function selectYear(year: number): void {
  if (year === selectedYear.value) return
  selectedYear.value = year
  void router.replace({ query: { ...route.query, year: String(year) } })
}

function syncYearFromRoute(value: unknown): void {
  const parsed = typeof value === 'string' ? Number(value) : Number.NaN
  const year = availableYears.includes(parsed) ? parsed : currentYear

  // 年份也放在 URL 中,刷新和浏览器返回都能恢复;非法年份回退当前年
  if (value !== String(year)) {
    void router.replace({ query: { ...route.query, year: String(year) } })
    return
  }

  selectedYear.value = year
  void loadCalendar(year)
}

watch(() => route.query.year, syncYearFromRoute, { immediate: true })

function openPlan(cell: CalendarCell): void {
  if (cell.planId === null) return
  void router.push({ name: 'plan-detail', params: { id: cell.planId } })
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

    <main class="calendar-container">
      <div class="calendar-toolbar">
        <div class="calendar-summary" aria-live="polite">
          <template v-if="result">
            <div class="calendar-summary__title">
              <h2>{{ $t('plan.calendarSummaryTitle', { year: selectedYear, days: result.summary.planDays }) }}</h2>
              <span class="calendar-summary__todos">
                {{ $t('plan.calendarSummaryDetail', { count: result.summary.todoTotal }) }}
              </span>
            </div>
          </template>
          <template v-else>
            <h2>{{ selectedYear }}</h2>
            <p>{{ loadFailed ? $t('plan.calendarLoadFailed') : $t('common.loading') }}</p>
          </template>
        </div>

        <div class="year-switch" role="group" :aria-label="$t('plan.calendarYearSwitch')">
          <button
            v-for="year in availableYears"
            :key="year"
            type="button"
            class="year-switch__button"
            :class="{ 'is-active': year === selectedYear }"
            :aria-pressed="year === selectedYear"
            @click="selectYear(year)"
          >
            {{ year }}
          </button>
        </div>
      </div>

      <section class="heatmap-card" :aria-busy="loading">
        <el-skeleton v-if="loading" :rows="8" animated class="heatmap-skeleton" />

        <el-empty v-else-if="loadFailed" :description="$t('plan.calendarLoadFailed')">
          <el-button type="primary" @click="loadCalendar(selectedYear)">
            {{ $t('plan.calendarRetry') }}
          </el-button>
        </el-empty>

        <template v-else>
          <div class="heatmap-body">
            <div class="weekday-axis" aria-hidden="true">
              <span class="month-row-spacer" />
              <span v-for="(label, index) in weekdayLabels" :key="index" class="weekday-label">
                {{ label }}
              </span>
            </div>

            <div class="heatmap-scroll">
              <div class="heatmap-canvas" :style="{ width: `${heatmapWidth}px` }">
                <div class="month-row">
                  <span
                    v-for="month in monthLabels"
                    :key="month.label"
                    class="month-label"
                    :style="{ left: `${month.left}px` }"
                  >
                    {{ month.label }}
                  </span>
                </div>

                <div class="week-grid" :style="{ gridTemplateColumns: `repeat(${weeks.length}, ${CELL_SIZE}px)` }">
                  <div v-for="(week, weekIndex) in weeks" :key="weekIndex" class="week-column">
                    <template v-for="(cell, dayIndex) in week" :key="cell.date ?? `blank-${weekIndex}-${dayIndex}`">
                      <el-tooltip
                        v-if="cell.date"
                        :content="cellLabel(cell)"
                        placement="top"
                        :show-after="180"
                        popper-class="app-tooltip"
                      >
                        <button
                          type="button"
                          class="heat-cell"
                          :class="[`heat-level-${cell.level}`, { 'is-empty': cell.planId === null }]"
                          :aria-label="
                            cell.planId === null
                              ? cellLabel(cell)
                              : $t('plan.calendarOpenPlan', { date: formatDayLabel(cell.date) })
                          "
                          :tabindex="cell.planId === null ? -1 : 0"
                          @click="openPlan(cell)"
                        />
                      </el-tooltip>
                      <span v-else class="heat-cell is-outside" aria-hidden="true" />
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="heatmap-footer">
            <div class="legend">
              <span class="legend__text">{{ $t('plan.calendarNoPlanLegend') }}</span>
              <span class="heat-cell heat-level-0 legend__cell" />
              <span class="legend__text legend__text--less">{{ $t('plan.calendarLess') }}</span>
              <span v-for="level in 4" :key="level" class="heat-cell legend__cell" :class="`heat-level-${level}`" />
              <span class="legend__text">{{ $t('plan.calendarMore') }}</span>
            </div>
          </div>
        </template>
      </section>
    </main>
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

.calendar-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.calendar-toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 20px;
}

.calendar-summary h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--color-text-1);
}

.calendar-summary__title {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.calendar-summary__todos {
  flex-shrink: 0;
  font-size: 14px;
  line-height: 20px;
  color: var(--color-text-3);
  white-space: nowrap;
}

.calendar-summary p {
  min-height: 20px;
  margin: 6px 0 0;
  font-size: 14px;
  line-height: 20px;
  color: var(--color-text-3);
}

.year-switch {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-bg-bottom);
}

.year-switch__button {
  min-width: 76px;
  height: 36px;
  padding: 0 16px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text-2);
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition:
    color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.year-switch__button:hover {
  color: var(--el-color-primary);
}

.year-switch__button.is-active {
  color: var(--color-on-brand);
  background: var(--el-color-primary);
  box-shadow: var(--shadow-brand);
}

.year-switch__button:focus-visible,
.heat-cell:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.heatmap-card {
  padding: 28px 30px 22px;
  border: 1px solid var(--color-border);
  border-radius: 26px;
  background: var(--color-bg-card-1);
  box-shadow: var(--shadow-card-lg);
}

.heatmap-skeleton {
  min-height: 260px;
  padding: 8px 4px;
}

.heatmap-body {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.weekday-axis {
  flex: none;
  display: grid;
  grid-auto-rows: 14px;
  row-gap: 4px;
  width: 36px;
  padding-top: 0;
}

.month-row-spacer {
  height: 22px;
}

.weekday-label {
  font-size: 11px;
  line-height: 14px;
  color: var(--color-text-3);
  white-space: nowrap;
}

.heatmap-scroll {
  min-width: 0;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 8px;
  scrollbar-width: thin;
  scrollbar-color: var(--color-scrollbar-thumb) var(--color-scrollbar-track);
}

.heatmap-canvas {
  min-width: 100%;
}

.month-row {
  position: relative;
  height: 22px;
}

.month-label {
  position: absolute;
  top: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--color-text-3);
  white-space: nowrap;
}

.week-grid {
  display: grid;
  column-gap: 4px;
}

.week-column {
  display: grid;
  grid-template-rows: repeat(7, 14px);
  row-gap: 4px;
}

.heat-cell {
  display: block;
  width: 14px;
  height: 14px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: transparent;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

button.heat-cell {
  cursor: pointer;
}

.heat-cell.is-empty,
button.heat-cell.is-empty {
  cursor: default;
}

button.heat-cell:hover {
  z-index: 1;
  transform: scale(1.28);
  box-shadow: 0 0 0 1.5px var(--color-bg-card-1), 0 0 0 2.5px var(--el-color-primary);
}

.heat-level-0 {
  background: var(--color-border);
}

.heat-level-1 {
  background: var(--color-brand-1);
}

.heat-level-2 {
  background: var(--color-brand-2);
}

.heat-level-3 {
  background: var(--color-brand-3);
}

.heat-level-4 {
  background: var(--color-brand-5);
}

.heat-cell.is-outside {
  visibility: hidden;
}

.heatmap-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-divider);
}

.legend {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-3);
  font-size: 12px;
}

.legend__text--less {
  margin-left: 10px;
}

.legend__cell {
  width: 12px;
  height: 12px;
  border-radius: 3px;
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

  .calendar-toolbar {
    align-items: stretch;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 16px;
  }

  .calendar-summary h2 {
    font-size: 20px;
  }

  .calendar-summary__title {
    flex-wrap: wrap;
    gap: 4px 10px;
  }

  .year-switch {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    width: 100%;
  }

  .year-switch__button {
    min-width: 0;
    padding: 0 8px;
  }

  .heatmap-card {
    padding: 20px 14px 16px;
    border-radius: 20px;
  }

  .heatmap-body {
    gap: 8px;
  }

  .weekday-axis {
    width: 24px;
  }

  .weekday-label {
    font-size: 10px;
  }

  .heatmap-footer {
    justify-content: flex-start;
    margin-top: 12px;
    padding-top: 14px;
  }
}
</style>
