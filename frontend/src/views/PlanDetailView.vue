<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MoreFilled } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { deletePlan, getPlan } from '@/api/plan'
import ActionIcon from '@/components/ActionIcon.vue'
import BackButton from '@/components/BackButton.vue'
import FileIcon from '@/components/FileIcon.vue'
import { useImageExport } from '@/composables/useImageExport'
import { formatDate, formatDuration, formatWeekday } from '@/utils/datetime'
import type { DailyPlan } from '@/types'

/**
 * 日程规划详情(只读):卡片外侧右上角放「编辑 / 删除」
 * - 编辑:进整页表单(plan-edit),删除按钮只在详情页出现
 * - 分区顺序与编辑页一致:日期 → 待办事项 → 计划完成|实际完成 → 随写备注
 */
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const planId = computed(() => Number(route.params.id))
const loading = ref(true)
const plan = ref<DailyPlan | null>(null)
// 导出的通用能力(节点 → PNG → 下载):loading 与成功/失败提示都在 composable 里
const { exporting, exportImage } = useImageExport()
const cardRef = ref<HTMLElement | null>(null)
// 接口 404(不存在或已删除)时不弹错误,直接走空状态
const notFound = ref(false)

// 中间左右两栏:计划完成 / 实际完成,字段名与接口返回一致
const scheduleSections = [
  { field: 'planned', titleKey: 'plan.plannedSection' },
  { field: 'actual', titleKey: 'plan.actualSection' }
] as const

async function loadDetail(): Promise<void> {
  if (!Number.isInteger(planId.value) || planId.value <= 0) {
    notFound.value = true
    loading.value = false
    return
  }

  loading.value = true
  try {
    plan.value = await getPlan(planId.value)
  } catch {
    // 错误提示已由 axios 拦截器统一处理,这里只补一个空状态
    notFound.value = true
  } finally {
    loading.value = false
  }
}

function openEdit(): void {
  // 带上来源:编辑页取消 / 保存后原路回详情页
  router.push({ name: 'plan-edit', params: { id: planId.value }, query: { from: 'detail' } })
}

// 计划 / 实际的事项对应第几条待办(没有匹配就不显示序号)
function todoIndexOf(name?: string): number {
  const target = (name || '').trim()
  if (!target) return 0
  return (plan.value?.todos || []).findIndex((item) => (item.name || '').trim() === target) + 1
}

// 导出这张卡片:标题用页面标题,文件名带日期
function handleExport(): void {
  const data = plan.value
  if (!data) return

  exportImage(cardRef.value, {
    title: t('plan.detailTitle'),
    fileName: t('plan.exportFileName', { date: data.date })
  })
}

// 「更多」菜单:导出图片 / 删除整条记录
function handleMore(command: string): void {
  if (command === 'export') handleExport()
  else if (command === 'delete') handleDelete()
}

async function handleDelete(): Promise<void> {
  try {
    await ElMessageBox.confirm(t('plan.deleteConfirm', { date: formatDate(plan.value?.date) }), t('common.tip'), {
      type: 'warning',
      showClose: false,
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel')
    })
  } catch {
    return // 用户取消
  }

  try {
    await deletePlan(planId.value)
    ElMessage.success(t('plan.deleted'))
    router.push({ name: 'plans' })
  } catch {
    // 错误提示由 axios 拦截器统一处理
  }
}

onMounted(loadDetail)
</script>

