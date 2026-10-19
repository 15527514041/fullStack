<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { deleteLedgerRecord } from '@/api/ledger'
import { useIsMobile } from '@/composables/useIsMobile'
import { formatDateTimeShort } from '@/utils/datetime'
import { formatCents } from '@/utils/money'
import type { LedgerRecordSource, LedgerRecordSummary } from '@/types'
import { getModeMeta } from '../constants'
import { useLedgerRecordList } from '../composables/useLedgerRecordList'
import { formatPeriodLabel } from '../utils'
import LedgerModeSwitch from './LedgerModeSwitch.vue'
import LedgerPeriodLabel from './LedgerPeriodLabel.vue'
import LedgerRecordMobileCard from './LedgerRecordMobileCard.vue'

const props = defineProps<{ source: LedgerRecordSource }>()

const router = useRouter()
const { t } = useI18n()
const { isMobile } = useIsMobile()
const meta = computed(() => getModeMeta(props.source))

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
    <!-- 维度和卡片平级,放在卡片外侧;卡片内只放标题、筛选和列表 -->
    <LedgerModeSwitch :source="source" />

    <div class="list-page ledger-record-list">
      <div class="page-header">
        <div class="title-section">
          <div class="page-title">{{ t(meta.titleKey) }}</div>
          <div class="page-subtitle">{{ t(meta.subtitleKey) }}</div>
        </div>
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon>{{ t(meta.addButtonKey) }}
        </el-button>
      </div>

      <div class="filter-bar">
        <div class="range-field">
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
        <el-button @click="resetFilters">{{ t('common.reset') }}</el-button>
      </div>

      <el-skeleton v-if="loading && list.length === 0" :rows="6" animated class="list-skeleton" />

      <template v-else>
        <div v-if="isMobile" class="ledger-mobile-list">
          <el-empty v-if="!list.length" :description="t(meta.emptyKey)" />
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

        <el-table v-else :data="list" class="ledger-record-table" @row-click="openDetail">
          <el-table-column :label="t(meta.periodColumnKey)" :min-width="meta.periodColumnWidth">
            <template #default="{ row }">
              <LedgerPeriodLabel
                :source="meta.source"
                :period-start="row.periodStart"
                :period-end="row.periodEnd"
              />
            </template>
          </el-table-column>
          <el-table-column :label="t('ledger.entries.colExpense')" width="130" align="right">
            <template #default="{ row }">
              <span class="ledger-total is-expense">{{ formatCents(row.expenseCents) }}</span>
            </template>
          </el-table-column>
          <el-table-column :label="t('ledger.entries.colIncome')" width="130" align="right">
            <template #default="{ row }">
              <span class="ledger-total is-income">{{ formatCents(row.incomeCents) }}</span>
            </template>
          </el-table-column>
          <el-table-column :label="t('ledger.entries.colNet')" width="130" align="right">
            <template #default="{ row }">
              <span class="ledger-total" :class="netClass(row.netCents)">
                {{ formatCents(row.netCents) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column :label="t('ledger.entries.colItemCount')" width="100" align="center">
            <template #default="{ row }">
              {{ t('ledger.entries.itemCount', { count: row.itemCount }) }}
            </template>
          </el-table-column>
          <el-table-column :label="t('ledger.entries.colUpdatedAt')" width="170">
            <template #default="{ row }">{{ formatDateTimeShort(row.updatedAt) }}</template>
          </el-table-column>
          <el-table-column :label="t('ledger.entries.colActions')" width="180" align="right">
            <template #default="{ row }">
              <el-button link type="primary" @click.stop="openDetail(row)">
                {{ t('ledger.entries.view') }}
              </el-button>
              <el-button link type="primary" @click.stop="openEdit(row)">
                {{ t('common.edit') }}
              </el-button>
              <el-button link type="danger" @click.stop="handleDelete(row)">
                {{ t('common.delete') }}
              </el-button>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty :description="t(meta.emptyKey)" />
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

.range-field {
  width: 320px;
}

.range-field :deep(.el-date-editor) {
  width: 100%;
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
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .range-field {
    width: 100%;
  }
}
</style>
