<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MoreFilled } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import {
  deleteWeeklyReview,
  getWeeklyReview,
  updateWeeklyReview
} from '@/api/weeklyReview'
import BackButton from '@/components/BackButton.vue'
import FileIcon from '@/components/FileIcon.vue'
import MarkdownText from '@/components/MarkdownText.vue'
import WeeklyContextPanel from '@/views/weekly-review/components/WeeklyContextPanel.vue'
import WeeklyPeriodCard from '@/views/weekly-review/components/WeeklyPeriodCard.vue'
import { formatDateTime, formatWeekRange } from '@/utils/datetime'
import type { WeeklyReview, WeeklyReviewItem } from '@/types'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const detailId = computed(() => Number(route.params.id))
const loading = ref(true)
const notFound = ref(false)
const completing = ref(false)
const record = ref<WeeklyReview | null>(null)

const sections = computed<Array<{
  key: 'wins' | 'challenges' | 'learnings' | 'nextActions'
  title: string
  items: WeeklyReviewItem[]
}>>(() => [
  {
    key: 'wins',
    title: t('weeklyReview.wins'),
    items: record.value?.wins || []
  },
  {
    key: 'challenges',
    title: t('weeklyReview.challenges'),
    items: record.value?.challenges || []
  },
  {
    key: 'learnings',
    title: t('weeklyReview.learnings'),
    items: record.value?.learnings || []
  },
  {
    key: 'nextActions',
    title: t('weeklyReview.nextActions'),
    items: record.value?.nextActions || []
  }
])

async function loadDetail(): Promise<void> {
  if (!Number.isInteger(detailId.value) || detailId.value <= 0) {
    notFound.value = true
    loading.value = false
    return
  }

  loading.value = true
  notFound.value = false
  try {
    record.value = await getWeeklyReview(detailId.value)
  } catch {
    notFound.value = true
  } finally {
    loading.value = false
  }
}

function openEdit(): void {
  router.push({
    name: 'weekly-review-edit',
    params: { id: detailId.value },
    query: { from: 'detail' }
  })
}

async function completeReview(): Promise<void> {
  if (!record.value?.summary?.trim()) {
    ElMessage.warning(t('weeklyReview.summaryRequired'))
    return
  }
  completing.value = true
  try {
    record.value = await updateWeeklyReview(detailId.value, { status: 'COMPLETED' })
    ElMessage.success(t('weeklyReview.completedSuccess'))
  } catch {
    // 错误提示由请求拦截器统一处理
  } finally {
    completing.value = false
  }
}

