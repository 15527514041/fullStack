<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { formatCents } from '@/utils/money'
import { formatDateTimeShort } from '@/utils/datetime'
import type { LedgerRecordSource, LedgerRecordSummary } from '@/types'
import LedgerPeriodLabel from './LedgerPeriodLabel.vue'

const props = defineProps<{
  record: LedgerRecordSummary
  source: LedgerRecordSource
}>()

defineEmits<{ open: []; edit: []; delete: [] }>()

const { t } = useI18n()

const netClass = computed(() => {
  if (props.record.netCents > 0) return 'is-positive'
  if (props.record.netCents < 0) return 'is-negative'
  return ''
})
</script>

<template>
  <div class="ledger-mobile-card" @click="$emit('open')">
    <div class="ledger-mobile-card__head">
      <LedgerPeriodLabel :source="source" :period-start="record.periodStart" :period-end="record.periodEnd" />
      <el-icon class="ledger-mobile-card__arrow"><ArrowRight /></el-icon>
    </div>

    <div class="ledger-mobile-card__stats">
      <div class="ledger-mobile-stat">
        <span>{{ t('ledger.entries.colExpense') }}</span>
        <strong class="is-expense">{{ formatCents(record.expenseCents) }}</strong>
      </div>
      <div class="ledger-mobile-stat">
        <span>{{ t('ledger.entries.colIncome') }}</span>
        <strong class="is-income">{{ formatCents(record.incomeCents) }}</strong>
      </div>
      <div class="ledger-mobile-stat">
        <span>{{ t('ledger.entries.colNet') }}</span>
        <strong :class="netClass">{{ formatCents(record.netCents) }}</strong>
      </div>
    </div>

    <div class="ledger-mobile-card__meta">
      <span>{{ t('ledger.entries.itemCount', { count: record.itemCount }) }}</span>
      <span>{{ formatDateTimeShort(record.updatedAt) }}</span>
    </div>

    <div class="ledger-mobile-card__actions" @click.stop>
      <el-button link type="primary" @click="$emit('edit')">{{ t('common.edit') }}</el-button>
      <el-button link type="danger" @click="$emit('delete')">{{ t('common.delete') }}</el-button>
    </div>
  </div>
</template>

<style scoped>
.ledger-mobile-card {
  padding: 16px;
  border: 1px solid transparent;
  border-radius: 18px;
  background: var(--color-bg-card-1);
  box-shadow: 0 0 8px 1px rgba(0, 0, 0, 0.08);
  cursor: pointer;
}

.ledger-mobile-card:hover {
  border-color: var(--el-color-primary);
}

.ledger-mobile-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ledger-mobile-card__arrow {
  flex-shrink: 0;
  color: var(--color-text-3);
}

.ledger-mobile-card__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 14px;
}

.ledger-mobile-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  font-size: 12px;
  color: var(--color-text-3);
}

.ledger-mobile-stat strong {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-1);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ledger-mobile-stat strong.is-expense {
  color: var(--el-color-danger);
}

.ledger-mobile-stat strong.is-income,
.ledger-mobile-stat strong.is-positive {
  color: var(--el-color-success);
}

.ledger-mobile-stat strong.is-negative {
  color: var(--el-color-danger);
}

.ledger-mobile-card__meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--color-text-3);
}

.ledger-mobile-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
}

.ledger-mobile-card__actions .el-button {
  margin: 0;
  padding: 0;
}
</style>
