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
        <!-- 反思内容:日期+星期整张卡片共用一份(标题下方),每条只展示三栏明细 + 右侧删除/编辑 -->
        <div class="info-card">
          <div class="section-title has-actions">
            <div class="title-block">
              <span class="title-text">{{ $t('reflection.itemsTitle') }}</span>
              <span class="title-desc">{{ formatDayLabel(record.date) }}</span>
            </div>
            <el-button type="primary" size="small" @click="openAdd">
              <ActionIcon name="add" :size="16" />
              {{ $t('reflection.addItem') }}
            </el-button>
          </div>

          <div v-for="(item, index) in items" :key="item.id || index" class="detail-card">
            <!-- 头部只放操作图标(靠右),左边保持干净 -->
            <div class="detail-card__head is-actions-only">
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
              <div class="detail-card__row">
                <span class="detail-card__label">{{ $t('reflection.experience') }}:</span>
                <span class="detail-card__value">{{ item.experience }}</span>
              </div>
              <div class="detail-card__row">
                <span class="detail-card__label">{{ $t('reflection.reason') }}:</span>
                <span class="detail-card__value">{{ item.reason || '-' }}</span>
              </div>
              <div class="detail-card__row">
                <span class="detail-card__label">{{ $t('reflection.measure') }}:</span>
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

/* 头部只有图标,明细行紧跟其后,间距收窄(不用 KYB 的 30px) */
.detail-card .detail-card__body {
  padding-top: 12px;
}
</style>
