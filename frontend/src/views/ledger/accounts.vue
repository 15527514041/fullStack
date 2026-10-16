<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { createAccount, deleteAccount, getAccounts, updateAccount, updateAccountBalance } from '@/api/ledger'
import { useIsMobile } from '@/composables/useIsMobile'
import { formatDateTime } from '@/utils/datetime'
import { centsToYuan, formatCents, yuanToCents } from '@/utils/money'
import type { AccountKind, LedgerAccount } from '@/types'

const { t } = useI18n()
const { isMobile } = useIsMobile()

const accounts = ref<LedgerAccount[]>([])
const loading = ref(false)

// 类型色点:一眼区分微信 / 支付宝 / 银行卡
const KIND_COLORS: Record<AccountKind, string> = {
  WECHAT: '#07c160',
  ALIPAY: '#1677ff',
  BANK: '#5b8ff9',
  CREDIT_CARD: '#f0a020',
  CASH: '#22c55e',
  OTHER: '#9ca3af'
}

const kindOptions = computed<Array<{ value: AccountKind; label: string }>>(() => [
  { value: 'WECHAT', label: t('ledger.accounts.kindWechat') },
  { value: 'ALIPAY', label: t('ledger.accounts.kindAlipay') },
  { value: 'BANK', label: t('ledger.accounts.kindBank') },
  { value: 'CREDIT_CARD', label: t('ledger.accounts.kindCreditCard') },
  { value: 'CASH', label: t('ledger.accounts.kindCash') },
  { value: 'OTHER', label: t('ledger.accounts.kindOther') }
])

function kindLabel(kind: AccountKind): string {
  return kindOptions.value.find((item) => item.value === kind)?.label || kind
}

// 表格插槽里的 row 是 any,包一层函数,类型和兜底都有地方落
function kindColor(kind: AccountKind): string {
  return KIND_COLORS[kind] || KIND_COLORS.OTHER
}

// 停用的账户整体淡化(表格版),它只是个标记,数据还在
function rowClassName(data: { row: LedgerAccount }): string {
  return data.row.enabled ? '' : 'row-off'
}

/**
 * 三个合计:全部账户都算进去
 * 停用只是个标记(不再出现在录入选择里),余额是真实存在的钱,照算
 */
const totals = computed(() => {
  let assets = 0
  let debt = 0
  for (const item of accounts.value) {
    if (item.balanceCents >= 0) assets += item.balanceCents
    else debt -= item.balanceCents
  }
  return { assets, debt, net: assets - debt }
})

// 「很久没对账」提醒:超过 30 天没手动更新余额的账户有几个
const STALE_DAYS = 30
const staleCount = computed(() => {
  const limit = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000
  return accounts.value.filter((item) => new Date(item.balanceUpdatedAt).getTime() < limit).length
})

async function loadAccounts(): Promise<void> {
  loading.value = true
  try {
    accounts.value = await getAccounts()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  } finally {
    loading.value = false
  }
}

// 新建 / 编辑弹窗:editingAccountId 为 null 表示新建
const dialogVisible = ref(false)
const editingAccountId = ref<number | null>(null)
const submitting = ref(false)
const formRef = ref<FormInstance>()
const form = reactive<{ name: string; kind: AccountKind; balanceYuan: number | undefined; note: string }>({
  name: '',
  kind: 'WECHAT',
  balanceYuan: undefined,
  note: ''
})

const dialogTitle = computed(() =>
  editingAccountId.value === null ? t('ledger.accounts.dialogAdd') : t('ledger.accounts.dialogEdit')
)

// 校验文案跟随语言,切换语言后重新生成
const rules = computed<FormRules>(() => ({
  name: [
    { required: true, message: t('validation.accountNameRequired'), trigger: 'blur' },
    { min: 1, max: 20, message: t('validation.accountNameLength'), trigger: 'blur' }
  ]
}))