async function handleDelete(): Promise<void> {
  const week = record.value
    ? formatWeekRange(record.value.weekStart, record.value.weekEnd)
    : ''
  try {
    await ElMessageBox.confirm(
      t('weeklyReview.deleteConfirm', { week }),
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
    await deleteWeeklyReview(detailId.value)
    ElMessage.success(t('weeklyReview.deleted'))
    await router.push({ name: 'weekly-reviews' })
  } catch {
    // 错误提示由请求拦截器统一处理
  }
}

function handleMore(command: string): void {
  if (command === 'delete') handleDelete()
}

watch(detailId, loadDetail, { immediate: true })
</script>

<template>
  <div class="detail-page is-full">
    <div class="detail-header">
      <BackButton :fallback="{ name: 'weekly-reviews' }" />
      <div class="detail-title">{{ $t('weeklyReview.detailTitle') }}</div>
    </div>

    <div class="detail-container">
      <el-skeleton v-if="loading" :rows="10" animated />

      <el-empty v-else-if="notFound || !record" :description="$t('weeklyReview.detailNotFound')">
        <el-button type="primary" @click="router.push({ name: 'weekly-reviews' })">
          {{ $t('weeklyReview.backList') }}
        </el-button>
      </el-empty>

      <template v-else>
        <div class="weekly-action-row">
          <el-button @click="openEdit">{{ $t('common.edit') }}</el-button>
          <el-button
            v-if="record.status === 'DRAFT'"
            type="primary"
            :loading="completing"
            @click="completeReview"
          >
            {{ $t('weeklyReview.completeReview') }}
          </el-button>
          <el-dropdown trigger="click" placement="bottom-end" @command="handleMore">
            <el-button class="weekly-more" :aria-label="$t('common.more')">
              <el-icon><MoreFilled /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="delete" class="is-danger">
                  <FileIcon name="delete" :size="16" class="weekly-more__icon" />
                  {{ $t('common.delete') }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <WeeklyPeriodCard
          :title="$t('weeklyReview.weekLabel')"
        >
          <span class="weekly-detail-period__range">
            {{ formatWeekRange(record.weekStart, record.weekEnd) }}
          </span>
          <span
            class="weekly-detail-period__status"
            :class="{ 'is-completed': record.status === 'COMPLETED' }"
          >
            {{ record.status === 'COMPLETED' ? $t('weeklyReview.statusCompleted') : $t('weeklyReview.statusDraft') }}
          </span>
          <span v-if="record.completedAt" class="weekly-detail-period__completed">
            {{ $t('weeklyReview.completedAt', { time: formatDateTime(record.completedAt) }) }}
          </span>
        </WeeklyPeriodCard>

        <WeeklyContextPanel
          class="weekly-detail-context"
          :week-start="record.weekStart"
          :week-end="record.weekEnd"
          :metrics="record.metrics"
          :days="record.days"
          :frozen="record.snapshotFrozen"
          interactive
        />

        <div class="info-card weekly-detail">
          <div v-if="record.snapshotFrozen" class="weekly-detail__frozen">
            {{ $t('weeklyReview.frozenNote') }}
          </div>

          <section class="weekly-detail__summary-section">
            <h3 class="weekly-detail__title">{{ $t('weeklyReview.summary') }}</h3>
            <MarkdownText
              class="weekly-detail__summary"
              :value="record.summary"
              :empty="$t('weeklyReview.summaryEmpty')"
            />
          </section>

          <template v-for="section in sections" :key="section.key">
            <div class="weekly-detail__divider" />
            <section>
              <h3 class="weekly-detail__title">{{ section.title }}</h3>
              <div v-if="section.items.length" class="weekly-detail__items">
                <div
                  v-for="(item, index) in section.items"
                  :key="item.id ?? index"
                  class="weekly-detail__item"
                >
                  <span class="form-row-index">{{ index + 1 }}</span>
                  <MarkdownText class="weekly-detail__content" :value="item.content" />
                </div>
              </div>
              <p v-else class="weekly-detail__empty">{{ $t('weeklyReview.emptySection') }}</p>
            </section>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.weekly-action-row {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 12px;
}

.weekly-action-row :deep(.el-button) {
  height: 32px;
  padding: 0 14px;
  margin-left: 0;
  border-radius: 8px;
  font-size: 13px;
}

.weekly-action-row :deep(.el-button:not(.el-button--primary)) {
  border: none;
  color: var(--color-text-2);
  background: var(--color-bg-bottom);
}

.weekly-action-row :deep(.weekly-more) {
  padding: 0 10px;
}

.weekly-detail-context {
  margin-top: 20px;
  margin-bottom: 20px;
}

.weekly-detail {
  padding-top: 24px;
}

.weekly-detail-period__range {
  color: var(--color-text-1);
  font-size: 16px;
  font-weight: 500;
}

.weekly-detail-period__status {
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--color-bg-bottom);
  color: var(--color-text-3);
  font-size: 12px;
}

.weekly-detail-period__status.is-completed {
  background: var(--color-brand-1);
  color: var(--color-brand-6);
}

.weekly-detail-period__completed {
  color: var(--color-text-3);
  font-size: 12px;
}

.weekly-detail__frozen {
  margin-top: 14px;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--color-bg-bottom);
  color: var(--color-text-3);
  font-size: 12px;
  line-height: 18px;
}

.weekly-detail__summary-section {
  margin-top: 0;
}

.weekly-detail__title {
  margin: 0 0 10px;
  color: var(--color-text-1);
  font-size: 16px;
  font-weight: 500;
}

.weekly-detail__summary {
  padding: 12px 16px;
  border-radius: 16px;
  background: var(--color-bg-bottom);
}

.weekly-detail__divider {
  height: 3px;
  margin: 20px 0;
  border-radius: 999px;
  background: var(--color-border);
}

.weekly-detail__items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.weekly-detail__item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--color-bg-bottom);
}

.weekly-detail__item .form-row-index {
  flex-shrink: 0;
  margin-top: 0;
}

.weekly-detail__content {
  flex: 1;
  min-width: 0;
}

.weekly-detail__empty {
  margin: 0;
  color: var(--color-text-4);
  font-size: 13px;
}

.weekly-more__icon {
  margin-right: 6px;
}

@media (max-width: 768px) {
  .weekly-action-row {
    flex-wrap: wrap;
  }

  .weekly-detail {
    padding-top: 18px;
  }

}
</style>
