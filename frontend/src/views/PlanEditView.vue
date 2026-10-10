<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { ElMessage } from 'element-plus'
import { CopyDocument } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { createPlan, getPlan, updatePlan } from '@/api/plan'
import ActionIcon from '@/components/ActionIcon.vue'
import BackButton from '@/components/BackButton.vue'
import TimeRangePicker from '@/components/TimeRangePicker.vue'
import { formatWeekdayLong, toDateString } from '@/utils/datetime'
import type { PlanPayload } from '@/types'

/**
 * 日程规划的新增 / 编辑(整页表单,无菜单栏)
 * 一份记录 = 某天 + 四类列表:待办事项 / 计划完成 / 实际完成 / 随写备注
 * 计划与实际每行是「起止时间 + 事项」,用时由后端按起止时间算,这里只读展示
 * 删除整条记录的操作只在详情页提供,这里不出现
 */
interface PlanFormRow {
  name: string
  startTime: string
  endTime: string
  /** 待办专用:勾上表示完成 */
  completed: boolean
  /** 计划 / 实际专用:点亮小三角表示比较重要 */
  important: boolean
}

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const editingId = computed(() => (route.params.id ? Number(route.params.id) : null))
const isNew = computed(() => editingId.value === null)
const pageTitle = computed(() => (isNew.value ? t('plan.addTitle') : t('plan.editTitle')))
const weekdayText = computed(() => formatWeekdayLong(form.date))

// 从详情页的「编辑」进来会带上 from=detail:取消 / 保存后回详情页,而不是一路回列表
const fromDetail = computed(() => route.query.from === 'detail')
const backTarget = computed<RouteLocationRaw>(() =>
  isNew.value ? { name: 'plans' } : { name: 'plan-detail', params: { id: editingId.value as number } }
)

const loading = ref(false)
const submitting = ref(false)

const form = reactive<{
  date: string
  todos: PlanFormRow[]
  planned: PlanFormRow[]
  actual: PlanFormRow[]
  notes: PlanFormRow[]
}>({
  date: toDateString(new Date()),
  todos: [emptyRow()],
  planned: [emptyRow()],
  actual: [emptyRow()],
  notes: [emptyRow()]
})

function emptyRow(): PlanFormRow {
  return { name: '', startTime: '', endTime: '', completed: false, important: false }
}

// 打勾前必须已经有内容:空行直接给提示,不让勾上(否则保存时才发现更绕)
function toggleCompleted(row: PlanFormRow, index: number): void {
  if (!row.completed && !row.name.trim()) {
    ElMessage.warning(t('plan.nameRequired', { label: t('plan.todoSection'), index: index + 1 }))
    return
  }
  row.completed = !row.completed
}

// 点小三角:点亮 = 这件事比较重要(同样要求先填内容)
function toggleImportant(row: PlanFormRow, index: number, labelKey: string): void {
  if (!row.important && !row.name.trim()) {
    ElMessage.warning(t('plan.nameRequired', { label: t(labelKey), index: index + 1 }))
    return
  }
  row.important = !row.important
}

// 随写备注只保留一条:界面上不提供增删,提交时仍是 list 结构
const noteText = computed({
  get: () => form.notes[0]?.name || '',
  set: (value: string) => {
    if (!form.notes.length) form.notes.push(emptyRow())
    form.notes[0].name = value
  }
})

// 计划 / 实际的事项从「待办事项」里选:选项带序号(空待办不进下拉)
const todoOptions = computed(() =>
  form.todos
    .map((row, index) => ({ index: index + 1, value: (row.name || '').trim() }))
    .filter((option) => option.value)
)

// 行首序号徽标:选中的事项对应第几条待办(没有匹配就不显示)
function todoIndexOf(name?: string): number {
  const target = (name || '').trim()
  if (!target) return 0
  return form.todos.findIndex((row) => (row.name || '').trim() === target) + 1
}

