<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Plus } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { getPlans } from '@/api/plan'
import { useDateRangeTabs, type DateRangeTab } from '@/composables/useDateRangeTabs'
import { useFeedList } from '@/composables/useFeedList'
import { formatDayLabel, toDateString } from '@/utils/datetime'
import type { DailyPlanListItem } from '@/types'

/**
 * 日程规划列表(样式参考 client 收款方管理):卡片流 + 日期区间 tab + 滑动分页,不用表格
 * 列表接口只回四类计数,卡片展示前三个(待办 / 计划 / 实际);点卡片进详情页
 */
const router = useRouter()
const { t } = useI18n()

const { tab, range } = useDateRangeTabs('all')
const tabs = computed<Array<{ value: DateRangeTab; label: string }>>(() => [
  { value: 'all', label: t('common.all') },
  { value: 'today', label: t('common.today') },
  { value: 'week', label: t('growth.last7') },
  { value: 'month', label: t('growth.last30') }
])

const sentinelRef = ref<HTMLElement | null>(null)
const { items, loading, loadingMore, hasMore } = useFeedList<DailyPlanListItem>(getPlans, range, sentinelRef)

// 卡片上的计数胶囊(随写只有一条,不再展示)
function pills(row: DailyPlanListItem): Array<{ key: string; text: string }> {
  return [
    { key: 'todos', text: t('plan.todoCount', { count: row.todoCount }) },
    { key: 'planned', text: t('plan.plannedCount', { count: row.plannedCount }) },
    { key: 'actual', text: t('plan.actualCount', { count: row.actualCount }) }
  ]
}

// 只有「今天 / 明天」额外给个橙色标签,其它日期不给
function dayBadge(date: string): string {
  const today = new Date()
  if (date === toDateString(today)) return t('plan.todayBadge')

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return date === toDateString(tomorrow) ? t('plan.tomorrowBadge') : ''
}

function openCreate(): void {
  router.push({ name: 'plan-new' })
}

function openDetail(row: DailyPlanListItem): void {
  router.push({ name: 'plan-detail', params: { id: row.id } })
}
</script>

<template>
  <div class="feed-page">
    <div class="feed-head">
      <div class="title-section">
        <div class="main-title">{{ $t('plan.title') }}</div>
        <div class="subtitle">{{ $t('plan.subtitle') }}</div>
      </div>
      <el-button type="primary" class="add-button" @click="openCreate">
        <el-icon><Plus /></el-icon>{{ $t('plan.addButton') }}
      </el-button>
    </div>

    <div class="feed-filter">
      <el-tabs v-model="tab" class="range-tabs">
        <el-tab-pane v-for="item in tabs" :key="item.value" :name="item.value" :label="item.label" />
      </el-tabs>
    </div>

    <div class="feed-section">
      <el-skeleton v-if="loading" :rows="4" animated />

      <el-empty v-else-if="!items.length" class="feed-empty" :description="$t('plan.empty')" />

      <template v-else>
        <div v-for="row in items" :key="row.id" class="feed-card" @click="openDetail(row)">
          <div class="card-content">
            <div class="card-left">
              <div class="card-title-row">
                <span class="card-title">{{ formatDayLabel(row.date) }}</span>
                <span v-for="pill in pills(row)" :key="pill.key" class="pill">{{ pill.text }}</span>
                <span v-if="dayBadge(row.date)" class="pill pill--day">{{ dayBadge(row.date) }}</span>
              </div>
            </div>
            <div class="card-right">
              <el-icon><ArrowRight /></el-icon>
            </div>
          </div>
        </div>

        <div ref="sentinelRef" class="feed-more">
          <span v-if="loadingMore">{{ $t('common.loading') }}</span>
          <span v-else-if="!hasMore">{{ $t('common.noMore') }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* 今日 / 明日:橙色胶囊,和列表里其它计数胶囊(绿色)区分开 */
.feed-card .pill--day {
  background: var(--color-warning-1);
  color: var(--color-warning-6);
}
</style>
