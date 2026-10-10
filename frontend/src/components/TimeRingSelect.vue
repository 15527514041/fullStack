<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * 24 小时环形时间区选择(纯选择器,外层输入框 / 弹窗在 TimeRangePicker 里)
 *
 * - 内层:24 小时表盘,0 点在正上方、顺时针走;每 2 小时一个数字,0 点位月亮、12 点位太阳
 * - 外层:白色弧形滑轨 + 细密短刻度,两端滑块可拖拽,高亮弧段代表选中的区间
 * - 起止用「当天第几分钟」表示(0~1439);end < start 表示跨零点(如 23:00~06:00)
 */
const props = defineProps<{ start: number; end: number }>()
const emit = defineEmits<{
  (e: 'update:start', value: number): void
  (e: 'update:end', value: number): void
}>()

const SIZE = 300
const CENTER = SIZE / 2
const DAY = 1440
const SNAP = 5 // 拖拽吸附到 5 分钟,比逐分钟好点

// 内环(表盘)和外环(滑轨)之间只留 6,别在中间空出一大圈白
const DIAL_RADIUS = 108
const DIAL_TICK_INNER = 102
// 数字尽量贴着刻度,日月再贴着数字:三圈重心靠外,中间留白不显得空
const LABEL_RADIUS = 90
const ICON_RADIUS = 66
const RING_RADIUS = 127
const RING_WIDTH = 26

const svgRef = ref<SVGSVGElement | null>(null)
const dragging = ref<'start' | 'end' | null>(null)

/** 分钟 → 极坐标:0 点在正上方,顺时针 */
function polar(radius: number, minutes: number): { x: number; y: number } {
  const angle = (minutes / DAY) * Math.PI * 2 - Math.PI / 2
  return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) }
}

