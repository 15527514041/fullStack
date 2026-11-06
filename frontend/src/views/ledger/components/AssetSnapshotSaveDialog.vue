<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import {
  createAssetSnapshot,
  getAssetSnapshotPreview,
  getAssetSnapshots
} from '@/api/ledger'
import AmountVisibilityIcon from '@/components/AmountVisibilityIcon.vue'
import ColorDot from '@/components/ColorDot.vue'
import { formatDateTimeShort, toDateString } from '@/utils/datetime'
import { formatCents } from '@/utils/money'
import type {
  LedgerAccount,
  LedgerAssetSnapshotDetail,
  LedgerAssetSnapshotPreview,
  LedgerAssetSnapshotSummary
} from '@/types'

const props = withDefaults(
  defineProps<{
    visible: boolean
    initialAmountVisible?: boolean
  }>(),
  { initialAmountVisible: false }
)

const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: [snapshot: LedgerAssetSnapshotDetail]
}>()

const { t } = useI18n()
const MASKED_AMOUNT = '******'

const snapshotDate = ref(toDateString(new Date()))
const note = ref('')
const preview = ref<LedgerAssetSnapshotPreview | null>(null)
const snapshots = ref<LedgerAssetSnapshotSummary[]>([])
const loading = ref(false)
const saving = ref(false)
const amountsVisible = ref(props.initialAmountVisible)

const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value)
})

const amountToggleLabel = computed(() =>
  t(amountsVisible.value ? 'ledger.accounts.hideAmounts' : 'ledger.accounts.showAmounts')
)

function formatAmount(cents: number): string {
  return amountsVisible.value ? formatCents(cents) : MASKED_AMOUNT
}

function accountMeta(account: LedgerAccount): string {
  return [
    account.kind.name,
    account.note,
    `${t('ledger.accounts.balanceUpdatedAtLabel')}: ${formatDateTimeShort(account.balanceUpdatedAt)}`
  ]
    .filter(Boolean)
    .join(' · ')
}

async function loadPreview(): Promise<void> {
  loading.value = true
  try {
    const [currentPreview, history] = await Promise.all([
      getAssetSnapshotPreview(),
      getAssetSnapshots().catch(() => [])
    ])
    preview.value = currentPreview
    snapshots.value = history
  } catch {
    preview.value = null
  } finally {
    loading.value = false
  }
}

async function confirmOverwrite(): Promise<boolean> {
  try {
    await ElMessageBox.confirm(
      t('ledger.accounts.snapshotOverwriteConfirm', { date: snapshotDate.value }),
      t('ledger.accounts.snapshotOverwriteTitle'),
      {
        type: 'warning',
        showClose: false,
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel')
      }
    )
    return true
  } catch {
    return false
  }
}

async function saveSnapshot(overwrite: boolean): Promise<void> {
  saving.value = true
  try {
    const saved = await createAssetSnapshot({
      snapshotDate: snapshotDate.value,
      note: note.value.trim() || null,
      overwrite
    })
    ElMessage.success(t('ledger.accounts.snapshotSaved'))
    emit('saved', saved)
    dialogVisible.value = false
  } finally {
    saving.value = false
  }
}

