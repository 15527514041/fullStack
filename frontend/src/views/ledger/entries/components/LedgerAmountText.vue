<script setup lang="ts">
import { computed } from 'vue'
import { formatCents } from '@/utils/money'
import type { LedgerItemType } from '@/types'

const props = defineProps<{
  amountCents: number
  type: LedgerItemType
}>()

const text = computed(() =>
  props.type === 'INCOME' ? `+${formatCents(props.amountCents)}` : formatCents(-props.amountCents)
)
</script>

<template>
  <span class="ledger-amount" :class="type === 'INCOME' ? 'is-income' : 'is-expense'">{{ text }}</span>
</template>

<style scoped>
.ledger-amount {
  font-weight: 600;
  white-space: nowrap;
}

.ledger-amount.is-income {
  color: var(--el-color-success);
}

.ledger-amount.is-expense {
  color: var(--el-color-danger);
}
</style>
