<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { deleteReflection, getReflection, updateReflection } from '@/api/reflection'
import ActionIcon from '@/components/ActionIcon.vue'
import BackButton from '@/components/BackButton.vue'
import ReflectionFormDialog, { type ReflectionSubmitPayload } from '@/components/ReflectionFormDialog.vue'
import { formatDayLabel } from '@/utils/datetime'
import type { DailyReflection, ReflectionItem } from '@/types'

/**
 * 反思详情:展示某天的所有反思条目,并在这里继续新增 / 编辑 / 删除单条
 * 新增与编辑复用同一个弹窗(一次只处理一条)
 */
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const detailId = computed(() => Number(route.params.id))
const loading = ref(false)
const submitting = ref(false)
const record = ref<DailyReflection | null>(null)

const dialogVisible = ref(false)
const editingIndex = ref<number | null>(null)
const editingItem = ref<ReflectionItem | null>(null)

const items = computed(() => record.value?.items || [])

async function loadDetail(): Promise<void> {
  loading.value = true
  try {
    record.value = await getReflection(detailId.value)
  } catch {
    // 记录不存在或已删除:回列表(其它错误提示由 axios 拦截器统一处理)
    router.replace({ name: 'reflections' })
  } finally {
    loading.value = false
  }
}

function openAdd(): void {
  editingIndex.value = null
  editingItem.value = null
  dialogVisible.value = true
}

function openEdit(index: number): void {
  editingIndex.value = index
  editingItem.value = items.value[index]
  dialogVisible.value = true
}

// 条目出参:只保留后端认的三个字段
function toPayloadItem(item: ReflectionItem) {
  return { experience: item.experience, reason: item.reason || null, measure: item.measure || null }
}

async function handleSubmit(payload: ReflectionSubmitPayload): Promise<void> {
  const next = items.value.map(toPayloadItem)
  if (editingIndex.value === null) {
    next.push(payload.item)
  } else {
    next[editingIndex.value] = payload.item
  }

  submitting.value = true
  try {
    await updateReflection(detailId.value, { items: next })
    dialogVisible.value = false
    ElMessage.success(editingIndex.value === null ? t('reflection.itemAdded') : t('reflection.itemUpdated'))
    await loadDetail()
  } catch {
    // 错误提示已由 axios 拦截器统一处理
  } finally {
    submitting.value = false
  }
}

// 删除单条:最后一条删掉 = 整天没有内容了,直接删掉整条记录(只确认一次)
async function removeItem(index: number): Promise<void> {
  const isLast = items.value.length === 1
  try {
    await ElMessageBox.confirm(
      isLast ? t('reflection.deleteLastItemConfirm', { date: formatDayLabel(record.value?.date) }) : t('reflection.deleteItemConfirm'),
      t('common.tip'),
      {
        type: 'warning',
        showClose: false,
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel')
      }
    )
  } catch {
    return // 用户取消
  }

  if (isLast) {
    await deleteRecord()
    return
  }

  try {
    const next = items.value.filter((_, itemIndex) => itemIndex !== index).map(toPayloadItem)
    await updateReflection(detailId.value, { items: next })
    ElMessage.success(t('reflection.itemDeleted'))
    await loadDetail()
  } catch {
    // 错误提示已由 axios 拦截器统一处理
  }
}

// 删掉整条记录(上面已经确认过,这里不再弹二次确认)
async function deleteRecord(): Promise<void> {
  try {
    await deleteReflection(detailId.value)
    ElMessage.success(t('reflection.deleted'))
    router.push({ name: 'reflections' })
  } catch {
    // 错误提示已由 axios 拦截器统一处理
  }
}

onMounted(loadDetail)
</script>

<template>
  <div class="detail-page is-full">
    <div class="detail-header">
      <BackButton :fallback="{ name: 'reflections' }" />
      <div class="detail-title">{{ $t('reflection.detailTitle') }}</div>
    </div>

    <div class="detail-container">
      <el-skeleton v-if="loading" :rows="6" animated />

      <template v-else-if="record">
        <!-- 每条反思:三栏明细 + 右上角删除 / 编辑 -->
        <div class="info-card reflection-card">
          <!-- 卡片内的标题行:左边「日期 + 星期」,右边「添加一条」 -->
          <div class="card-action-row">
            <div class="card-action-title">{{ formatDayLabel(record.date) }}</div>
            <el-button type="primary" size="small" @click="openAdd">
              <ActionIcon name="add" :size="16" class="card-action-icon" />
              {{ $t('reflection.addItem') }}
            </el-button>
          </div>

          <div v-for="(item, index) in items" :key="item.id || index" class="detail-card">
            <!-- 头部:左边带底色的序号,右边删除 / 编辑 -->
            <div class="detail-card__head">
              <span class="form-row-index">{{ index + 1 }}</span>
              <div class="detail-card__actions">
                <el-button link type="primary" :title="$t('common.delete')" @click="removeItem(index)">
                  <ActionIcon name="delete" :size="20" />
                </el-button>
                <el-button link type="primary" :title="$t('common.edit')" @click="openEdit(index)">
                  <ActionIcon name="edit" :size="20" />
                </el-button>
              </div>
            </div>

            <div class="detail-card__body">
              <div class="detail-card__field is-primary">
                <span class="detail-card__label">{{ $t('reflection.experience') }}</span>
                <span class="detail-card__value">{{ item.experience }}</span>
              </div>
              <div class="detail-card__field">
                <span class="detail-card__label">{{ $t('reflection.reason') }}</span>
                <span class="detail-card__value">{{ item.reason || '-' }}</span>
              </div>
              <div class="detail-card__field">
                <span class="detail-card__label">{{ $t('reflection.measure') }}</span>
                <span class="detail-card__value">{{ item.measure || '-' }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 新增 / 编辑单条:复用同一个弹窗,日期固定为这天的日期 -->
    <ReflectionFormDialog
      v-model:visible="dialogVisible"
      :date="record?.date"
      :item="editingItem"
      :loading="submitting"
      @submit="handleSubmit"
    />
  </div>
</template>

<style scoped>
/* 灰卡片、明细行、区块标题带操作按钮的样式都在全局 theme.css(.detail-card/.section-title.has-actions) */

/* 两张卡片之间留 20px(和 client KYB 的卡片间距一致) */
.info-card + .info-card {
  margin-top: 20px;
}

/* 卡片内的标题行:左标题、右按钮 */
.card-action-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.card-action-title {
  font-size: 18px;
  font-weight: 500;
  line-height: 26px;
  color: var(--color-text-1);
}

/* 标题行里的「添加一条」:和标题同一行,高度收一下 */
.card-action-row :deep(.el-button) {
  height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
}

/* 图标和文字留点间距(原来靠全局 .section-title.has-actions 那条规则) */
.card-action-icon {
  margin-right: 6px;
}

/* 标题搬到卡片外之后,卡片自己补上顶部留白(原来由 .section-title 撑着) */
.reflection-card {
  padding-top: 30px;
}

@media (max-width: 768px) {
  .reflection-card {
    padding-top: 20px;
  }
}
</style>
