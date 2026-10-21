<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getPreferences } from '@/api/preferences'
import {
  DEFAULT_LEDGER_ENTRY_SOURCES,
  normalizeLedgerEntrySources
} from '@/utils/ledgerPreferences'
import type { LedgerRecordSource } from '@/types'
import { LEDGER_MODES } from '../constants'
import LedgerModeSwitch from './LedgerModeSwitch.vue'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const visibleSources = ref<LedgerRecordSource[]>([...DEFAULT_LEDGER_ENTRY_SOURCES])

const currentMode = computed(() =>
  LEDGER_MODES.find((mode) => mode.listRoute === route.name)
)
const currentSource = computed<LedgerRecordSource>(
  () => currentMode.value?.source || visibleSources.value[0] || 'manual_day'
)
const visibleModes = computed(() =>
  LEDGER_MODES.filter((mode) => visibleSources.value.includes(mode.source))
)
const isEntryIndex = computed(() => route.path.replace(/\/+$/, '') === '/ledger/entries')

async function loadPreferences(): Promise<void> {
  loading.value = true
  try {
    const preferences = await getPreferences()
    const sources = normalizeLedgerEntrySources(preferences.ledgerEntrySources)
    visibleSources.value = sources.length ? sources : [...DEFAULT_LEDGER_ENTRY_SOURCES]
  } catch {
    visibleSources.value = [...DEFAULT_LEDGER_ENTRY_SOURCES]
  } finally {
    loading.value = false
    redirectToFirstEnabled()
  }
}

function redirectToFirstEnabled(): void {
  if (!isEntryIndex.value) return
  const firstMode = visibleModes.value[0] || LEDGER_MODES[0]
  router.replace({ name: firstMode.listRoute })
}

watch(isEntryIndex, (value) => {
  if (value && !loading.value) redirectToFirstEnabled()
})

onMounted(loadPreferences)
</script>

<template>
  <div class="ledger-entries-shell">
    <el-skeleton v-if="loading" :rows="7" animated />
    <template v-else>
      <LedgerModeSwitch
        v-if="visibleModes.length > 1"
        :source="currentSource"
        :modes="visibleModes"
      />
      <router-view v-if="!isEntryIndex" />
    </template>
  </div>
</template>

<style scoped>
.ledger-entries-shell {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ledger-entries-shell :deep(.ledger-entries-view) {
  flex: 1;
  height: auto;
  min-height: 0;
}

@media (max-width: 768px) {
  .ledger-entries-shell {
    height: auto;
    min-height: 0;
    gap: 12px;
  }
}
</style>