async function handleSave(): Promise<void> {
  if (!snapshotDate.value || !preview.value?.accounts.length || saving.value) return

  const exists = snapshots.value.some((snapshot) => snapshot.snapshotDate === snapshotDate.value)
  if (exists && !(await confirmOverwrite())) return

  try {
    await saveSnapshot(exists)
  } catch (error) {
    // 页面打开后仍有极小概率被别人抢先保存;按后端唯一日期约束再确认一次。
    if (error instanceof Error && error.message.includes('该日期已有资产快照')) {
      if (await confirmOverwrite()) {
        try {
          await saveSnapshot(true)
        } catch {
          // 错误提示已由请求拦截器统一处理
        }
      }
    }
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    snapshotDate.value = toDateString(new Date())
    note.value = ''
    amountsVisible.value = props.initialAmountVisible
    void loadPreview()
  }
)
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="$t('ledger.accounts.snapshotSaveTitle')"
    width="min(760px, 94vw)"
    :show-close="false"
    class="snapshot-save-dialog"
  >
    <div class="snapshot-hint">{{ $t('ledger.accounts.snapshotSaveHint') }}</div>

    <div class="snapshot-fields">
      <label class="snapshot-field">
        <span class="snapshot-field-label">
          {{ $t('ledger.accounts.snapshotDate') }}
          <span class="required-mark" :aria-label="$t('common.required')">*</span>
        </span>
        <el-date-picker
          v-model="snapshotDate"
          type="date"
          value-format="YYYY-MM-DD"
          :clearable="false"
          :placeholder="$t('ledger.accounts.snapshotDatePlaceholder')"
          style="width: 100%"
        />
      </label>
      <label class="snapshot-field">
        <span class="snapshot-field-label">{{ $t('ledger.accounts.snapshotNote') }}</span>
        <el-input
          v-model="note"
          maxlength="100"
          show-word-limit
          :placeholder="$t('ledger.accounts.snapshotNotePlaceholder')"
        />
      </label>
    </div>

    <div class="snapshot-section-head">
      <div>
        <div class="snapshot-section-title">{{ $t('ledger.accounts.snapshotPreview') }}</div>
        <div v-if="preview" class="snapshot-section-meta">
          {{
            $t('ledger.accounts.snapshotAccountSummary', {
              total: preview.stats.accountCount,
              enabled: preview.stats.enabledAccountCount
            })
          }}
        </div>
      </div>
      <el-tooltip :content="amountToggleLabel" placement="top">
        <button
          type="button"
          class="amount-visibility-toggle"
          :aria-label="amountToggleLabel"
          :aria-pressed="!amountsVisible"
          @click="amountsVisible = !amountsVisible"
        >
          <AmountVisibilityIcon :visible="amountsVisible" :size="18" />
        </button>
      </el-tooltip>
    </div>

    <el-skeleton v-if="loading" :rows="5" animated />

    <template v-else-if="preview">
      <div class="snapshot-stat-grid">
        <div class="snapshot-stat">
          <span>{{ $t('ledger.accounts.totalAssets') }}</span>
          <strong>{{ formatAmount(preview.stats.totalAssetsCents) }}</strong>
        </div>
        <div class="snapshot-stat">
          <span>{{ $t('ledger.accounts.totalDebt') }}</span>
          <strong class="is-debt">{{ formatAmount(preview.stats.totalDebtCents) }}</strong>
        </div>
        <div class="snapshot-stat">
          <span>{{ $t('ledger.accounts.netAssets') }}</span>
          <strong>{{ formatAmount(preview.stats.netAssetsCents) }}</strong>
        </div>
      </div>

      <div v-if="preview.accounts.length === 0" class="snapshot-empty">
        {{ $t('ledger.accounts.snapshotNoAccounts') }}
      </div>
      <div v-else class="snapshot-account-list">
        <div
          v-for="account in preview.accounts"
          :key="account.id"
          class="snapshot-account-row"
          :class="{ 'is-disabled': !account.enabled }"
        >
          <div class="snapshot-account-main">
            <div class="snapshot-account-title">
              <ColorDot :color="account.kind.color" />
              <span>{{ account.name }}</span>
              <el-tag v-if="!account.enabled" size="small" type="info">
                {{ $t('ledger.accounts.snapshotDisabledItem') }}
              </el-tag>
            </div>
            <div class="snapshot-account-meta">{{ accountMeta(account) }}</div>
          </div>
          <strong
            class="snapshot-account-balance"
            :class="{ 'is-negative': account.balanceCents < 0 }"
          >
            {{ formatAmount(account.balanceCents) }}
          </strong>
        </div>
      </div>
    </template>

    <template #footer>
      <el-button @click="dialogVisible = false">{{ $t('common.cancel') }}</el-button>
      <el-button
        type="primary"
        :loading="saving"
        :disabled="loading || !preview?.accounts.length || !snapshotDate"
        @click="handleSave"
      >
        {{ $t('ledger.accounts.snapshotSaveButton') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.snapshot-hint {
  margin-bottom: 18px;
  font-size: 13px;
  line-height: 20px;
  color: var(--color-text-3);
}

.snapshot-fields {
  display: grid;
  grid-template-columns: minmax(180px, 0.75fr) minmax(240px, 1.25fr);
  gap: 16px;
  margin-bottom: 24px;
}

.snapshot-field {
  display: grid;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-2);
}

.snapshot-field-label {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.required-mark {
  color: var(--el-color-danger);
  font-size: 14px;
  line-height: 1;
}

.snapshot-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.snapshot-section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-1);
}

.snapshot-section-meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-3);
}

.amount-visibility-toggle {
  display: inline-flex;
  width: 28px;
  height: 28px;
  padding: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-3);
  cursor: pointer;
}

.amount-visibility-toggle:hover {
  background: var(--color-brand-1);
  color: var(--color-brand-6);
}

.snapshot-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 16px;
  border-radius: 18px;
  background: var(--color-brand-1);
}

.snapshot-stat {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.snapshot-stat span {
  font-size: 12px;
  color: var(--color-text-3);
}

.snapshot-stat strong {
  overflow: hidden;
  font-size: 19px;
  color: var(--color-text-1);
  text-overflow: ellipsis;
}

.snapshot-stat .is-debt,
.snapshot-account-balance.is-negative {
  color: var(--el-color-danger);
}

.snapshot-account-list {
  margin-top: 18px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 16px;
}

.snapshot-account-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.snapshot-account-row:last-child {
  border-bottom: 0;
}

.snapshot-account-row.is-disabled {
  opacity: 0.58;
}

.snapshot-account-main {
  min-width: 0;
}

.snapshot-account-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  font-weight: 500;
  color: var(--color-text-1);
}

.snapshot-account-meta {
  margin-top: 6px;
  overflow: hidden;
  font-size: 12px;
  line-height: 18px;
  color: var(--color-text-3);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snapshot-account-balance {
  flex-shrink: 0;
  font-size: 15px;
  color: var(--color-text-1);
}

.snapshot-empty {
  margin-top: 16px;
  padding: 28px 16px;
  border-radius: 14px;
  background: var(--el-fill-color-lighter);
  text-align: center;
  color: var(--color-text-3);
}

@media (max-width: 768px) {
  .snapshot-fields {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .snapshot-stat-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .snapshot-stat {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  .snapshot-stat strong {
    font-size: 17px;
  }

  .snapshot-account-row {
    align-items: flex-start;
    gap: 12px;
  }

  .snapshot-account-meta {
    white-space: normal;
  }
}
</style>
