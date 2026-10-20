<script setup lang="ts">
import { computed } from 'vue'
import type { LedgerRecordSource } from '@/types'
import { formatPeriodLabel, formatPeriodRange } from '../utils'

const props = defineProps<{
  source: LedgerRecordSource
  periodStart: string
  periodEnd: string
}>()

const label = computed(() => formatPeriodLabel(props.source, props.periodStart, props.periodEnd))
const range = computed(() => formatPeriodRange(props.source, props.periodStart, props.periodEnd))
</script>

<template>
  <div class="ledger-period-label">
    <div class="ledger-period-label__main">{{ label }}</div>
    <div v-if="range" class="ledger-period-label__range">{{ range }}</div>
  </div>
</template>

<style scoped>
.ledger-period-label {
  min-width: 0;
}

.ledger-period-label__main {
  overflow: hidden;
  font-weight: 500;
  color: var(--color-text-1);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ledger-period-label__range {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-3);
}
</style>
