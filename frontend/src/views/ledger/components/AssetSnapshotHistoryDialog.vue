<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import {
  compareAssetSnapshots,
  deleteAssetSnapshot,
  getAssetSnapshot,
  getAssetSnapshots
} from '@/api/ledger'
import AmountVisibilityIcon from '@/components/AmountVisibilityIcon.vue'
import ColorDot from '@/components/ColorDot.vue'
import InfoTipIcon from '@/components/InfoTipIcon.vue'
import RelaxedEmptyState from '@/components/RelaxedEmptyState.vue'
import { formatDate, formatDateTimeShort } from '@/utils/datetime'
import { formatCents } from '@/utils/money'
import type {
  LedgerAssetSnapshotComparison,
  LedgerAssetSnapshotDetail,
  LedgerAssetSnapshotItem,
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
}>()

const { t } = useI18n()
const MASKED_AMOUNT = '******'

const snapshots = ref<LedgerAssetSnapshotSummary[]>([])
const comparison = ref<LedgerAssetSnapshotComparison | null>(null)
const detail = ref<LedgerAssetSnapshotDetail | null>(null)
const detailVisible = ref(false)
const fromSnapshot = ref<LedgerAssetSnapshotDetail | null>(null)
const toSnapshot = ref<LedgerAssetSnapshotDetail | null>(null)
const selectedFromId = ref<number | null>(null)
const selectedToId = ref<number | null>(null)
const loading = ref(false)
const comparing = ref(false)
const detailLoadingId = ref<number | null>(null)
const deletingId = ref<number | null>(null)
const amountsVisible = ref(props.initialAmountVisible)

const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value)
})

const amountToggleLabel = computed(() =>
  t(amountsVisible.value ? 'ledger.accounts.hideAmounts' : 'ledger.accounts.showAmounts')
)

type AccountComparisonStatus = 'added' | 'removed' | 'changed' | 'unchanged'

const accountStatusLabelKeys: Record<AccountComparisonStatus, string> = {
  added: 'ledger.accounts.snapshotAdded',
  removed: 'ledger.accounts.snapshotRemoved',
  changed: 'ledger.accounts.snapshotChanged',
  unchanged: 'ledger.accounts.snapshotUnchanged'
}

interface AccountComparisonRow {
  accountId: number
  accountName: string
  kindName: string
  kindColor: string
  enabled: boolean
  fromAccount: LedgerAssetSnapshotItem | null
  toAccount: LedgerAssetSnapshotItem | null
  balanceDeltaCents: number
  status: AccountComparisonStatus
  previousName: string | null
}

const accountComparisonRows = computed<AccountComparisonRow[]>(() => {
  if (!fromSnapshot.value || !toSnapshot.value) return []

  const fromById = new Map(
    fromSnapshot.value.items.map((account) => [account.accountId, account])
  )
  const toById = new Map(toSnapshot.value.items.map((account) => [account.accountId, account]))
  const accountIds = new Set([...fromById.keys(), ...toById.keys()])
  const statusOrder: Record<AccountComparisonStatus, number> = {
    added: 0,
    removed: 1,
    changed: 2,
    unchanged: 3
  }

  return Array.from(accountIds)
    .map((accountId) => {
      const fromAccount = fromById.get(accountId) ?? null
      const toAccount = toById.get(accountId) ?? null
      const displayAccount = toAccount ?? fromAccount
      if (!displayAccount) return null

      const balanceDeltaCents =
        (toAccount?.balanceCents ?? 0) - (fromAccount?.balanceCents ?? 0)
      let status: AccountComparisonStatus = 'unchanged'
      if (!fromAccount) status = 'added'
      else if (!toAccount) status = 'removed'
      else if (balanceDeltaCents !== 0) status = 'changed'

      return {
        accountId,
        accountName: displayAccount.accountName,
        kindName: displayAccount.kindName,
        kindColor: displayAccount.kindColor,
        enabled: displayAccount.enabled,
        fromAccount,
        toAccount,
        balanceDeltaCents,
        status,
        previousName:
          fromAccount && toAccount && fromAccount.accountName !== toAccount.accountName
            ? fromAccount.accountName
            : null
      }
    })
    .filter((row): row is AccountComparisonRow => row !== null)
    .sort((left, right) => {
      const statusDifference = statusOrder[left.status] - statusOrder[right.status]
      if (statusDifference !== 0) return statusDifference
      const amountDifference = Math.abs(right.balanceDeltaCents) - Math.abs(left.balanceDeltaCents)
      if (amountDifference !== 0) return amountDifference
      return left.accountName.localeCompare(right.accountName)
    })
})

