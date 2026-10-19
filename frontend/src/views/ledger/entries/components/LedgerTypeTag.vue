<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LedgerItemType } from '@/types'

const props = defineProps<{ type: LedgerItemType }>()
const { t } = useI18n()

const label = computed(() =>
  props.type === 'INCOME' ? t('ledger.entries.income') : t('ledger.entries.expense')
)
</script>

<template>
  <el-tag :type="type === 'INCOME' ? 'success' : 'danger'" effect="light" round>
    {{ label }}
  </el-tag>
</template>
