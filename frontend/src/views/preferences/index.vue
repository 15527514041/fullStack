<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { getPreferences, updatePreferences } from '@/api/preferences'
import {
  DEFAULT_LEDGER_ENTRY_SOURCES,
  normalizeLedgerEntrySources
} from '@/utils/ledgerPreferences'
import type { LedgerRecordSource } from '@/types'

const { t } = useI18n()

const loading = ref(true)
const saving = ref(false)
const savedSources = ref<LedgerRecordSource[]>([...DEFAULT_LEDGER_ENTRY_SOURCES])
const draftSources = ref<LedgerRecordSource[]>([...DEFAULT_LEDGER_ENTRY_SOURCES])

const options = computed<Array<{
  source: LedgerRecordSource
  label: string
  description: string
}>>(() => [
  {
    source: 'manual_day',
    label: t('preferences.dimensionDay'),
    description: t('preferences.dimensionDayDescription')
  },
  {
    source: 'manual_week',
    label: t('preferences.dimensionWeek'),
    description: t('preferences.dimensionWeekDescription')
  },
  {
    source: 'manual_month',
    label: t('preferences.dimensionMonth'),
    description: t('preferences.dimensionMonthDescription')
  }
])

const dirty = computed(
  () =>
    draftSources.value.length !== savedSources.value.length ||
    draftSources.value.some((source) => !savedSources.value.includes(source))
)

function applySources(sources: LedgerRecordSource[]): void {
  const normalized = normalizeLedgerEntrySources(sources)
  draftSources.value = [...normalized]
}

function handleSourcesChange(values: Array<string | number | boolean>): void {
  const selected = normalizeLedgerEntrySources(
    values.filter((value): value is LedgerRecordSource => typeof value === 'string')
  )
  draftSources.value = selected
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const preferences = await getPreferences()
    const sources = normalizeLedgerEntrySources(preferences.ledgerEntrySources)
    const resolved = sources.length ? sources : [...DEFAULT_LEDGER_ENTRY_SOURCES]
    savedSources.value = [...resolved]
    applySources(resolved)
  } catch {
    savedSources.value = [...DEFAULT_LEDGER_ENTRY_SOURCES]
    applySources(DEFAULT_LEDGER_ENTRY_SOURCES)
  } finally {
    loading.value = false
  }
}

async function save(): Promise<void> {
  if (!dirty.value || !draftSources.value.length || saving.value) return
  saving.value = true
  try {
    const result = await updatePreferences(normalizeLedgerEntrySources(draftSources.value))
    const sources = normalizeLedgerEntrySources(result.ledgerEntrySources)
    savedSources.value = [...sources]
    applySources(sources)
    ElMessage.success(t('preferences.saved'))
  } catch {
    // 错误提示由 axios 拦截器统一处理
  } finally {
    saving.value = false
  }
}

onBeforeRouteLeave(async () => {
  if (!dirty.value) return true
  try {
    await ElMessageBox.confirm(t('preferences.discardConfirm'), t('common.tip'), {
      type: 'warning',
      showClose: false,
      confirmButtonText: t('preferences.discard'),
      cancelButtonText: t('common.cancel')
    })
    return true
  } catch {
    return false
  }
})

onMounted(load)
</script>

<template>
  <div class="list-page preferences-page">
    <div class="page-header">
      <div class="title-section">
        <div class="page-title">{{ $t('preferences.title') }}</div>
        <div class="page-subtitle">{{ $t('preferences.subtitle') }}</div>
      </div>
    </div>

    <div class="info-card preferences-card">
      <div class="section-title">{{ $t('preferences.ledgerDimensionsTitle') }}</div>
      <p class="preferences-hint">{{ $t('preferences.ledgerDimensionsHint') }}</p>

      <el-skeleton v-if="loading" :rows="3" animated />
      <template v-else>
        <el-checkbox-group
          v-model="draftSources"
          class="preference-options"
          :disabled="saving"
          @change="handleSourcesChange"
        >
          <el-checkbox
            v-for="option in options"
            :key="option.source"
            :value="option.source"
            class="preference-option"
          >
            <span class="preference-option__content">
              <span class="preference-option__title">{{ option.label }}</span>
              <span class="preference-option__description">{{ option.description }}</span>
            </span>
          </el-checkbox>
        </el-checkbox-group>

        <p v-if="!draftSources.length" class="preferences-validation">
          {{ $t('preferences.keepOne') }}
        </p>

        <div class="preferences-actions">
          <span v-if="dirty" class="preferences-dirty">{{ $t('preferences.unsaved') }}</span>
          <el-button
            type="primary"
            :disabled="!dirty || !draftSources.length"
            :loading="saving"
            @click="save"
          >
            {{ $t('common.save') }}
          </el-button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.preferences-page {
  min-height: 100%;
}

.preferences-card {
  width: 100%;
  padding-bottom: 28px;
}

.preferences-hint {
  margin: 0 0 20px;
  font-size: 13px;
  line-height: 21px;
  color: var(--color-text-3);
}

.preference-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.preference-option {
  width: 100%;
  height: auto;
  margin: 0;
  padding: 14px 16px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-bg-bottom);
  align-items: flex-start;
}

.preference-option :deep(.el-checkbox__label) {
  width: 100%;
}

.preference-option :deep(.el-checkbox__input) {
  margin-top: 2px;
}

.preference-option__content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preference-option__title {
  font-size: 14px;
  line-height: 20px;
  color: var(--color-text-1);
}

.preference-option__description {
  font-size: 12px;
  line-height: 18px;
  color: var(--color-text-3);
}

.preferences-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.preferences-validation {
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--el-color-danger);
}

.preferences-actions .el-button {
  min-width: 96px;
  height: 40px;
  border-radius: 12px;
}

.preferences-dirty {
  font-size: 12px;
  color: var(--color-warning-6);
}

@media (max-width: 768px) {
  .preferences-card {
    padding-bottom: 22px;
  }

  .preferences-actions {
    justify-content: space-between;
  }

  .preference-options {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