// 中间左右两栏:计划完成 / 实际完成,用同一套模板渲染,方便左右对比
const scheduleSections = [
  { field: 'planned', titleKey: 'plan.plannedSection', addKey: 'plan.addPlanned' },
  { field: 'actual', titleKey: 'plan.actualSection', addKey: 'plan.addActual' }
] as const

function addRow(list: PlanFormRow[]): void {
  list.push(emptyRow())
}

function removeRow(list: PlanFormRow[], index: number): void {
  const [removed] = list.splice(index, 1)
  // 删的是待办:计划 / 实际里选了这条待办的明细一起清空,免得留下指向不存在待办的事项
  if (list === form.todos && removed) clearScheduleByName(removed.name)
  if (!list.length) addRow(list)
}

function clearScheduleByName(name: string): void {
  const target = (name || '').trim()
  if (!target) return

  for (const section of scheduleSections) {
    form[section.field].forEach((row) => {
      if ((row.name || '').trim() === target) {
        row.name = ''
        // 事项都没了,「重要」标记也跟着清掉
        row.important = false
      }
    })
  }
}

// 行尾「+」:在这一行后面插入一条(右上角不再有添加按钮)
function insertRow(list: PlanFormRow[], index: number): void {
  list.splice(index + 1, 0, emptyRow())
}

// 起止时间用一个范围选择器一次性选出来,这里在数组和行字段之间做转换
function timeRange(row: PlanFormRow): [string, string] {
  return [row.startTime, row.endTime]
}

function setTimeRange(row: PlanFormRow, value: [string, string] | null): void {
  row.startTime = value?.[0] || ''
  row.endTime = value?.[1] || ''
}

// 丢掉完全空白的行(整行没填)
function cleanRows(rows: PlanFormRow[]): PlanFormRow[] {
  return rows
    .map((row) => ({ ...row, name: row.name.trim() }))
    .filter((row) => row.name || row.startTime || row.endTime)
}

// 待办 / 随写备注:只要名称(待办额外带 completion 状态)
function buildNameList(rows: PlanFormRow[], labelKey: string, withCompleted = false): Array<{ name: string; completed?: boolean }> | null {
  const cleaned = cleanRows(rows)
  const missing = cleaned.findIndex((row) => !row.name)
  if (missing >= 0) {
    ElMessage.warning(t('plan.nameRequired', { label: t(labelKey), index: missing + 1 }))
    return null
  }
  return cleaned.map((row) => (withCompleted ? { name: row.name, completed: row.completed } : { name: row.name }))
}

// 计划完成 / 实际完成:事项 + 起止时间,两个时间都必填且结束要晚于开始
function buildScheduleList(
  rows: PlanFormRow[],
  labelKey: string
): Array<{ name: string; startTime: string; endTime: string; important: boolean }> | null {
  const cleaned = cleanRows(rows)

  for (let index = 0; index < cleaned.length; index += 1) {
    const row = cleaned[index]
    const label = t(labelKey)
    if (!row.name) {
      ElMessage.warning(t('plan.nameRequired', { label, index: index + 1 }))
      return null
    }
    if (!row.startTime || !row.endTime) {
      ElMessage.warning(t('plan.timeRequired', { label, index: index + 1 }))
      return null
    }
    // 允许跨零点(23:00~06:00),所以只要求起止不能相同
    if (row.endTime === row.startTime) {
      ElMessage.warning(t('plan.timeOrder', { label, index: index + 1 }))
      return null
    }
  }

  return cleaned.map((row) => ({
    name: row.name,
    startTime: row.startTime,
    endTime: row.endTime,
    important: row.important
  }))
}

function buildPayload(): PlanPayload | null {
  const todos = buildNameList(form.todos, 'plan.todoSection', true)
  if (!todos) return null
  const notes = buildNameList(form.notes, 'plan.noteSection')
  if (!notes) return null
  const planned = buildScheduleList(form.planned, 'plan.plannedSection')
  if (!planned) return null
  const actual = buildScheduleList(form.actual, 'plan.actualSection')
  if (!actual) return null

  return { date: form.date, todos, planned, actual, notes }
}