function openAddDialog(): void {
  editingAccountId.value = null
  form.name = ''
  form.kind = 'WECHAT'
  form.balanceYuan = undefined
  form.note = ''
  formRef.value?.clearValidate()
  dialogVisible.value = true
}

function openEditDialog(account: LedgerAccount): void {
  editingAccountId.value = account.id
  form.name = account.name
  form.kind = account.kind
  form.balanceYuan = centsToYuan(account.balanceCents)
  form.note = account.note || ''
  formRef.value?.clearValidate()
  dialogVisible.value = true
}

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  const note = form.note.trim() || null
  try {
    if (editingAccountId.value === null) {
      await createAccount({
        name: form.name.trim(),
        kind: form.kind,
        balanceCents: yuanToCents(form.balanceYuan ?? 0),
        note
      })
      ElMessage.success(t('ledger.accounts.created'))
    } else {
      // 余额不在这个接口里改:它有自己的入口(要刷新「上次对账」时间)
      await updateAccount(editingAccountId.value, { name: form.name.trim(), kind: form.kind, note })
      ElMessage.success(t('ledger.accounts.updated'))
    }
    dialogVisible.value = false
    await loadAccounts()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  } finally {
    submitting.value = false
  }
}

// 改余额:单独一个轻量弹窗,这是最高频的操作
const balanceVisible = ref(false)
const balanceTarget = ref<LedgerAccount | null>(null)
const balanceYuan = ref<number | undefined>(undefined)
const balanceSubmitting = ref(false)

function openBalanceDialog(account: LedgerAccount): void {
  balanceTarget.value = account
  balanceYuan.value = centsToYuan(account.balanceCents)
  balanceVisible.value = true
}

async function handleBalanceSubmit(): Promise<void> {
  if (!balanceTarget.value) return

  balanceSubmitting.value = true
  try {
    await updateAccountBalance(balanceTarget.value.id, yuanToCents(balanceYuan.value ?? 0))
    ElMessage.success(t('ledger.accounts.balanceSaved'))
    balanceVisible.value = false
    await loadAccounts()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  } finally {
    balanceSubmitting.value = false
  }
}

// 启用开关:停了就不再出现在录入的账户选择里,余额照算
async function handleToggleEnabled(account: LedgerAccount): Promise<void> {
  try {
    const updated = await updateAccount(account.id, { enabled: account.enabled })
    Object.assign(account, updated)
  } catch {
    account.enabled = !account.enabled // 失败时回滚显示
  }
}

async function handleDelete(account: LedgerAccount): Promise<void> {
  try {
    await ElMessageBox.confirm(t('ledger.accounts.deleteConfirm', { name: account.name }), t('common.tip'), {
      type: 'warning',
      showClose: false,
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel')
    })
  } catch {
    return // 用户取消
  }

  try {
    await deleteAccount(account.id)
    ElMessage.success(t('ledger.accounts.deleted'))
    await loadAccounts()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  }
}

onMounted(loadAccounts)
</script>

