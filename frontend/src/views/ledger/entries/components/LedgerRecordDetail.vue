<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { deleteLedgerRecord, getLedgerRecord } from '@/api/ledger'
import BackButton from '@/components/BackButton.vue'
import { useIsMobile } from '@/composables/useIsMobile'
import { formatDateTimeShort } from '@/utils/datetime'
import { formatCents } from '@/utils/money'
import type { DictionaryRef, LedgerRecordDetail, LedgerRecordSource } from '@/types'
import ColorDot from '@/components/ColorDot.vue'
import { getModeMeta } from '../constants'
import { formatPeriodLabel, formatPeriodRange } from '../utils'
import LedgerAmountText from './LedgerAmountText.vue'
import LedgerTagList from './LedgerTagList.vue'
import LedgerTypeTag from './LedgerTypeTag.vue'

const props = defineProps<{
  source: LedgerRecordSource
  recordId: number
}>()

const router = useRouter()
const { t } = useI18n()
const { isMobile } = useIsMobile()
const meta = getModeMeta(props.source)

const record = ref<LedgerRecordDetail | null>(null)
const loading = ref(true)

const periodLabel = computed(() =>
  record.value ? formatPeriodLabel(props.source, record.value.periodStart, record.value.periodEnd) : ''
)
const periodRange = computed(() =>
  record.value ? formatPeriodRange(props.source, record.value.periodStart, record.value.periodEnd) : ''
)
const netClass = computed(() => {
  if (!record.value) return ''
  if (record.value.netCents > 0) return 'is-positive'
  if (record.value.netCents < 0) return 'is-negative'
  return ''
})

function categoryLabel(category?: DictionaryRef | null): string {
  return category?.name || '—'
}

function categoryColor(category?: DictionaryRef | null): string {
  return category?.color || '#0bb06d'
}

async function load(): Promise<void> {
  loading.value = true
  try {
    record.value = await getLedgerRecord(props.recordId)
  } catch {
    router.replace({ name: meta.listRoute })
  } finally {
    loading.value = false
  }
}

function openEdit(): void {
  router.push({ name: meta.editRoute, params: { id: props.recordId } })
}

