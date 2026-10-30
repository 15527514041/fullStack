<script setup lang="ts">
import { computed, inject } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { deleteLedgerRecord } from '@/api/ledger'
import InfoTipIcon from '@/components/InfoTipIcon.vue'
import RelaxedEmptyState from '@/components/RelaxedEmptyState.vue'
import { useIsMobile } from '@/composables/useIsMobile'
import { formatDateTimeShort } from '@/utils/datetime'
import { LEDGER_DIMENSION_TIP } from '@/utils/ledgerPreferences'
import { formatCents } from '@/utils/money'
import type { LedgerRecordSource, LedgerRecordSummary } from '@/types'
import { getModeMeta } from '../constants'
import { useLedgerRecordList } from '../composables/useLedgerRecordList'
import { formatPeriodLabel, type LedgerListPreset } from '../utils'
import LedgerPeriodLabel from './LedgerPeriodLabel.vue'
import LedgerRecordMobileCard from './LedgerRecordMobileCard.vue'

const props = defineProps<{ source: LedgerRecordSource }>()

const router = useRouter()
const { t } = useI18n()
const { isMobile } = useIsMobile()
const meta = computed(() => getModeMeta(props.source))
const dimensionTip = inject(
  LEDGER_DIMENSION_TIP,
  computed(() => ({ visible: false, content: '' }))
)

const {
  list,
  total,
  page,
  pageSize,
  loading,
  filters,
  applyFilters,
  resetFilters,
  load,
  handlePageChange,
  handleSizeChange
} = useLedgerRecordList(props.source)

const paginationLayout = computed(() =>
  isMobile.value ? 'prev, pager, next' : 'total, sizes, prev, pager, next, jumper'
)
const presetLabelKeys: Record<LedgerListPreset, string> = {
  all: 'common.all',
  current_week: 'ledger.entries.presetCurrentWeek',
  current_month: 'ledger.entries.presetCurrentMonth',
  last_month: 'ledger.entries.presetLastMonth',
  last_3_months: 'ledger.entries.presetLast3Months',
  last_6_months: 'ledger.entries.presetLast6Months',
  last_year: 'ledger.entries.presetLastYear'
}
const filterPresets = computed<LedgerListPreset[]>(() =>
  props.source === 'manual_week'
    ? ['all', 'current_week', 'current_month', 'last_month', 'last_3_months', 'last_6_months']
    : ['all', 'current_month', 'last_month', 'last_3_months', 'last_6_months', 'last_year']
)

function netClass(value: number): string {
  if (value > 0) return 'is-positive'
  if (value < 0) return 'is-negative'
  return ''
}

function openCreate(): void {
  router.push({ name: meta.value.newRoute })
}

function openDetail(row: LedgerRecordSummary): void {
  router.push({ name: meta.value.detailRoute, params: { id: row.id } })
}

function openEdit(row: LedgerRecordSummary): void {
  router.push({ name: meta.value.editRoute, params: { id: row.id }, query: { from: 'list' } })
}