// 从计划复制到实际:追加在已有内容后面,不覆盖
function copyPlannedToActual(): void {
  const planned = cleanRows(form.planned)
  if (!planned.length) {
    ElMessage.warning(t('plan.copyEmpty'))
    return
  }

  const existing = cleanRows(form.actual)
  form.actual = [...existing, ...planned.map((row) => ({ ...row }))]
  ElMessage.success(t('plan.copied', { count: planned.length }))
}

async function loadDetail(): Promise<void> {
  if (isNew.value) return

  loading.value = true
  try {
    const detail = await getPlan(editingId.value as number)
    form.date = detail.date
    form.todos = toFormRows(detail.todos)
    form.planned = toFormRows(detail.planned)
    form.actual = toFormRows(detail.actual)
    form.notes = toFormRows(detail.notes)
  } catch {
    router.replace({ name: 'plans' })
  } finally {
    loading.value = false
  }
}

function toFormRows(
  items: Array<{
    name: string
    completed?: boolean
    important?: boolean
    startTime?: string | null
    endTime?: string | null
  }>
): PlanFormRow[] {
  if (!items.length) return [emptyRow()]
  return items.map((item) => ({
    name: item.name,
    startTime: item.startTime || '',
    endTime: item.endTime || '',
    completed: item.completed ?? false,
    important: item.important ?? false
  }))
}

async function handleSubmit(): Promise<void> {
  if (!form.date) {
    ElMessage.warning(t('plan.dateRequired'))
    return
  }

  const payload = buildPayload()
  if (!payload) return

  submitting.value = true
  try {
    if (isNew.value) {
      await createPlan(payload)
      ElMessage.success(t('plan.created'))
    } else {
      await updatePlan(editingId.value as number, payload)
      ElMessage.success(t('plan.updated'))
    }
    goBack()
  } catch {
    // 同一天重复(409)等提示由 axios 拦截器统一处理
  } finally {
    submitting.value = false
  }
}

// 取消 / 保存后去哪:从详情页进来就原路回详情页(详情页会重新拉一次数据),否则回列表
function goBack(): void {
  if (fromDetail.value && window.history.state?.back) {
    router.back()
    return
  }
  router.push(backTarget.value)
}

onMounted(loadDetail)
</script>

