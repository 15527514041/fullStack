<script setup lang="ts">
import { computed, ref } from 'vue'
import { CircleClose } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { useIsMobile } from '@/composables/useIsMobile'
import TimeRingSelect from './TimeRingSelect.vue'

/**
 * 时间范围选择(公共组件):只读输入框 + 弹窗,弹窗里用 24 小时环形选择器
 *
 * v-model 的值是 ['HH:mm', 'HH:mm'];传 null 表示没选(end < start 表示跨零点)
 * 用法:
 *   <TimeRangePicker v-model="range" :placeholder="..." />
 */
const props = withDefaults(
  defineProps<{
    modelValue?: [string, string] | null
    placeholder?: string
    disabled?: boolean
    clearable?: boolean
  }>(),
  { modelValue: null, placeholder: '', disabled: false, clearable: true }
)

const emit = defineEmits<{ (e: 'update:modelValue', value: [string, string] | null): void }>()

const { t } = useI18n()
const { isMobile } = useIsMobile()

const DAY = 1440
/** 还没选过时,弹窗里先给一个常用的默认区间:09:00 - 10:00 */
const DEFAULT_START = 9 * 60
const DEFAULT_END = 10 * 60

function toMinutes(text?: string | null): number | null {
  if (!text || !/^\d{1,2}:\d{2}$/.test(text)) return null
  const [hour, minute] = text.split(':').map(Number)
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

function toText(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

const selected = computed(() => {
  const start = toMinutes(props.modelValue?.[0])
  const end = toMinutes(props.modelValue?.[1])
  return start === null || end === null ? null : { start, end }
})

const displayText = computed(() => (selected.value ? `${toText(selected.value.start)} - ${toText(selected.value.end)}` : ''))

// 弹窗里先改草稿,点「确定」才写回 v-model,取消即作废
const visible = ref(false)
const draftStart = ref(DEFAULT_START)
const draftEnd = ref(DEFAULT_END)

function open(): void {
  if (props.disabled) return

  const current = selected.value ?? { start: DEFAULT_START, end: DEFAULT_END }
  draftStart.value = current.start
  draftEnd.value = current.end
  visible.value = true
}

function confirm(): void {
  emit('update:modelValue', [toText(draftStart.value), toText(draftEnd.value)])
  visible.value = false
}

function clear(): void {
  emit('update:modelValue', null)
}

/** 结束时间小于开始时间 = 跨零点,结束时算「次日」 */
const crossesMidnight = computed(() => draftEnd.value < draftStart.value)

const durationText = computed(() => {
  const total = (((draftEnd.value - draftStart.value) % DAY) + DAY) % DAY
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return [hours ? `${hours}${t('timeRange.hour')}` : '', minutes ? `${minutes}${t('timeRange.minute')}` : '']
    .filter(Boolean)
    .join(' ')
})

// 手机端弹窗别顶破屏幕
const dialogWidth = computed(() => (isMobile.value ? 'calc(100vw - 32px)' : '420px'))
</script>

<template>
  <div class="time-range-picker">
    <el-input
      class="time-range-picker__input"
      :model-value="displayText"
      :placeholder="placeholder"
      :disabled="disabled"
      readonly
      @click="open"
    >
      <template #prefix>
        <svg class="time-range-picker__clock" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.2V12l3.2 2" />
        </svg>
      </template>
      <template #suffix>
        <!-- 用和 el-select 同一个清除图标(CircleClose),尺寸才一致 -->
        <el-icon
          v-if="clearable && displayText && !disabled"
          class="time-range-picker__clear"
          @click.stop="clear"
        >
          <CircleClose />
        </el-icon>
      </template>
    </el-input>

    <el-dialog v-model="visible" :title="t('timeRange.title')" :width="dialogWidth" align-center append-to-body>
      <!-- 顶部信息栏:起始 / 结束 -->
      <div class="time-range-picker__cards">
        <div class="time-card">
          <div class="time-card__label">{{ t('timeRange.start') }}</div>
          <div class="time-card__value">{{ toText(draftStart) }}</div>
          <div class="time-card__hint">{{ t('timeRange.sameDay') }}</div>
        </div>

        <div class="time-card">
          <div class="time-card__label">{{ t('timeRange.end') }}</div>
          <div class="time-card__value">{{ toText(draftEnd) }}</div>
          <div class="time-card__hint">{{ crossesMidnight ? t('timeRange.nextDay') : t('timeRange.sameDay') }}</div>
        </div>
      </div>

      <!-- 中心:24 小时双层环形 -->
      <TimeRingSelect
        class="time-range-picker__ring"
        :start="draftStart"
        :end="draftEnd"
        @update:start="draftStart = $event"
        @update:end="draftEnd = $event"
      />

      <!-- 底部:总时长 -->
      <div class="time-range-picker__total">
        <div class="time-range-picker__total-label">{{ t('timeRange.total') }}</div>
        <div class="time-range-picker__total-value">{{ durationText }}</div>
      </div>

      <template #footer>
        <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="confirm">{{ t('common.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.time-range-picker__input {
  cursor: pointer;
}

.time-range-picker__input :deep(.el-input__inner) {
  cursor: pointer;
}

/* 左侧小时钟图标:和 el-input 的前置图标同尺寸(theme.css 里 .el-input__icon = 20px) */
.time-range-picker__clock {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  color: var(--color-text-3);
}

/* 清除按钮:尺寸和 el-select / el-input 的清除图标一致(都是 20px) */
.time-range-picker__clear {
  font-size: 20px;
  color: var(--color-text-3);
  cursor: pointer;
}

.time-range-picker__clear:hover {
  color: var(--color-text-1);
}

/* 顶部两张信息卡 */
.time-range-picker__cards {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  /* 和弹窗标题拉开一点距离 */
  margin-top: 12px;
}

.time-card {
  padding: 12px 16px;
  border-radius: 16px;
  background: var(--color-bg-bottom);
  /* 卡片里的标签 / 时间 / 辅助文字统一居中 */
  text-align: center;
}

.time-card__label {
  font-size: 12px;
  line-height: 18px;
  color: var(--color-text-3);
}

.time-card__value {
  margin-top: 2px;
  font-size: 24px;
  font-weight: 600;
  line-height: 32px;
  color: var(--color-text-1);
  /* 等宽数字:拖动时数字跳动不会带着整行抖 */
  font-variant-numeric: tabular-nums;
}

.time-card__hint {
  font-size: 12px;
  line-height: 18px;
  color: var(--color-text-4);
}

/* 环形选择器 */
.time-range-picker__ring {
  margin: 18px 0 6px;
}

/* 底部总时长 */
.time-range-picker__total {
  text-align: center;
}

.time-range-picker__total-label {
  font-size: 12px;
  line-height: 18px;
  color: var(--color-text-3);
}

.time-range-picker__total-value {
  font-size: 26px;
  font-weight: 700;
  line-height: 34px;
  color: var(--color-text-1);
  font-variant-numeric: tabular-nums;
}
</style>