async function handleDelete(row: LedgerRecordSummary): Promise<void> {
  const period = formatPeriodLabel(meta.value.source, row.periodStart, row.periodEnd)
  try {
    await ElMessageBox.confirm(
      t('ledger.entries.deleteConfirm', { period, count: row.itemCount }),
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
    await deleteLedgerRecord(row.id)
    ElMessage.success(t('ledger.entries.deleted'))
    await load()
  } catch {
    // 错误提示由 axios 拦截器统一处理
  }
}
</script>

<template>
  <div class="ledger-entries-view">
    <div class="list-page ledger-record-list">
      <div class="page-header">
        <div class="title-section">
          <div class="page-title-row">
            <div class="page-title">{{ t(meta.titleKey) }}</div>
            <InfoTipIcon
              v-if="dimensionTip.visible"
              :content="dimensionTip.content"
            />
          </div>
          <div class="page-subtitle">{{ t(meta.subtitleKey) }}</div>
        </div>
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon>{{ t(meta.addButtonKey) }}
        </el-button>
      </div>

      <div class="filter-bar">
        <div v-if="meta.source === 'manual_day'" class="range-field">
          <el-date-picker
            v-model="filters.range"
            type="daterange"
            value-format="YYYY-MM-DD"
            :start-placeholder="t('ledger.entries.filterStart')"
            :end-placeholder="t('ledger.entries.filterEnd')"
            :range-separator="t('ledger.entries.filterTo')"
            @change="applyFilters"
          />
        </div>
        <el-select v-else v-model="filters.preset" class="period-select" @change="applyFilters">
          <el-option
            v-for="preset in filterPresets"
            :key="preset"
            :label="t(presetLabelKeys[preset])"
            :value="preset"
          />
        </el-select>
        <el-button type="primary" @click="applyFilters">{{ t('common.search') }}</el-button>
        <el-button class="reset-btn" @click="resetFilters">{{ t('common.reset') }}</el-button>
      </div>

      <el-skeleton v-if="loading && list.length === 0" :rows="6" animated class="list-skeleton" />

      <template v-else>
        <div v-if="isMobile" class="ledger-mobile-list">
          <RelaxedEmptyState
            v-if="!list.length"
            :description="t(meta.emptyKey)"
          />
          <LedgerRecordMobileCard
            v-for="row in list"
            :key="row.id"
            :record="row"
            :source="meta.source"
            @open="openDetail(row)"
            @edit="openEdit(row)"
            @delete="handleDelete(row)"
          />
        </div>

        <el-table v-else :data="list" class="ledger-record-table table-align-left" @row-click="openDetail">
          <el-table-column :label="t(meta.periodColumnKey)" min-width="120">
            <template #default="{ row }">
              <LedgerPeriodLabel
                :source="meta.source"
                :period-start="row.periodStart"
                :period-end="row.periodEnd"
              />
            </template>
          </el-table-column>
          <el-table-column :label="t('ledger.entries.colExpense')" min-width="120" align="left">
            <template #default="{ row }">
              <span class="ledger-total is-expense">{{ formatCents(row.expenseCents) }}</span>
            </template>
          </el-table-column>
          <el-table-column :label="t('ledger.entries.colIncome')" min-width="120" align="left">
            <template #default="{ row }">
              <span class="ledger-total is-income">{{ formatCents(row.incomeCents) }}</span>
            </template>
          </el-table-column>
          <el-table-column :label="t('ledger.entries.colNet')" min-width="120" align="left">
            <template #default="{ row }">
              <span class="ledger-total" :class="netClass(row.netCents)">
                {{ formatCents(row.netCents) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column :label="t('ledger.entries.colItemCount')" min-width="120" align="left">
            <template #default="{ row }">
              {{ t('ledger.entries.itemCount', { count: row.itemCount }) }}
            </template>
          </el-table-column>
          <el-table-column :label="t('ledger.entries.colUpdatedAt')" min-width="120" align="left">
            <template #default="{ row }">{{ formatDateTimeShort(row.updatedAt) }}</template>
          </el-table-column>
          <el-table-column
            :label="t('ledger.entries.colActions')"
            width="170"
            align="left"
            fixed="right"
            class-name="table-actions"
          >
            <template #default="{ row }">
              <el-button link type="primary" @click.stop="openDetail(row)">
                {{ t('ledger.entries.view') }}
              </el-button>
              <el-button link type="primary" @click.stop="openEdit(row)">
                {{ t('ledger.entries.update') }}
              </el-button>
              <el-button link type="danger" @click.stop="handleDelete(row)">
                {{ t('common.delete') }}
              </el-button>
            </template>
          </el-table-column>
          <template #empty>
            <RelaxedEmptyState :description="t(meta.emptyKey)" />
          </template>
        </el-table>
      </template>

      <div v-if="total > 0" class="pagination-container">
        <el-pagination
          :current-page="page"
          :page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :total="total"
          :layout="paginationLayout"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ledger-entries-view {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 卡片自己吃掉剩余高度,分页才会贴在卡片底部 */
.ledger-entries-view > .list-page {
  flex: 1;
  height: auto;
  min-height: 0;
}

.ledger-record-table :deep(.el-table__row) {
  cursor: pointer;
}

.page-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.page-title-row + .page-subtitle {
  margin-top: 8px;
}

.range-field {
  width: 320px;
}

.range-field :deep(.el-date-editor) {
  width: 100%;
}

.period-select {
  width: 180px;
}

.ledger-total {
  font-weight: 600;
  color: var(--color-text-1);
  white-space: nowrap;
}

.ledger-total.is-expense,
.ledger-total.is-negative {
  color: var(--el-color-danger);
}

.ledger-total.is-income,
.ledger-total.is-positive {
  color: var(--el-color-success);
}

.ledger-mobile-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (max-width: 768px) {
  .ledger-entries-view {
    height: auto;
    min-height: 0;
    gap: 12px;
  }

  .filter-bar {
    display: flex;
  }

  .range-field,
  .period-select {
    width: 100%;
  }
}
</style>
