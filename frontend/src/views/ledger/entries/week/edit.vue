<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import LedgerRecordEditor from '../components/LedgerRecordEditor.vue'

const route = useRoute()
const recordId = computed(() => (route.params.id ? Number(route.params.id) : undefined))
</script>

<template>
  <LedgerRecordEditor source="manual_week" :record-id="recordId" />
</template>