<template>
  <div class="detail-page is-full">
    <div class="detail-header">
      <BackButton :fallback="{ name: 'plans' }" />
      <div class="detail-title">{{ $t('plan.detailTitle') }}</div>
    </div>

    <div class="detail-container">
      <el-skeleton v-if="loading" :rows="8" animated />

      <el-empty v-else-if="notFound || !plan" :description="$t('plan.detailNotFound')">
        <el-button type="primary" @click="router.push({ name: 'plans' })">{{ $t('plan.backList') }}</el-button>
      </el-empty>

      <template v-else>
        <!-- 操作行在卡片外侧、靠右:编辑 + 「更多」(导出图片 / 删除整条记录) -->
        <div class="card-action-row">
          <el-button @click="openEdit">{{ $t('common.edit') }}</el-button>

          <el-dropdown trigger="click" placement="bottom-end" @command="handleMore">
            <el-button class="more-btn" :loading="exporting" :aria-label="$t('common.more')">
              <el-icon><MoreFilled /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="export">
                  <FileIcon name="download" :size="16" class="more-menu__icon" />{{ $t('common.export') }}
                </el-dropdown-item>
                <el-dropdown-item command="delete" class="is-danger">
                  <FileIcon name="delete" :size="16" class="more-menu__icon" />{{ $t('common.delete') }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <!-- 「工」字型:上=待办事项,中=计划完成|实际完成(左右对比),下=随写备注 -->
        <div ref="cardRef" class="info-card plan-view">
          <!-- 顶部:日期一行纯文本 —— 日期 + 2026-10-10 + 周六(星期由日期算,后端不存) -->
          <p class="plan-date-line">
            <span class="plan-date-line__label">{{ $t('plan.dateLabel') }}</span>
            <span>{{ plan.date }} {{ formatWeekday(plan.date) }}</span>
          </p>

          <div class="plan-divider" />

          <!-- 上:待办事项 -->
          <section class="plan-section">
            <div class="plan-section__head">
              <h3 class="plan-section__title">{{ $t('plan.todoSection') }}</h3>
            </div>

            <div class="plan-list plan-list--grid">
              <div
                v-for="(item, index) in plan.todos"
                :key="item.id ?? index"
                class="plan-row"
                :class="{ 'is-done': item.completed }"
              >
                <span class="form-row-index">{{ index + 1 }}</span>
                <span class="plan-name">{{ item.name }}</span>
                <ActionIcon v-if="item.completed" name="check" :size="18" class="plan-check" />
              </div>

              <div v-if="!plan.todos.length" class="plan-row plan-empty">{{ $t('plan.emptySection') }}</div>
            </div>
          </section>

          <div class="plan-divider" />

          <!-- 中:计划完成(左) | 实际完成(右),左右对照 -->
          <div class="plan-columns">
            <section v-for="section in scheduleSections" :key="section.field" class="plan-section">
              <div class="plan-section__head">
                <h3 class="plan-section__title">{{ $t(section.titleKey) }}</h3>
              </div>

              <div class="plan-list">
                <div v-for="(item, index) in plan[section.field]" :key="item.id ?? index" class="plan-row">
                  <!-- 小三角一直占位(16px),没点亮就隐藏:同一栏里各行的时间才对得齐 -->
                  <ActionIcon
                    name="caret"
                    :size="16"
                    class="plan-important"
                    :class="{ 'is-hidden': !item.important }"
                  />
                  <span class="plan-range">{{ item.startTime }} - {{ item.endTime }}</span>
                  <!-- 序号胶囊就代表事项本身,所以只显示序号(悬停可看名称) -->
                  <el-tooltip v-if="todoIndexOf(item.name)" :content="item.name" effect="light" placement="top">
                    <span class="form-row-index">{{ todoIndexOf(item.name) }}</span>
                  </el-tooltip>
                  <span class="plan-duration">{{ formatDuration(item.durationMinutes) }}</span>
                </div>

                <div v-if="!plan[section.field].length" class="plan-row plan-empty">{{ $t('plan.emptySection') }}</div>
              </div>
            </section>
          </div>

          <div class="plan-divider" />

          <!-- 下:随写备注(只有一条) -->
          <section class="plan-section">
            <div class="plan-section__head">
              <h3 class="plan-section__title">{{ $t('plan.noteSection') }}</h3>
            </div>

            <div class="plan-list plan-list--note">
              <p v-if="plan.notes.length" class="plan-note">{{ plan.notes[0].name }}</p>
              <p v-else class="plan-empty">{{ $t('plan.emptySection') }}</p>
            </div>
          </section>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* 页面外壳、卡片在全局 theme.css 里(.detail-page/.info-card) */
.plan-view {
  padding-top: 30px;
}

/*
 * 卡片外侧的操作行:靠右,沿用列表卡片的灰色胶囊按钮
 * 不用全局 .card-actions:theme.css 里有两份同名定义(列表卡片 / 详情页),会互相打架
 */
.card-action-row {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 12px;
}

.card-action-row :deep(.el-button) {
  height: 32px;
  padding: 0 14px;
  margin-left: 0;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 400;
  color: var(--color-text-2);
  background: var(--color-bg-bottom);
}

.card-action-row :deep(.el-button:hover) {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

/* 「更多」按钮:只有图标,做成窄一点的胶囊 */
.card-action-row :deep(.el-button.more-btn) {
  padding: 0 10px;
}

/*
 * 小面板(item 高度 / 24 圆角 / 阴影 / 危险色 .is-danger)统一在 theme.css 的
 * .el-dropdown__popper.el-popper 里,这里不用重复;
 * 只有 FileIcon 是自绘 svg,不受全局 .el-icon 的间距规则影响,补一下
 */
.more-menu__icon {
  margin-right: 6px;
}

/* 分组分隔线:3px 实线 + 两头倒圆角(「工」字的两横) */
.plan-divider {
  height: 3px;
  margin: 20px 0;
  border: none;
  border-radius: 999px;
  background: var(--color-border);
}

.plan-section {
  min-width: 0;
}

.plan-section__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.plan-section__title {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  line-height: 22px;
  color: var(--color-text-1);
}

/* 多条数据共用一个灰色背景(和编辑页一致) */
.plan-list {
  padding: 6px 14px;
  border-radius: 16px;
  background: var(--color-bg-bottom);
}

/* 待办事项:一行两条,和编辑页的网格一致;窄屏自动变一列 */
.plan-list--grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

/* 左右两条之间的留白和编辑页一致:两侧各 24px(共 48px) */
.plan-list--grid .plan-row {
  padding: 10px 24px 10px 0;
}

.plan-list--grid .plan-row:nth-child(even) {
  padding: 10px 0 10px 24px;
}

.plan-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  padding: 10px 0;
  font-size: 14px;
  line-height: 24px;
  color: var(--color-text-1);
}

/* 计划 / 实际:序号 + 起止时间 + 事项 + 用时 */
.plan-range {
  flex: 0 0 120px;
  color: var(--color-text-2);
  white-space: nowrap;
}

.plan-name {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.plan-duration {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--color-text-3);
}

/* 已完成的待办:文字加删除线并变灰,右侧打勾 */
.plan-row.is-done .plan-name {
  color: var(--color-text-3);
  text-decoration: line-through;
}

.plan-check {
  flex-shrink: 0;
  color: var(--color-brand-6);
}

/* 计划 / 实际行首的「重要」小三角:点亮橙色,未点亮隐藏但仍占位(保证左对齐) */
.plan-important {
  flex-shrink: 0;
  color: var(--color-warning-6);
}

.plan-important.is-hidden {
  visibility: hidden;
}

/* 日期:一行纯文本,标签淡一点,日期 + 周几跟在后面 */
.plan-date-line {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin: 0;
  font-size: 14px;
  line-height: 22px;
  color: var(--color-text-1);
}

.plan-date-line__label {
  flex-shrink: 0;
  color: var(--color-text-3);
}

.plan-note {
  margin: 0;
  font-size: 14px;
  line-height: 24px;
  color: var(--color-text-1);
  white-space: pre-wrap;
  word-break: break-word;
}

.plan-empty {
  color: var(--color-text-4);
}

/* 中间左右两栏:计划完成 | 实际完成 */
.plan-columns {
  display: grid;
  /* minmax(0, 1fr):否则轨道会被内容顶宽,窄屏会横向溢出 */
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  column-gap: 0;
}

.plan-columns > .plan-section {
  padding: 0 16px;
}

.plan-columns > .plan-section:first-child {
  padding-left: 0;
}

/* 「工」字中间那条竖线:同样 3px 实线 + 圆头,用伪元素画才能圆角 */
.plan-columns > .plan-section:last-child {
  position: relative;
  padding-right: 0;
}

.plan-columns > .plan-section:last-child::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 3px;
  border-radius: 999px;
  background: var(--color-border);
}

/* 随写备注:单条,容器内边距给足 */
.plan-list--note {
  padding: 10px 14px;
}

@media (max-width: 768px) {
  .plan-view {
    padding-top: 18px;
  }

  .plan-divider {
    margin: 14px 0;
  }

  /* 窄屏放不下左右对比,上下堆叠;竖向虚线改成横向虚线 */
  .plan-columns {
    grid-template-columns: minmax(0, 1fr);
    row-gap: 14px;
  }

  .plan-columns > .plan-section {
    padding: 0;
  }

  /* 窄屏:竖线改横线,同样是 3px 圆头 */
  .plan-columns > .plan-section:last-child {
    padding-top: 14px;
  }

  .plan-columns > .plan-section:last-child::before {
    top: 0;
    bottom: auto;
    right: 0;
    width: auto;
    height: 3px;
  }

  /* 窄屏:待办变一列,分隔线改回横向 */
  .plan-list--grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .plan-list--grid .plan-row,
  .plan-list--grid .plan-row:nth-child(even) {
    padding: 10px 0;
  }

  .plan-range {
    flex: 0 0 104px;
  }
}
</style>
