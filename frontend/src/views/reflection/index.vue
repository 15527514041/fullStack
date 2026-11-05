<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, MoreFilled, Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { downloadExport } from '@/api/export'
import { createReflection, getReflections } from '@/api/reflection'
import FileIcon from '@/components/FileIcon.vue'
import RelaxedEmptyState from '@/components/RelaxedEmptyState.vue'
import ReflectionFormDialog, { type ReflectionSubmitPayload } from '@/views/reflection/components/ReflectionFormDialog.vue'
import { useDateRangeTabs, type DateRangeTab } from '@/composables/useDateRangeTabs'
import { useFeedList } from '@/composables/useFeedList'
import { useListExport } from '@/composables/useListExport'
import { formatDayHeading } from '@/utils/datetime'
import type { DailyReflection } from '@/types'

/**
 * 每日反思列表(样式参考 client 收款方管理):卡片流 + 日期区间 tab + 滑动分页,不用表格
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
const { items, loading, loadingMore, hasMore, reload } = useFeedList<DailyReflection>(getReflections, range, sentinelRef)
const { exporting, exportList } = useListExport()

// 新增走弹窗,一次只加一条
const dialogVisible = ref(false)
const submitting = ref(false)

// 卡片摘要:第一条反思的描述经过
function summary(row: DailyReflection): string {
  return row.items?.[0]?.experience || ''
}

function openCreate(): void {
  dialogVisible.value = true
}

function openCalendar(): void {
  router.push({ name: 'reflection-calendar' })
}

function openEdit(row: DailyReflection): void {
  router.push({ name: 'reflection-detail', params: { id: row.id } })
}

// 只提交当前日期筛选;完整记录读取和 CSV 生成都在后端完成
function handleExport(): void {
  const currentRange = { ...range.value }
  exportList(() => downloadExport('reflections', currentRange))
}

function handleHeaderAction(command: string): void {
  if (command === 'calendar') openCalendar()
  else if (command === 'export') handleExport()
}

// 保存:那天已经有记录就先二次确认,确认才去详情页继续添加(取消就留在列表页,弹窗和已填内容都保留)
async function handleSubmit(payload: ReflectionSubmitPayload): Promise<void> {
  submitting.value = true
  try {
    const existing = await getReflections({ page: 1, pageSize: 1, from: payload.date, to: payload.date })
    if (existing.list.length) {
      try {
        await ElMessageBox.confirm(t('reflection.dateExists'), t('common.tip'), {
          type: 'warning',
          showClose: false,
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel')
        })
      } catch {
        return // 取消:不跳转,也不关创建弹窗
      }

      dialogVisible.value = false
      router.push({ name: 'reflection-detail', params: { id: existing.list[0].id } })
      return
    }

    await createReflection({ date: payload.date, items: [payload.item] })
    dialogVisible.value = false
    ElMessage.success(t('reflection.created'))
    reload()
  } catch {
    // 错误提示已由 axios 拦截器统一处理
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="feed-page">
    <div class="feed-head">
      <div class="title-section">
        <div class="main-title">{{ $t('reflection.title') }}</div>
        <div class="subtitle">{{ $t('reflection.subtitle') }}</div>
      </div>
      <div class="header-actions">
        <el-button type="primary" class="add-button" @click="openCreate">
          <el-icon><Plus /></el-icon>{{ $t('reflection.addButton') }}
        </el-button>
        <el-dropdown
          class="header-more"
          trigger="click"
          placement="bottom-end"
          @command="handleHeaderAction"
        >
          <el-button class="more-button" :loading="exporting" :aria-label="$t('common.more')">
            <el-icon><MoreFilled /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="calendar">
                <FileIcon name="calendar" :size="16" class="more-menu__icon" />{{ $t('reflection.yearView') }}
              </el-dropdown-item>
              <el-dropdown-item command="export">
                <FileIcon name="download" :size="16" class="more-menu__icon" />{{ $t('common.export') }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <div class="feed-filter">
      <el-tabs v-model="tab" class="range-tabs">
        <el-tab-pane v-for="item in tabs" :key="item.value" :name="item.value" :label="item.label" />
      </el-tabs>
    </div>

    <div class="feed-section">
      <el-skeleton v-if="loading" :rows="4" animated />

      <RelaxedEmptyState
        v-else-if="!items.length"
        class="feed-empty"
        :description="$t('reflection.empty')"
      />

      <template v-else>
        <div v-for="row in items" :key="row.id" class="feed-card" @click="openEdit(row)">
          <div class="card-content">
            <div class="card-left">
              <div class="card-title-row">
                <span class="card-title">{{ formatDayHeading(row.date) }}</span>
                <span class="pill">{{ $t('reflection.itemCount', { count: row.items.length }) }}</span>
              </div>
              <div class="card-summary">{{ summary(row) }}</div>
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

    <!-- 新增一条反思 -->
    <ReflectionFormDialog v-model:visible="dialogVisible" :loading="submitting" @submit="handleSubmit" />
  </div>
</template>

<style scoped>
.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-more {
  flex-shrink: 0;
}

.more-button {
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.more-button :deep(.el-icon) {
  margin: 0;
}

.more-menu__icon {
  margin-right: 6px;
}

@media (max-width: 768px) {
  .header-actions {
    width: 100%;
  }

  .feed-head .header-actions .add-button {
    flex: 1;
    width: auto;
  }
}
</style>
