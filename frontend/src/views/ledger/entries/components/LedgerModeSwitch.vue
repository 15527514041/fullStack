<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { LedgerRecordSource } from '@/types'
import { LEDGER_MODES } from '../constants'

const props = defineProps<{ source: LedgerRecordSource }>()

const router = useRouter()
const { t } = useI18n()

function switchMode(target: LedgerRecordSource): void {
  if (target === props.source) return
  const mode = LEDGER_MODES.find((item) => item.source === target)
  if (!mode) return
  // replace:切 tab 不堆历史记录,返回时回到进入列表页之前的页面
  router.replace({ name: mode.listRoute })
}
</script>

<template>
  <div class="ledger-mode-switch" role="tablist" :aria-label="t('ledger.entries.title')">
    <button
      v-for="mode in LEDGER_MODES"
      :key="mode.source"
      type="button"
      role="tab"
      class="mode-tab"
      :class="{ 'is-active': mode.source === source }"
      :aria-selected="mode.source === source"
      @click="switchMode(mode.source)"
    >
      {{ t(mode.tabKey) }}
    </button>
  </div>
</template>

<style scoped>
.ledger-mode-switch {
  /* 在外侧 flex 列里默认会被拉伸,这里保持胶囊自身体积 */
  align-self: flex-start;
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: #fff;
  border: 1px solid var(--color-border);
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
}

.mode-tab {
  min-width: 92px;
  height: 34px;
  padding: 0 20px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-2);
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

.mode-tab:hover {
  background: var(--color-bg-bottom);
  color: var(--color-text-1);
}

.mode-tab.is-active {
  background: var(--el-color-primary);
  color: #fff;
  box-shadow: 0 2px 8px rgba(11, 176, 109, 0.28);
}

.mode-tab.is-active:hover {
  background: var(--el-color-primary);
  color: #fff;
}

.mode-tab:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

@media (max-width: 768px) {
  .ledger-mode-switch {
    align-self: stretch;
    display: flex;
    width: 100%;
  }

  .mode-tab {
    flex: 1;
    min-width: 0;
    padding: 0 12px;
  }
}
</style>