async function handleDelete(): Promise<void> {
  if (!record.value) return

  try {
    await ElMessageBox.confirm(
      t('ledger.entries.deleteConfirm', {
        period: periodLabel.value,
        count: record.value.itemCount
      }),
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
    await deleteLedgerRecord(props.recordId)
    ElMessage.success(t('ledger.entries.deleted'))
    router.replace({ name: meta.listRoute })
  } catch {
    // 错误提示由 axios 拦截器统一处理
  }
}

watch(() => props.recordId, load, { immediate: true })
</script>

<template>
  <div class="detail-page is-full ledger-record-detail">
    <div class="detail-header ledger-detail-header">
      <BackButton :to="{ name: meta.listRoute }" />
      <div class="detail-title">{{ periodLabel || t(meta.titleKey) }}</div>
    </div>

    <div v-if="record && !loading" class="ledger-detail-toolbar">
      <div class="ledger-detail-meta">
        <span v-if="periodRange">{{ periodRange }}</span>
        <span>
          {{
            t('ledger.entries.updatedWithCount', {
              updatedAt: formatDateTimeShort(record.updatedAt),
              count: record.itemCount
            })
          }}
        </span>
      </div>
      <div class="ledger-detail-actions">
        <el-button link type="danger" @click="handleDelete">{{ t('common.delete') }}</el-button>
        <el-button type="primary" @click="openEdit">{{ t('common.edit') }}</el-button>
      </div>
    </div>

    <div class="detail-container ledger-detail-container">
      <el-skeleton v-if="loading" :rows="8" animated />

      <div v-else-if="record" class="ledger-detail-layout">
        <aside class="ledger-detail-side">
          <div class="ledger-summary-card">
            <div class="ledger-summary-item">
              <span>{{ t('ledger.entries.colExpense') }}</span>
              <strong class="is-expense">{{ formatCents(record.expenseCents) }}</strong>
            </div>
            <div class="ledger-summary-item">
              <span>{{ t('ledger.entries.colIncome') }}</span>
              <strong class="is-income">{{ formatCents(record.incomeCents) }}</strong>
            </div>
            <div class="ledger-summary-item">
              <span>{{ t('ledger.entries.colNet') }}</span>
              <strong :class="netClass">{{ formatCents(record.netCents) }}</strong>
            </div>
          </div>
        </aside>

        <div class="info-card ledger-detail-card">
          <div class="section-title">{{ t('ledger.entries.itemsTitle') }}</div>

          <div v-if="isMobile" class="ledger-detail-items">
            <div v-for="item in record.items" :key="item.id" class="ledger-detail-item">
              <div class="ledger-detail-item__head">
                <LedgerTypeTag :type="item.type" />
                <LedgerAmountText :amount-cents="item.amountCents" :type="item.type" />
              </div>
              <div class="ledger-detail-item__meta">
                <span class="account-cell">
                  <ColorDot :color="item.account?.kind?.color" />
                  {{ item.account?.name || '—' }}
                </span>
                <span class="category-cell">
                  <ColorDot :color="categoryColor(item.category)" />
                  {{ categoryLabel(item.category) }}
                </span>
              </div>
              <LedgerTagList v-if="item.tags?.length" :tags="item.tags" class="ledger-detail-item__tags" />
              <div v-if="item.remark" class="ledger-detail-item__remark">{{ item.remark }}</div>
            </div>
          </div>

          <el-table v-else :data="record.items" class="ledger-detail-table">
            <el-table-column :label="t('ledger.entries.colType')" width="90">
              <template #default="{ row }">
                <LedgerTypeTag :type="row.type" />
              </template>
            </el-table-column>
            <el-table-column :label="t('ledger.entries.colAmount')" width="130" align="right">
              <template #default="{ row }">
                <LedgerAmountText :amount-cents="row.amountCents" :type="row.type" />
              </template>
            </el-table-column>
            <el-table-column :label="t('ledger.entries.colAccount')" min-width="160">
              <template #default="{ row }">
                <span class="account-cell">
                  <ColorDot :color="row.account?.kind?.color" />
                  {{ row.account?.name || '—' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column :label="t('ledger.entries.colCategory')" width="110">
              <template #default="{ row }">
                <span class="category-cell">
                  <ColorDot :color="categoryColor(row.category)" />
                  {{ categoryLabel(row.category) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column :label="t('ledger.entries.colTags')" min-width="160">
              <template #default="{ row }">
                <LedgerTagList :tags="row.tags" />
              </template>
            </el-table-column>
            <el-table-column :label="t('ledger.entries.colRemark')" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">{{ row.remark || '—' }}</template>
            </el-table-column>
          </el-table>
        </div>

      </div>

      <el-empty v-else :description="t('ledger.entries.notFound')" />
    </div>
  </div>
</template>

<style scoped>
.ledger-detail-toolbar {
  width: 100%;
  max-width: 1000px;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.ledger-detail-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.ledger-detail-container {
  max-width: 1000px;
}

.ledger-detail-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ledger-detail-side,
.ledger-detail-card {
  min-width: 0;
}

.ledger-summary-card {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  padding: 24px 30px;
  border-radius: 24px;
  background: var(--color-brand-6);
  color: #fff;
}

.ledger-summary-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.ledger-summary-item span {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
}

.ledger-summary-item strong {
  overflow: hidden;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  color: #fff;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ledger-summary-item strong.is-expense {
  color: #ffe0e0;
}

.ledger-summary-item strong.is-income,
.ledger-summary-item strong.is-positive {
  color: #d9ffe5;
}

.ledger-summary-item strong.is-negative {
  color: #ffe0e0;
}

.ledger-detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin: 0;
  font-size: 12px;
  color: var(--color-text-3);
}

.ledger-detail-card {
  padding-bottom: 24px;
}

.account-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-2);
}

.category-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ledger-detail-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ledger-detail-item {
  padding: 14px;
  border-radius: 16px;
  background: var(--color-bg-bottom);
}

.ledger-detail-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ledger-detail-item__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 10px;
  font-size: 13px;
  color: var(--color-text-3);
}

.ledger-detail-item__tags {
  margin-top: 10px;
}

.ledger-detail-item__remark {
  margin-top: 10px;
  font-size: 13px;
  line-height: 20px;
  color: var(--color-text-2);
  word-break: break-word;
}

@media (max-width: 768px) {
  .ledger-detail-toolbar {
    flex-wrap: wrap;
    gap: 10px;
  }

  .ledger-detail-actions {
    margin-left: auto;
  }

  .ledger-summary-card {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    padding: 16px 18px;
    border-radius: 18px;
  }

  .ledger-summary-item {
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
  }

  .ledger-summary-item strong {
    font-size: 18px;
  }
}
</style>