function formatAmount(cents: number): string {
  return amountsVisible.value ? formatCents(cents) : MASKED_AMOUNT
}

function formatMoneyDelta(cents: number): string {
  if (!amountsVisible.value) return MASKED_AMOUNT
  return cents > 0 ? `+${formatCents(cents)}` : formatCents(cents)
}

function formatCountDelta(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}

function moneyDeltaClass(value: number, debt = false): string {
  if (!amountsVisible.value || value === 0) return ''
  const favorable = debt ? value < 0 : value > 0
  return favorable ? 'is-positive' : 'is-negative'
}

function accountStatusTagType(
  status: AccountComparisonStatus
): 'success' | 'danger' | 'warning' | 'info' {
  if (status === 'added') return 'success'
  if (status === 'removed') return 'danger'
  if (status === 'changed') return 'warning'
  return 'info'
}

function snapshotOptionLabel(snapshot: LedgerAssetSnapshotSummary): string {
  const note = snapshot.note ? ` · ${snapshot.note}` : ''
  return `${formatDate(snapshot.snapshotDate)}${note}`
}

function frozenAccountMeta(account: LedgerAssetSnapshotItem): string {
  return [
    account.kindName,
    account.note,
    `${t('ledger.accounts.balanceUpdatedAtLabel')}: ${formatDateTimeShort(account.balanceUpdatedAt)}`
  ]
    .filter(Boolean)
    .join(' · ')
}

async function loadComparison(): Promise<void> {
  if (!selectedFromId.value || !selectedToId.value) {
    comparison.value = null
    fromSnapshot.value = null
    toSnapshot.value = null
    return
  }
  if (selectedFromId.value === selectedToId.value) {
    comparison.value = null
    fromSnapshot.value = null
    toSnapshot.value = null
    return
  }

  comparing.value = true
  try {
    const [summary, from, to] = await Promise.all([
      compareAssetSnapshots(selectedFromId.value, selectedToId.value),
      getAssetSnapshot(selectedFromId.value),
      getAssetSnapshot(selectedToId.value)
    ])
    comparison.value = summary
    fromSnapshot.value = from
    toSnapshot.value = to
  } catch {
    comparison.value = null
    fromSnapshot.value = null
    toSnapshot.value = null
  } finally {
    comparing.value = false
  }
}

async function loadSnapshots(): Promise<void> {
  loading.value = true
  detail.value = null
  comparison.value = null
  fromSnapshot.value = null
  toSnapshot.value = null
  try {
    const list = await getAssetSnapshots()
    snapshots.value = list

    if (list.length >= 2) {
      selectedFromId.value = list[1].id
      selectedToId.value = list[0].id
    } else {
      selectedFromId.value = list[0]?.id ?? null
      selectedToId.value = null
    }
  } catch {
    snapshots.value = []
  } finally {
    loading.value = false
  }
}

async function openDetail(snapshotId: number): Promise<void> {
  detailLoadingId.value = snapshotId
  try {
    detail.value = await getAssetSnapshot(snapshotId)
    detailVisible.value = true
  } finally {
    detailLoadingId.value = null
  }
}