<template>
  <div class="detail-page is-full has-actions">
    <div class="detail-header">
      <BackButton :fallback="backTarget" />
      <div class="detail-title">{{ pageTitle }}</div>
    </div>

    <div class="detail-container">
      <el-skeleton v-if="loading" :rows="8" animated />

      <!-- 「工」字型:上=待办事项,中=计划完成|实际完成(左右对比),下=随写备注 -->
      <div v-else class="info-card plan-form">
        <!-- 顶部也是一个 section:标题「日期」,内容一行两项 —— 日期 + 星期(只读,选日期自动回填) -->
        <section class="plan-section plan-date">
          <div class="plan-section__head">
            <h3 class="plan-section__title">
              <span class="required-mark" aria-hidden="true">*</span>{{ $t('plan.dateLabel') }}
            </h3>
          </div>
          <div class="plan-date__row">
            <el-date-picker
              v-model="form.date"
              type="date"
              value-format="YYYY-MM-DD"
              :placeholder="$t('plan.datePlaceholder')"
              style="width: 100%"
            />
            <el-input :model-value="weekdayText" disabled />
          </div>
        </section>

        <!-- 日期与下方内容用实线分隔 -->
        <div class="plan-divider" />

        <!-- 上:待办事项 -->
        <section class="plan-section">
          <div class="plan-section__head">
            <h3 class="plan-section__title">{{ $t('plan.todoSection') }}</h3>
          </div>

          <!-- 多条数据共用这一个灰色背景,一行两条 -->
          <div class="plan-list plan-list--grid">
            <div
              v-for="(row, index) in form.todos"
              :key="`todo-${index}`"
              class="form-row form-row--compact"
              :class="{ 'is-done': row.completed }"
            >
              <span class="form-row-index">{{ index + 1 }}</span>
              <el-input v-model="row.name" :placeholder="$t('plan.todoPlaceholder')" maxlength="100" />
              <span class="row-actions">
                <el-tooltip
                  :content="row.completed ? $t('plan.markUndone') : $t('plan.markDone')"
                  placement="top"
                >
                  <el-button
                    class="row-check"
                    link
                    :aria-label="row.completed ? $t('plan.markUndone') : $t('plan.markDone')"
                    @click="toggleCompleted(row, index)"
                  >
                    <ActionIcon name="check" :size="18" />
                  </el-button>
                </el-tooltip>
                <el-tooltip :content="$t('common.insert')" placement="top">
                  <el-button class="row-insert" link :aria-label="$t('common.insert')" @click="insertRow(form.todos, index)">
                    <ActionIcon name="add" :size="18" />
                  </el-button>
                </el-tooltip>
                <el-tooltip :content="$t('common.delete')" placement="top">
                  <el-button class="row-delete" link :aria-label="$t('common.delete')" @click="removeRow(form.todos, index)">
                    <ActionIcon name="delete" :size="18" />
                  </el-button>
                </el-tooltip>
              </span>
            </div>
          </div>
        </section>

        <div class="plan-divider" />

        <!-- 中:计划完成(左) | 实际完成(右),左右对照 -->
        <div class="plan-columns">
          <section v-for="section in scheduleSections" :key="section.field" class="plan-section">
            <div class="plan-section__head">
              <h3 class="plan-section__title">{{ $t(section.titleKey) }}</h3>
              <div class="plan-section__actions">
                <el-button v-if="section.field === 'actual'" link type="primary" @click="copyPlannedToActual">
                  <el-icon><CopyDocument /></el-icon>
                  {{ $t('plan.copyFromPlanned') }}
                </el-button>
              </div>
            </div>

            <!-- 一行:重要小三角 + 起止时间范围 + 事项 + 行尾操作(插入/删除),多条共用灰色背景 -->
            <div class="plan-list">
              <div
                v-for="(row, index) in form[section.field]"
                :key="`${section.field}-${index}`"
                class="form-row form-row--compact"
              >
                <el-tooltip
                  :content="row.important ? $t('plan.markUnimportant') : $t('plan.markImportant')"
                  placement="top"
                >
                  <el-button
                    class="row-important"
                    link
                    :class="{ 'is-on': row.important }"
                    :aria-label="row.important ? $t('plan.markUnimportant') : $t('plan.markImportant')"
                    @click="toggleImportant(row, index, section.titleKey)"
                  >
                    <ActionIcon name="caret" :size="16" />
                  </el-button>
                </el-tooltip>
                <TimeRangePicker
                  class="plan-range"
                  :model-value="timeRange(row)"
                  :placeholder="$t('timeRange.placeholder')"
                  @update:model-value="setTimeRange(row, $event)"
                />
                <!-- 事项:下拉的选项就是上面的待办事项;选中后框里只显示它的序号(带底色) -->
                <el-select
                  v-model="row.name"
                  class="plan-name"
                  :placeholder="$t('plan.itemFromTodo')"
                  :value-on-clear="''"
                  filterable
                  clearable
                >
                  <template #label="{ value }">
                    <span v-if="todoIndexOf(value)" class="form-row-index">{{ todoIndexOf(value) }}</span>
                  </template>
                  <el-option
                    v-for="option in todoOptions"
                    :key="option.value"
                    :value="option.value"
                    :label="option.value"
                  >
                    <span class="todo-option">
                      <span class="form-row-index">{{ option.index }}</span>
                      <span class="todo-option__name">{{ option.value }}</span>
                    </span>
                  </el-option>
                </el-select>
                <span class="row-actions">
                  <el-tooltip :content="$t('common.insert')" placement="top">
                    <el-button
                      class="row-insert"
                      link
                      :aria-label="$t('common.insert')"
                      @click="insertRow(form[section.field], index)"
                    >
                      <ActionIcon name="add" :size="18" />
                    </el-button>
                  </el-tooltip>
                  <el-tooltip :content="$t('common.delete')" placement="top">
                    <el-button
                      class="row-delete"
                      link
                      :aria-label="$t('common.delete')"
                      @click="removeRow(form[section.field], index)"
                    >
                      <ActionIcon name="delete" :size="18" />
                    </el-button>
                  </el-tooltip>
                </span>
              </div>
            </div>
          </section>
        </div>

        <div class="plan-divider" />

        <!-- 下:随写备注 -->
        <section class="plan-section">
          <div class="plan-section__head">
            <h3 class="plan-section__title">{{ $t('plan.noteSection') }}</h3>
          </div>

          <!-- 备注只有一条:不提供增删,提交时仍是 list 结构 -->
          <div class="plan-list plan-list--note">
            <el-input
              v-model="noteText"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 8 }"
              maxlength="500"
              :placeholder="$t('plan.notePlaceholder')"
            />
          </div>
        </section>
      </div>
    </div>

    <div class="detail-actions">
      <el-button @click="goBack">{{ $t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ $t('common.save') }}</el-button>
    </div>
  </div>
