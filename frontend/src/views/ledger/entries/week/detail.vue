<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import LedgerRecordDetail from '../components/LedgerRecordDetail.vue'

const route = useRoute()
const recordId = computed(() => Number(route.params.id))
</script>

<template>
  <LedgerRecordDetail source="manual_week" :record-id="recordId" />
</template>