<template>
  <div class="list-page">
    <div class="page-header">
      <div class="title-section">
        <div class="page-title">{{ $t('ledger.accounts.title') }}</div>
        <div class="page-subtitle">{{ $t('ledger.accounts.balanceHint') }}</div>
      </div>
      <el-button type="primary" @click="openAddDialog">
        <el-icon><Plus /></el-icon>
        {{ $t('ledger.accounts.addButton') }}
      </el-button>
    </div>

    <!-- 超过 30 天没对账的提醒 -->
    <el-alert
      v-if="staleCount > 0"
      class="stale-alert"
      type="warning"
      show-icon
      :closable="false"
      :title="$t('ledger.accounts.staleTip', { count: staleCount })"
    />

    <!-- 资金概览:一个带底色的卡片,只放这三个数(样式参考 client) -->
    <div class="asset-card">
      <div class="asset-item">
        <div class="asset-label">{{ $t('ledger.accounts.totalAssets') }}</div>
        <div class="asset-value">{{ formatCents(totals.assets) }}</div>
      </div>
      <div class="asset-item">
        <div class="asset-label">{{ $t('ledger.accounts.totalDebt') }}</div>
        <div class="asset-value">{{ formatCents(totals.debt) }}</div>
      </div>
      <div class="asset-item">
        <div class="asset-label">{{ $t('ledger.accounts.netAssets') }}</div>
        <div class="asset-value">{{ formatCents(totals.net) }}</div>
      </div>
    </div>

    <el-skeleton v-if="loading && accounts.length === 0" :rows="6" animated class="list-skeleton" />

    <!-- 移动端:卡片列表 -->
    <div v-else-if="isMobile" class="card-list">
      <el-empty v-if="accounts.length === 0" :description="$t('ledger.accounts.empty')" />

      <div v-for="row in accounts" :key="row.id" class="list-card" :class="{ 'is-off': !row.enabled }">
        <div class="card-head">
          <div class="account-name">{{ row.name }}</div>
          <el-switch v-model="row.enabled" @change="handleToggleEnabled(row)" />
        </div>

        <div class="account-balance" :class="{ 'is-negative': row.balanceCents < 0 }">
          {{ formatCents(row.balanceCents) }}
        </div>

        <div class="card-meta">
          <span class="kind-cell">
            <i class="kind-dot" :style="{ background: kindColor(row.kind) }" />{{ kindLabel(row.kind) }}
          </span>
          <span v-if="row.note">{{ row.note }}</span>
          <span>{{ $t('ledger.accounts.colUpdatedAt') }}:{{ formatDateTime(row.balanceUpdatedAt) }}</span>
        </div>

        <div class="card-actions">
          <el-button link type="primary" @click="openBalanceDialog(row)">
            {{ $t('ledger.accounts.editBalance') }}
          </el-button>
          <el-button link type="primary" @click="openEditDialog(row)">{{ $t('common.edit') }}</el-button>
          <el-button link type="danger" @click="handleDelete(row)">{{ $t('common.delete') }}</el-button>
        </div>
      </div>
    </div>

    <el-table v-else :data="accounts" :row-class-name="rowClassName">
      <el-table-column :label="$t('ledger.accounts.colName')" min-width="160">
        <template #default="{ row }">
          <span class="account-name">{{ row.name }}</span>
        </template>
      </el-table-column>

      <el-table-column :label="$t('ledger.accounts.colKind')" width="130">
        <template #default="{ row }">
          <span class="kind-cell">
            <i class="kind-dot" :style="{ background: kindColor(row.kind) }" />{{ kindLabel(row.kind) }}
          </span>
        </template>
      </el-table-column>

      <el-table-column :label="$t('ledger.accounts.colBalance')" width="150">
        <template #default="{ row }">
          <span class="account-balance" :class="{ 'is-negative': row.balanceCents < 0 }">
            {{ formatCents(row.balanceCents) }}
          </span>
        </template>
      </el-table-column>

      <el-table-column :label="$t('ledger.accounts.colNote')" min-width="140">
        <template #default="{ row }">
          <span class="note-cell">{{ row.note || '—' }}</span>
        </template>
      </el-table-column>

      <el-table-column :label="$t('ledger.accounts.colUpdatedAt')" width="180">
        <template #default="{ row }">{{ formatDateTime(row.balanceUpdatedAt) }}</template>
      </el-table-column>

      <el-table-column :label="$t('ledger.accounts.colEnabled')" width="90">
        <template #default="{ row }">
          <el-switch v-model="row.enabled" @change="handleToggleEnabled(row)" />
        </template>
      </el-table-column>

      <el-table-column :label="$t('common.actions')" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openBalanceDialog(row)">
            {{ $t('ledger.accounts.editBalance') }}
          </el-button>
          <el-button link type="primary" @click="openEditDialog(row)">{{ $t('common.edit') }}</el-button>
          <el-button link type="danger" @click="handleDelete(row)">{{ $t('common.delete') }}</el-button>
        </template>
      </el-table-column>

      <template #empty>
        <el-empty :description="$t('ledger.accounts.empty')" />
      </template>
    </el-table>

    <!-- 新建 / 编辑 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="min(640px, 94vw)" :show-close="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item :label="$t('ledger.accounts.colName')" prop="name">
          <el-input
            v-model="form.name"
            :placeholder="$t('ledger.accounts.namePlaceholder')"
            maxlength="20"
            show-word-limit
            @keyup.enter="handleSubmit"
          />
        </el-form-item>

        <el-form-item :label="$t('ledger.accounts.colKind')" prop="kind">
          <el-select v-model="form.kind" style="width: 100%">
            <el-option v-for="opt in kindOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>

        <el-form-item :label="$t('ledger.accounts.colBalance')" prop="balanceYuan">
          <el-input-number
            v-model="form.balanceYuan"
            class="amount-input"
            :precision="2"
            :controls="false"
            :min="-9999999"
            :max="9999999"
            placeholder="0.00"
            style="width: 100%"
          />
          <div class="field-tip">{{ $t('ledger.accounts.balanceTip') }}</div>
        </el-form-item>

        <el-form-item :label="$t('ledger.accounts.colNote')" prop="note">
          <el-input
            v-model="form.note"
            :placeholder="$t('ledger.accounts.notePlaceholder')"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ $t('common.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- 改余额 -->
    <el-dialog
      v-model="balanceVisible"
      class="balance-dialog"
      :title="$t('ledger.accounts.dialogBalance')"
      width="min(480px, 94vw)"
      :show-close="false"
    >
      <div v-if="balanceTarget" class="balance-body">
        <div class="balance-dialog-name">{{ balanceTarget.name }}</div>
        <div class="balance-dialog-meta">
          {{ $t('ledger.accounts.colUpdatedAt') }}:{{ formatDateTime(balanceTarget.balanceUpdatedAt) }}
        </div>

        <el-input-number
          v-model="balanceYuan"
          class="amount-input"
          :precision="2"
          :controls="false"
          :min="-9999999"
          :max="9999999"
          placeholder="0.00"
          style="width: 100%"
          @keyup.enter="handleBalanceSubmit"
        />
        <div class="field-tip">{{ $t('ledger.accounts.balanceTip') }}</div>
      </div>
      <template #footer>
        <el-button @click="balanceVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="balanceSubmitting" @click="handleBalanceSubmit">
          {{ $t('common.confirm') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.stale-alert {
  margin-bottom: 12px;
}

/* 资金概览:品牌色底 + 白字,三个数各占一列 */
.asset-card {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
  padding: 24px 30px;
  border-radius: 24px;
  background: var(--color-brand-6);
  color: #fff;
}

.asset-label {
  font-size: 13px;
  line-height: 20px;
  color: rgba(255, 255, 255, 0.75);
}

.asset-value {
  margin-top: 8px;
  font-size: 26px;
  font-weight: 600;
  line-height: 34px;
  word-break: break-all;
}

.account-name {
  font-weight: 500;
  color: var(--color-text-1);
}

.account-balance {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
}

.account-balance.is-negative {
  color: var(--el-color-danger);
}

.kind-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-2);
}

.kind-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
}

.note-cell {
  color: var(--color-text-3);
}

.field-tip {
  margin-top: 6px;
  font-size: 12px;
  line-height: 18px;
  color: var(--color-text-3);
}

.balance-dialog-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
}

.balance-dialog-meta {
  margin: 4px 0 14px;
  font-size: 12px;
  color: var(--color-text-3);
}

/* 停用的账户整体淡化:它只是个标记,数据还在 */
.list-card.is-off {
  opacity: 0.55;
}

:deep(.el-table .row-off) {
  opacity: 0.55;
}

@media (max-width: 768px) {
  .asset-card {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 14px 18px;
    border-radius: 18px;
  }

  /* 窄屏改成「标签左、金额右」一行一条,省高度 */
  .asset-item {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  .asset-value {
    margin-top: 0;
    font-size: 18px;
    line-height: 24px;
  }
}
</style>