function toText(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

// 表盘小时刻度(24 根)
const dialTicks = computed(() =>
  Array.from({ length: 24 }, (_, hour) => {
    const minutes = hour * 60
    const from = polar(DIAL_TICK_INNER, minutes)
    const to = polar(DIAL_RADIUS, minutes)
    return { key: minutes, x1: from.x, y1: from.y, x2: to.x, y2: to.y }
  })
)

// 表盘数字:0,2,4…22
const labels = computed(() =>
  Array.from({ length: 12 }, (_, index) => {
    const minutes = index * 120
    const point = polar(LABEL_RADIUS, minutes)
    return { key: minutes, x: point.x, y: point.y, text: String(index * 2) }
  })
)

// 滑轨细刻度:每 30 分钟一根,整点那根长一点(只靠长短区分,颜色统一,免得看着乱)
const ringTicks = computed(() =>
  Array.from({ length: 48 }, (_, index) => {
    const minutes = index * 30
    const long = minutes % 60 === 0
    const half = long ? 8 : 4.5
    const from = polar(RING_RADIUS - half, minutes)
    const to = polar(RING_RADIUS + half, minutes)
    return { key: minutes, long, x1: from.x, y1: from.y, x2: to.x, y2: to.y }
  })
)

/** 选中区间的长度(分钟),跨零点时自动加一天 */
const duration = computed(() => (((props.end - props.start) % DAY) + DAY) % DAY)

/** 高亮弧:顺时针从 start 画到 end */
const arcPath = computed(() => {
  const span = duration.value
  if (!span || span >= DAY) return ''

  const from = polar(RING_RADIUS, props.start)
  const to = polar(RING_RADIUS, props.end)
  return `M ${from.x} ${from.y} A ${RING_RADIUS} ${RING_RADIUS} 0 ${span > DAY / 2 ? 1 : 0} 1 ${to.x} ${to.y}`
})

const startPoint = computed(() => polar(RING_RADIUS, props.start))
const endPoint = computed(() => polar(RING_RADIUS, props.end))

/** 指针位置 → 分钟(吸附到 5 分钟) */
function minutesAt(clientX: number, clientY: number): number {
  const svg = svgRef.value
  if (!svg) return 0

  const rect = svg.getBoundingClientRect()
  const scale = SIZE / rect.width
  const x = (clientX - rect.left) * scale - CENTER
  const y = (clientY - rect.top) * scale - CENTER

  // atan2 以 3 点方向为 0,+90° 转到「正上方为 0」
  let degrees = (Math.atan2(y, x) * 180) / Math.PI + 90
  degrees = ((degrees % 360) + 360) % 360

  return (Math.round(((degrees / 360) * DAY) / SNAP) * SNAP) % DAY
}

function applyPointer(event: PointerEvent): void {
  const minutes = minutesAt(event.clientX, event.clientY)

  if (dragging.value === 'start') {
    // 起止不能重合
    if (minutes !== props.end) emit('update:start', minutes)
  } else if (dragging.value === 'end') {
    if (minutes !== props.start) emit('update:end', minutes)
  }
}

function handleDown(which: 'start' | 'end', event: PointerEvent): void {
  const target = event.currentTarget as SVGCircleElement
  // 捕获指针:手指 / 鼠标拖出圆环也能继续跟手
  target.setPointerCapture(event.pointerId)
  dragging.value = which
  applyPointer(event)
}

function handleMove(event: PointerEvent): void {
  if (dragging.value) applyPointer(event)
}

function handleUp(event: PointerEvent): void {
  const target = event.currentTarget as SVGCircleElement
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
  dragging.value = null
}

// 键盘也能调:左右方向键 ±5 分钟,按住 Shift ±15 分钟
function handleKeydown(which: 'start' | 'end', event: KeyboardEvent): void {
  const step = event.shiftKey ? 15 : 5
  const delta = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? step : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -step : 0
  if (!delta) return

  event.preventDefault()
  const current = which === 'start' ? props.start : props.end
  const other = which === 'start' ? props.end : props.start
  const next = (current + delta + DAY) % DAY
  if (next === other) return

  if (which === 'start') emit('update:start', next)
  else emit('update:end', next)
}
</script>

<template>
  <svg
    ref="svgRef"
    class="time-ring"
    :viewBox="`0 0 ${SIZE} ${SIZE}`"
    role="group"
    aria-label="time range"
  >
    <!-- 内层:24 小时表盘 -->
    <circle class="time-ring__dial" :cx="CENTER" :cy="CENTER" :r="DIAL_RADIUS" />
    <line
      v-for="tick in dialTicks"
      :key="tick.key"
      class="time-ring__dial-tick"
      :x1="tick.x1"
      :y1="tick.y1"
      :x2="tick.x2"
      :y2="tick.y2"
    />
    <text
      v-for="label in labels"
      :key="label.key"
      class="time-ring__dial-label"
      :x="label.x"
      :y="label.y"
    >
      {{ label.text }}
    </text>

    <!-- 0 点月亮 / 12 点太阳:只做方向装饰,颜色和大小都压到最低 -->
    <g class="time-ring__icon is-moon" :transform="`translate(${CENTER} ${CENTER - ICON_RADIUS}) scale(0.85) translate(-12 -12)`">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </g>
    <g class="time-ring__icon is-sun" :transform="`translate(${CENTER} ${CENTER + ICON_RADIUS}) scale(0.85) translate(-12 -12)`">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </g>

    <!-- 外层:一条带底色的滑轨(只画这一圈,不再叠描边,免得看着全是环) -->
    <circle class="time-ring__track" :cx="CENTER" :cy="CENTER" :r="RING_RADIUS" :stroke-width="RING_WIDTH" />
    <line
      v-for="tick in ringTicks"
      :key="tick.key"
      class="time-ring__tick"
      :class="{ 'is-long': tick.long }"
      :x1="tick.x1"
      :y1="tick.y1"
      :x2="tick.x2"
      :y2="tick.y2"
    />
    <path v-if="arcPath" class="time-ring__range" :d="arcPath" />

    <!-- 两端滑块:handle 只负责画,hit 负责交互(命中区更大) -->
    <circle class="time-ring__handle" :cx="startPoint.x" :cy="startPoint.y" r="10" />
    <circle
      class="time-ring__hit"
      :cx="startPoint.x"
      :cy="startPoint.y"
      r="18"
      tabindex="0"
      role="slider"
      aria-label="start time"
      :aria-valuenow="props.start"
      :aria-valuetext="toText(props.start)"
      aria-valuemin="0"
      aria-valuemax="1435"
      @pointerdown="handleDown('start', $event)"
      @pointermove="handleMove"
      @pointerup="handleUp"
      @pointercancel="handleUp"
      @keydown="handleKeydown('start', $event)"
    />

    <circle class="time-ring__handle" :cx="endPoint.x" :cy="endPoint.y" r="10" />
    <circle
      class="time-ring__hit"
      :cx="endPoint.x"
      :cy="endPoint.y"
      r="18"
      tabindex="0"
      role="slider"
      aria-label="end time"
      :aria-valuenow="props.end"
      :aria-valuetext="toText(props.end)"
      aria-valuemin="0"
      aria-valuemax="1435"
      @pointerdown="handleDown('end', $event)"
      @pointermove="handleMove"
      @pointerup="handleUp"
      @pointercancel="handleUp"
      @keydown="handleKeydown('end', $event)"
    />
  </svg>
</template>

<style scoped>
.time-ring {
  display: block;
  width: 100%;
  max-width: 300px;
  height: auto;
  margin: 0 auto;
  /* 拖拽时不要触发页面滚动 / 缩放 */
  touch-action: none;
  user-select: none;
}

/* 表盘:纯白底 + 浅灰小刻度,数字在刻度内侧 */
.time-ring__dial {
  fill: #fff;
  stroke: var(--color-border);
  stroke-width: 1;
}

.time-ring__dial-tick {
  stroke: var(--color-text-4);
  stroke-width: 1;
}

.time-ring__dial-label {
  fill: var(--color-text-2);
  font-size: 12px;
  text-anchor: middle;
  dominant-baseline: central;
}

.time-ring__icon {
  fill: none;
  /* 日月只做装饰:用最浅的灰,不抢视觉焦点 */
  stroke: var(--color-text-4);
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* 滑轨带:淡主色底(和列表里的胶囊同色),整圈都是「可拖区域」 */
.time-ring__track {
  fill: none;
  stroke: var(--color-brand-1);
}

.time-ring__tick {
  stroke: var(--color-sub-2);
  stroke-width: 1;
}

.time-ring__tick.is-long {
  stroke-width: 1;
}

/* 选中的时间范围:圆头高亮弧 */
.time-ring__range {
  fill: none;
  stroke: var(--color-brand-3);
  stroke-width: 22;
  stroke-linecap: round;
}

/* 滑块:白心 + 主色描边;hover / 聚焦时略微放大 */
.time-ring__handle {
  fill: #fff;
  stroke: var(--color-brand-6);
  stroke-width: 2.5;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.16));
}

.time-ring__hit {
  fill: transparent;
  cursor: grab;
}

.time-ring__hit:active {
  cursor: grabbing;
}

.time-ring__hit:focus {
  outline: none;
}

.time-ring__hit:focus-visible {
  stroke: var(--el-color-primary);
  stroke-width: 2;
}
</style>
