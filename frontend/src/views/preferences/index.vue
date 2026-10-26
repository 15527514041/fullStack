<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { getPreferences, updatePreferences } from '@/api/preferences'
import { COLOR_THEMES, type ColorThemeKey, type ColorThemeOption } from '@/theme/config'
import { useTheme } from '@/theme'
import {
  DEFAULT_LEDGER_ENTRY_SOURCES,
  normalizeLedgerEntrySources
} from '@/utils/ledgerPreferences'
import type { LedgerRecordSource } from '@/types'

const { t } = useI18n()
const { colorTheme, isDark, setColorTheme: applyColorTheme } = useTheme()

const loading = ref(true)
const saving = ref(false)
const draftColorTheme = ref<ColorThemeKey>(colorTheme.value)
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
const themeOptions = computed(() => Object.values(COLOR_THEMES))

const dirty = computed(
  () =>
    draftSources.value.length !== savedSources.value.length ||
    draftSources.value.some((source) => !savedSources.value.includes(source))
)
const themeDirty = computed(() => draftColorTheme.value !== colorTheme.value)
const hasUnsavedChanges = computed(() => dirty.value || themeDirty.value)

// 其他标签页保存配色时同步草稿；当前页已有未保存选择时保留用户草稿。
watch(colorTheme, (theme, previousTheme) => {
  if (draftColorTheme.value === previousTheme) {
    draftColorTheme.value = theme
  }
})

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

function themeSwatchStyle(option: ColorThemeOption): Record<string, string> {
  const config = isDark.value ? option.dark : option.light
  return {
    '--theme-swatch-primary': config.brand.primary,
    '--theme-swatch-soft': config.brand['1'],
    '--theme-swatch-secondary': config.brand.secondary
  }
}

function handleColorThemeChange(theme: ColorThemeKey): void {
  draftColorTheme.value = theme
}

function saveColorTheme(): void {
  if (!themeDirty.value) return
  applyColorTheme(draftColorTheme.value)
  ElMessage.success(t('preferences.themeSaved'))
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
  if (!hasUnsavedChanges.value) return true
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
      <div class="section-title">{{ $t('preferences.themeTitle') }}</div>
      <p class="preferences-hint">{{ $t('preferences.themeHint') }}</p>

      <div class="theme-options" role="radiogroup" :aria-label="$t('preferences.themeTitle')">
        <button
          v-for="option in themeOptions"
          :key="option.key"
          type="button"
          role="radio"
          class="theme-option"
          :class="{ 'is-active': draftColorTheme === option.key }"
          :aria-checked="draftColorTheme === option.key"
          :style="themeSwatchStyle(option)"
          @click="handleColorThemeChange(option.key)"
        >
          <span class="theme-option__preview" aria-hidden="true">
            <span class="theme-option__swatch theme-option__swatch--soft" />
            <span class="theme-option__swatch theme-option__swatch--secondary" />
            <span class="theme-option__swatch theme-option__swatch--primary" />
          </span>
          <span class="theme-option__meta">
            <span class="theme-option__name">{{ $t(option.labelKey) }}</span>
            <span class="theme-option__client">{{ option.clientName }}</span>
          </span>
          <el-icon v-if="draftColorTheme === option.key" class="theme-option__check">
            <Check />
          </el-icon>
        </button>
      </div>

      <div class="preferences-actions">
        <span v-if="themeDirty" class="preferences-dirty">{{ $t('preferences.unsaved') }}</span>
        <el-button type="primary" :disabled="!themeDirty" @click="saveColorTheme">
          {{ $t('common.save') }}
        </el-button>
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
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preferences-card {
  width: 100%;
  padding-bottom: 28px;
  flex: none;
}

.preferences-hint {
  margin: 0 0 20px;
  font-size: 13px;
  line-height: 21px;
  color: var(--color-text-3);
}

.theme-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.theme-option {
  position: relative;
  min-height: 82px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-bg-bottom);
  color: var(--color-text-1);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

.theme-option:hover {
  border-color: var(--theme-swatch-primary);
}

.theme-option.is-active {
  border-color: var(--theme-swatch-primary);
  background: var(--color-bg-bottom);
  box-shadow: 0 0 0 1px var(--theme-swatch-primary);
}

.theme-option:focus-visible {
  outline: 2px solid var(--theme-swatch-primary);
  outline-offset: 2px;
}

.theme-option__preview {
  position: relative;
  width: 48px;
  height: 34px;
  flex-shrink: 0;
}

.theme-option__swatch {
  position: absolute;
  top: 4px;
  width: 26px;
  height: 26px;
  border: 3px solid var(--color-bg-card);
  border-radius: 50%;
}

.theme-option__swatch--soft {
  left: 0;
  background: var(--theme-swatch-soft);
}

.theme-option__swatch--secondary {
  left: 11px;
  background: var(--theme-swatch-secondary);
}

.theme-option__swatch--primary {
  left: 22px;
  background: var(--theme-swatch-primary);
}

.theme-option__meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.theme-option__name {
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  color: var(--color-text-1);
}

.theme-option__client {
  font-size: 12px;
  line-height: 18px;
  color: var(--color-text-3);
}

.theme-option__check {
  margin-left: auto;
  flex-shrink: 0;
  color: var(--theme-swatch-primary);
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

  .theme-options {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