async function handleDelete(snapshot: LedgerAssetSnapshotSummary): Promise<void> {
  try {
    await ElMessageBox.confirm(
      t('ledger.accounts.snapshotDeleteConfirm', {
        date: formatDate(snapshot.snapshotDate)
      }),
      t('common.tip'),
      {
        type: 'warning',
        showClose: false,
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel')
      }
    )
  } catch {
    return
  }

  deletingId.value = snapshot.id
  try {
    await deleteAssetSnapshot(snapshot.id)
    ElMessage.success(t('ledger.accounts.snapshotDeleted'))
    await loadSnapshots()
  } catch {
    // 错误提示已由请求拦截器统一处理
  } finally {
    deletingId.value = null
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      detailVisible.value = false
      detail.value = null
      return
    }
    detailVisible.value = false
    detail.value = null
    amountsVisible.value = props.initialAmountVisible
    void loadSnapshots()
  }
)
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="$t('ledger.accounts.snapshotHistoryTitle')"
    width="min(980px, 94vw)"
    :show-close="false"
    class="snapshot-history-dialog"
  >
    <el-skeleton v-if="loading" :rows="7" animated />

    <div v-else-if="snapshots.length === 0" class="snapshot-empty">
      {{ $t('ledger.accounts.snapshotEmpty') }}
    </div>

    <div v-else class="snapshot-history-body">
      <section class="snapshot-compare-panel">
        <div class="snapshot-section-head">
          <div class="snapshot-title-with-tip">
            <div class="snapshot-section-title">{{ $t('ledger.accounts.snapshotComparison') }}</div>
            <InfoTipIcon :content="$t('ledger.accounts.snapshotHistoryHint')" />
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

        <el-alert
          v-if="snapshots.length < 2"
          type="info"
          :closable="false"
          show-icon
          :title="$t('ledger.accounts.snapshotNeedTwo')"
        />

        <template v-else>
          <div class="snapshot-compare-controls">
            <el-select
              v-model="selectedFromId"
              class="snapshot-compare-select"
              :placeholder="$t('ledger.accounts.snapshotFrom')"
              @change="comparison = null"
            >
              <el-option
                v-for="snapshot in snapshots"
                :key="snapshot.id"
                :value="snapshot.id"
                :label="snapshotOptionLabel(snapshot)"
              />
            </el-select>
            <span class="snapshot-compare-arrow">→</span>
            <el-select
              v-model="selectedToId"
              class="snapshot-compare-select"
              :placeholder="$t('ledger.accounts.snapshotTo')"
              @change="comparison = null"
            >
              <el-option
                v-for="snapshot in snapshots"
                :key="snapshot.id"
                :value="snapshot.id"
                :label="snapshotOptionLabel(snapshot)"
              />
            </el-select>
            <el-button
              type="primary"
              class="snapshot-compare-button"
              :loading="comparing"
              :disabled="!selectedFromId || !selectedToId || selectedFromId === selectedToId"
              @click="loadComparison"
            >
              {{ $t('ledger.accounts.snapshotCompareButton') }}
            </el-button>
          </div>

          <el-skeleton v-if="comparing && !comparison" :rows="4" animated />
          <div v-else-if="!comparison" class="snapshot-compare-empty-state">
            <RelaxedEmptyState
              compact
              :description="$t('ledger.accounts.snapshotCompareEmpty')"
            />
          </div>

          <template v-if="comparison">
            <div class="snapshot-account-compare-head snapshot-summary-head">
              <div class="snapshot-subsection-title">
                {{ $t('ledger.accounts.snapshotSummaryComparison') }}
              </div>
            </div>
            <div class="snapshot-compare-table">
              <div class="snapshot-compare-row is-head">
                <span>{{ $t('ledger.accounts.snapshotMetric') }}</span>
                <span>{{ formatDate(comparison.from.snapshotDate) }}</span>
                <span>{{ formatDate(comparison.to.snapshotDate) }}</span>
                <span>{{ $t('ledger.accounts.snapshotChange') }}</span>
              </div>
              <div class="snapshot-compare-row">
                <span>{{ $t('ledger.accounts.totalAssets') }}</span>
                <strong>{{ formatAmount(comparison.from.totalAssetsCents) }}</strong>
                <strong>{{ formatAmount(comparison.to.totalAssetsCents) }}</strong>
                <strong :class="moneyDeltaClass(comparison.delta.totalAssetsCents)">
                  {{ formatMoneyDelta(comparison.delta.totalAssetsCents) }}
                </strong>
              </div>
              <div class="snapshot-compare-row">
                <span>{{ $t('ledger.accounts.totalDebt') }}</span>
                <strong>{{ formatAmount(comparison.from.totalDebtCents) }}</strong>
                <strong>{{ formatAmount(comparison.to.totalDebtCents) }}</strong>
                <strong :class="moneyDeltaClass(comparison.delta.totalDebtCents, true)">
                  {{ formatMoneyDelta(comparison.delta.totalDebtCents) }}
                </strong>
              </div>
              <div class="snapshot-compare-row is-emphasis">
                <span>{{ $t('ledger.accounts.netAssets') }}</span>
                <strong>{{ formatAmount(comparison.from.netAssetsCents) }}</strong>
                <strong>{{ formatAmount(comparison.to.netAssetsCents) }}</strong>
                <strong :class="moneyDeltaClass(comparison.delta.netAssetsCents)">
                  {{ formatMoneyDelta(comparison.delta.netAssetsCents) }}
                </strong>
              </div>
              <div class="snapshot-compare-row">
                <span>{{ $t('ledger.accounts.snapshotAccountMetric') }}</span>
                <strong>{{ comparison.from.accountCount }}</strong>
                <strong>{{ comparison.to.accountCount }}</strong>
                <strong>{{ formatCountDelta(comparison.delta.accountCount) }}</strong>
              </div>
            </div>
          </template>

          <div v-if="comparison" class="snapshot-account-compare">
            <div class="snapshot-account-compare-head">
              <div class="snapshot-subsection-title">
                {{ $t('ledger.accounts.snapshotAccountComparison') }}
              </div>
              <div class="snapshot-account-compare-hint">
                {{ $t('ledger.accounts.snapshotAccountComparisonHint') }}
              </div>
            </div>

            <div class="snapshot-account-compare-scroll">
              <div class="snapshot-account-compare-table">
                <div class="snapshot-account-compare-row is-head">
                  <span>{{ $t('ledger.accounts.colName') }}</span>
                  <span>{{ formatDate(comparison.from.snapshotDate) }}</span>
                  <span>{{ formatDate(comparison.to.snapshotDate) }}</span>
                  <span>{{ $t('ledger.accounts.snapshotChange') }}</span>
                </div>
                <div
                  v-for="row in accountComparisonRows"
                  :key="row.accountId"
                  class="snapshot-account-compare-row"
                >
                  <div class="snapshot-account-compare-name">
                    <div class="snapshot-account-compare-title">
                      <ColorDot :color="row.kindColor" />
                      <span>{{ row.accountName }}</span>
                    </div>
                    <div class="snapshot-account-compare-meta">
                      {{ row.kindName }}
                      <template v-if="row.previousName">
                        · {{ $t('ledger.accounts.snapshotPreviousName', { name: row.previousName }) }}
                      </template>
                    </div>
                  </div>
                  <strong
                    :class="{ 'is-negative': (row.fromAccount?.balanceCents ?? 0) < 0 }"
                  >
                    {{
                      row.fromAccount
                        ? formatAmount(row.fromAccount.balanceCents)
                        : '—'
                    }}
                  </strong>
                  <strong
                    :class="{ 'is-negative': (row.toAccount?.balanceCents ?? 0) < 0 }"
                  >
                    {{ row.toAccount ? formatAmount(row.toAccount.balanceCents) : '—' }}
                  </strong>
                  <div class="snapshot-account-compare-delta">
                    <strong :class="moneyDeltaClass(row.balanceDeltaCents)">
                      {{ formatMoneyDelta(row.balanceDeltaCents) }}
                    </strong>
                    <el-tag
                      size="small"
                      effect="plain"
                      :type="accountStatusTagType(row.status)"
                    >
                      {{ $t(accountStatusLabelKeys[row.status]) }}
                    </el-tag>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </section>

      <section class="snapshot-batch-section">
        <div class="snapshot-section-title">{{ $t('ledger.accounts.snapshotBatchList') }}</div>
        <div class="snapshot-batch-list">
          <article
            v-for="(snapshot, index) in snapshots"
            :key="snapshot.id"
            class="snapshot-batch-card"
          >
            <div class="snapshot-batch-head">
              <div>
                <div class="snapshot-batch-date">
                  {{ formatDate(snapshot.snapshotDate) }}
                  <el-tag v-if="index === 0" size="small" effect="plain">
                    {{ $t('ledger.accounts.snapshotLatest') }}
                  </el-tag>
                </div>
                <div class="snapshot-batch-note">{{ snapshot.note || '—' }}</div>
              </div>
              <div class="snapshot-batch-actions">
                <el-button
                  link
                  type="primary"
                  :loading="detailLoadingId === snapshot.id"
                  @click="openDetail(snapshot.id)"
                >
                  {{ $t('ledger.accounts.snapshotViewDetail') }}
                </el-button>
                <el-button
                  link
                  type="danger"
                  :loading="deletingId === snapshot.id"
                  @click="handleDelete(snapshot)"
                >
                  {{ $t('common.delete') }}
                </el-button>
              </div>
            </div>
            <div class="snapshot-batch-values">
              <span>
                {{ $t('ledger.accounts.totalAssets') }}
                <strong>{{ formatAmount(snapshot.totalAssetsCents) }}</strong>
              </span>
              <span>
                {{ $t('ledger.accounts.totalDebt') }}
                <strong>{{ formatAmount(snapshot.totalDebtCents) }}</strong>
              </span>
              <span>
                {{ $t('ledger.accounts.netAssets') }}
                <strong>{{ formatAmount(snapshot.netAssetsCents) }}</strong>
              </span>
            </div>
            <div class="snapshot-batch-meta">
              <span>
                {{ $t('ledger.accounts.snapshotAccountCount', { count: snapshot.accountCount }) }}
              </span>
              <span>
                {{ $t('ledger.accounts.snapshotEnabledCount', { count: snapshot.enabledAccountCount }) }}
              </span>
              <span>
                {{ $t('ledger.accounts.snapshotCapturedAt', { time: formatDateTimeShort(snapshot.createdAt) }) }}
              </span>
            </div>
          </article>
        </div>
      </section>
    </div>

    <template #footer>
      <el-button @click="dialogVisible = false">{{ $t('common.cancel') }}</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="detailVisible"
    :title="$t('ledger.accounts.snapshotDetailTitle')"
    width="min(760px, 92vw)"
    :show-close="false"
    class="snapshot-detail-dialog"
    @closed="detail = null"
  >
    <div v-if="detail" class="snapshot-detail">
      <div class="snapshot-detail-head">
        <div>
          <div class="snapshot-detail-date">{{ formatDate(detail.snapshotDate) }}</div>
          <div class="snapshot-detail-note">{{ detail.note || '—' }}</div>
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

      <div class="snapshot-stat-grid">
        <div class="snapshot-stat">
          <span>{{ $t('ledger.accounts.totalAssets') }}</span>
          <strong>{{ formatAmount(detail.totalAssetsCents) }}</strong>
        </div>
        <div class="snapshot-stat">
          <span>{{ $t('ledger.accounts.totalDebt') }}</span>
          <strong class="is-debt">{{ formatAmount(detail.totalDebtCents) }}</strong>
        </div>
        <div class="snapshot-stat">
          <span>{{ $t('ledger.accounts.netAssets') }}</span>
          <strong>{{ formatAmount(detail.netAssetsCents) }}</strong>
        </div>
      </div>

      <div class="snapshot-detail-meta">
        {{
          $t('ledger.accounts.snapshotAccountSummary', {
            total: detail.accountCount,
            enabled: detail.enabledAccountCount
          })
        }}
        ·
        {{ $t('ledger.accounts.snapshotCapturedAt', { time: formatDateTimeShort(detail.createdAt) }) }}
      </div>
      <div class="snapshot-frozen-hint">{{ $t('ledger.accounts.snapshotFrozenHint') }}</div>

      <div class="snapshot-account-list is-detail">
        <div
          v-for="account in detail.items"
          :key="`${detail.id}-${account.accountId}`"
          class="snapshot-account-row"
          :class="{ 'is-disabled': !account.enabled }"
        >
          <div class="snapshot-account-main">
            <div class="snapshot-account-title">
              <ColorDot :color="account.kindColor" />
              <span>{{ account.accountName }}</span>
              <el-tag v-if="!account.enabled" size="small" type="info">
                {{ $t('ledger.accounts.snapshotDisabledItem') }}
              </el-tag>
            </div>
            <div class="snapshot-account-meta">{{ frozenAccountMeta(account) }}</div>
          </div>
          <strong
            class="snapshot-account-balance"
            :class="{ 'is-negative': account.balanceCents < 0 }"
          >
            {{ formatAmount(account.balanceCents) }}
          </strong>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="detailVisible = false">{{ $t('common.close') }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.snapshot-frozen-hint {
  margin-bottom: 16px;
  font-size: 13px;
  line-height: 20px;
  color: var(--color-text-3);
}

.snapshot-title-with-tip {
  display: flex;
  align-items: center;
  gap: 6px;
}

.snapshot-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.snapshot-section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-1);
}