</template>

<style scoped>
/* 整张卡片:日期 → 虚线 → 待办 → 虚线 → 计划|实际 → 虚线 → 随写 */
.plan-form {
  display: flex;
  flex-direction: column;
  /* 卡片本身没有上内边距,这里给整块内容补上 */
  padding-top: 30px;
}

/* 顶部 section 的内容行:日期(宽) + 星期(只读,窄) */
.plan-date__row {
  display: grid;
  /* 日期和星期各占 1/4,从左往右排 */
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

/* 分组分隔线:3px 实线 + 两头倒圆角(「工」字的两横) */
.plan-divider {
  height: 3px;
  margin: 20px 0;
  border: none;
  border-radius: 999px;
  background: var(--color-border);
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

/* 必填项的红星:和 el-form-item 的必填标记一致(在标签前面) */
.required-mark {
  margin-right: 4px;
  color: var(--el-color-danger);
}

/* 下拉里的选项:序号胶囊 + 名称 */
.todo-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.todo-option__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plan-section__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.plan-section__head .el-button {
  height: 30px;
  padding: 0 14px;
  border-radius: 8px;
  font-weight: 500;
}

.plan-section__actions .el-button.is-link {
  padding: 0;
}

.plan-section__head .el-button .action-icon {
  margin-right: 6px;
}

/* 中间左右两栏:计划完成 | 实际完成,方便左右对照 */
.plan-columns {
  display: grid;
  /* 用 minmax(0, 1fr):否则轨道会被内容(时间选择器)的 min-content 顶宽,窄屏会横向溢出 */
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  /* 两栏之间用一条竖向虚线分隔,所以左右各留 16px 内边距代替 gap */
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

.plan-section {
  min-width: 0;
}

/* 多条数据共用一个灰色背景(不再是每行一张小卡片) */
.plan-list {
  padding: 6px 14px;
  border-radius: 16px;
  background: var(--color-bg-bottom);
}

/* 待办事项:一行两条,中间用竖向虚线分隔(和「计划|实际」两栏一致) */
.plan-list--grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

/*
 * 容器内部不再画任何分隔线(行与行靠内边距分开)
 * 选择器要写成 .form-row.form-row--compact:下面基础行样式同样是两个类,
 * 写成一个类的 .plan-list--grid .form-row--compact 会因为同权重被后面的 padding: 10px 0 覆盖
 */
.plan-list--grid .form-row.form-row--compact {
  /* 左右两条之间的留白:两侧各 24px(共 48px),原来只有 16px 太挤 */
  padding: 10px 24px 10px 0;
  border: none;
}

.plan-list--grid .form-row.form-row--compact:nth-child(even) {
  padding: 10px 0 10px 24px;
}

/* 每一行都是紧凑的单行:序号(最左) + 内容 + 删除(最右) */
.form-row.form-row--compact {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  margin-bottom: 0;
  border: none;
  border-radius: 0;
  background: transparent;
}

/*
 * 注意:el-input / el-textarea / 时间范围选择器(TimeRangePicker)的根节点
 * 是子组件渲染出来的,不一定带得上本组件的 scoped 属性,所以这类跨组件选择器必须用 :deep()
 */
.form-row--compact :deep(.el-input),
.form-row--compact :deep(.el-textarea),
.form-row--compact :deep(.el-select) {
  flex: 1;
  min-width: 0;
}

/* 时间范围选择器和事项下拉等宽:两者都 flex:1,平分行内剩余空间 */
.form-row--compact :deep(.plan-range) {
  /* min-width:0 必须加:否则会被内容的 min-content 顶宽,同行其它控件就没空间了 */
  flex: 1;
  min-width: 0;
}

/* 行尾操作:插入(+) + 删除 */
.form-row--compact :deep(.row-actions) {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
}

/* Element Plus 默认给相邻按钮加 12px 左边距,这里去掉,间距只由上面的 gap 控制 */
.form-row--compact :deep(.row-actions .el-button + .el-button) {
  margin-left: 0;
}

.form-row--compact :deep(.row-insert),
.form-row--compact :deep(.row-delete),
.form-row--compact :deep(.row-check),
.form-row--compact :deep(.row-important) {
  padding: 0;
  color: var(--color-text-3);
}

/* 计划 / 实际每行行首的「重要」小三角:未点亮浅灰,点亮橙色 */
.form-row--compact :deep(.row-important) {
  color: var(--color-text-4);
}

.form-row--compact :deep(.row-important.is-on),
.form-row--compact :deep(.row-important:hover) {
  color: var(--color-warning-6);
}

.form-row--compact :deep(.row-check) {
  /* 未完成:浅灰圆圈 */
  color: var(--color-text-4);
}

.form-row--compact :deep(.row-check:hover) {
  color: var(--color-brand-6);
}

.form-row--compact.is-done :deep(.row-check) {
  /* 已完成:绿色圆圈打勾 */
  color: var(--color-brand-6);
}

/* 已完成的待办:文字加删除线并变灰 */
.form-row--compact.is-done :deep(.el-input__inner) {
  color: var(--color-text-3);
  text-decoration: line-through;
}

.form-row--compact :deep(.row-insert:hover) {
  color: var(--color-brand-6);
}

.form-row--compact :deep(.row-delete:hover) {
  color: var(--el-color-danger);
}

/* 备注:单条,容器内边距给足 */
.plan-list--note {
  padding: 10px 14px;
}

@media (max-width: 768px) {
  .plan-form {
    padding-top: 18px;
  }

  .plan-date__row {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
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

  /* 窄屏:手柄和删除在第一行,内容独占第二行 */
  .form-row.form-row--compact {
    flex-wrap: wrap;
  }

  .form-row--compact :deep(.row-actions) {
    order: 2;
    margin-left: auto;
  }

  .form-row--compact :deep(.plan-range) {
    order: 3;
    flex: 1 1 100%;
    width: 100%;
  }

  .form-row--compact :deep(.el-input),
  .form-row--compact :deep(.el-textarea),
  .form-row--compact :deep(.el-select) {
    order: 4;
    flex: 1 1 100%;
  }

  /* 窄屏:待办变一列,分隔线改回横向 */
  .plan-list--grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .plan-list--grid .form-row.form-row--compact,
  .plan-list--grid .form-row.form-row--compact:nth-child(even) {
    padding: 10px 0;
  }
}
</style>