.snapshot-subsection-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-1);
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

.snapshot-compare-controls {
  display: grid;
  grid-template-columns: 250px auto 250px auto;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  margin-top: 16px;
}

.snapshot-compare-select {
  width: 250px;
}

.snapshot-compare-select :deep(.el-select__wrapper) {
  min-height: 40px;
  border-radius: 12px;
}

.snapshot-compare-button {
  height: 40px;
  padding: 0 20px;
  border-radius: 12px;
  font-weight: 500;
}

.snapshot-compare-arrow {
  color: var(--color-text-3);
}

.snapshot-compare-empty-state {
  margin-top: 8px;
}

.snapshot-compare-empty-state :deep(.relaxed-empty-state__description) {
  max-width: none;
  white-space: nowrap;
}

.snapshot-compare-table {
  margin-top: 14px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 14px;
}

.snapshot-compare-row {
  display: grid;
  grid-template-columns: minmax(190px, 1.4fr) minmax(110px, 0.8fr) minmax(110px, 0.8fr) minmax(150px, 1fr);
  gap: 12px;
  align-items: center;
  min-height: 46px;
  padding: 10px 14px;
  border-top: 1px solid var(--color-border);
  font-size: 13px;
}

.snapshot-compare-row:first-child {
  border-top: 0;
}

.snapshot-compare-row.is-head {
  min-height: 38px;
  background: var(--el-fill-color-lighter);
  color: var(--color-text-3);
}

.snapshot-compare-row.is-emphasis {
  background: var(--color-brand-1);
}

.snapshot-compare-row strong,
.snapshot-compare-row > span:first-child {
  color: var(--color-text-1);
}

.snapshot-compare-row .is-positive {
  color: var(--el-color-success);
}

.snapshot-compare-row .is-negative {
  color: var(--el-color-danger);
}

.snapshot-account-compare {
  margin-top: 24px;
}

.snapshot-account-compare-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.snapshot-summary-head {
  margin-top: 20px;
  margin-bottom: 0;
}

.snapshot-account-compare-hint {
  font-size: 12px;
  color: var(--color-text-3);
}

.snapshot-account-compare-scroll {
  overflow-x: auto;
}

.snapshot-account-compare-table {
  min-width: 650px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 14px;
}

.snapshot-account-compare-row {
  display: grid;
  grid-template-columns: minmax(190px, 1.4fr) minmax(110px, 0.8fr) minmax(110px, 0.8fr) minmax(150px, 1fr);
  gap: 14px;
  align-items: center;
  min-height: 56px;
  padding: 10px 14px;
  border-top: 1px solid var(--color-border);
  font-size: 13px;
}

.snapshot-account-compare-row:first-child {
  border-top: 0;
}

.snapshot-account-compare-row.is-head {
  min-height: 38px;
  background: var(--el-fill-color-lighter);
  color: var(--color-text-3);
}

.snapshot-account-compare-row strong {
  color: var(--color-text-1);
}

.snapshot-account-compare-row .is-positive {
  color: var(--el-color-success);
}

.snapshot-account-compare-row .is-negative {
  color: var(--el-color-danger);
}

.snapshot-account-compare-title {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  font-weight: 500;
  color: var(--color-text-1);
}

.snapshot-account-compare-title > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snapshot-account-compare-meta {
  margin-top: 4px;
  font-size: 12px;
  line-height: 17px;
  color: var(--color-text-3);
}

.snapshot-account-compare-delta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.snapshot-account-compare-delta .el-tag {
  flex-shrink: 0;
}

.snapshot-batch-section {
  margin-top: 24px;
}

.snapshot-batch-list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.snapshot-batch-card {
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 16px;
}

.snapshot-batch-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.snapshot-batch-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
}

.snapshot-batch-actions .el-button {
  margin-left: 0;
}

.snapshot-batch-date {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
}

.snapshot-batch-note {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-3);
}

.snapshot-batch-values {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 14px;
}

.snapshot-batch-values span {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-3);
}

.snapshot-batch-values strong {
  overflow: hidden;
  font-size: 15px;
  color: var(--color-text-1);
  text-overflow: ellipsis;
}

.snapshot-batch-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--color-text-3);
}

.snapshot-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 18px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-3);
  cursor: pointer;
}

.snapshot-back:hover {
  color: var(--color-brand-6);
}

.snapshot-detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.snapshot-detail-date {
  font-size: 21px;
  font-weight: 600;
  color: var(--color-text-1);
}

.snapshot-detail-note {
  margin-top: 5px;
  font-size: 13px;
  color: var(--color-text-3);
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

.snapshot-detail-meta {
  margin-top: 12px;
  font-size: 12px;
  color: var(--color-text-3);
}

.snapshot-account-list {
  margin-top: 8px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 16px;
}

.snapshot-account-list.is-detail {
  margin-top: 14px;
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
  padding: 52px 20px;
  border-radius: 18px;
  background: var(--el-fill-color-lighter);
  text-align: center;
  color: var(--color-text-3);
}

@media (max-width: 768px) {
  .snapshot-compare-controls {
    grid-template-columns: 1fr;
  }

  .snapshot-compare-select,
  .snapshot-compare-button {
    width: 100%;
  }

  .snapshot-compare-arrow {
    display: none;
  }

  .snapshot-compare-table {
    overflow-x: auto;
  }

  .snapshot-compare-row {
    min-width: 650px;
  }

  .snapshot-batch-values {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .snapshot-batch-values span {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
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
