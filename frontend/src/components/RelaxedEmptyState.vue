<script setup lang="ts">
withDefaults(
  defineProps<{
    description?: string
    compact?: boolean
  }>(),
  {
    description: '',
    compact: false
  }
)
</script>

<template>
  <div class="relaxed-empty-state" :class="{ 'is-compact': compact }">
    <svg
      class="relaxed-empty-state__art"
      viewBox="0 0 180 104"
      fill="none"
      aria-hidden="true"
    >
      <ellipse class="empty-shadow" cx="90" cy="91" rx="57" ry="7" />
      <circle class="empty-sun" cx="126" cy="31" r="12" />
      <path class="empty-hill-back" d="M19 76c17-16 33-22 49-18 14 4 23 12 38 13 19 1 34-10 55-20v36H19V76Z" />
      <path class="empty-hill-front" d="M19 82c21-12 38-14 53-8 18 7 29 11 48 8 16-2 28-7 41-13v18H19V82Z" />
      <path
        class="empty-plant"
        d="M57 77V55m0 9c-8-4-14-9-15-17 9 0 14 5 15 12Zm0-3c7-5 12-11 12-19-8 1-12 7-12 14Z"
      />
      <path class="empty-bird" d="M91 36c4-4 7-4 10 0 3-4 7-4 10 0" />
      <path class="empty-spark" d="M38 32v7M34.5 35.5h7M145 59v5M142.5 61.5h5" />
    </svg>
    <div v-if="description" class="relaxed-empty-state__description">
      {{ description }}
    </div>
    <slot />
  </div>
</template>

<style scoped>
.relaxed-empty-state {
  display: flex;
  min-height: 260px;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  padding: 28px 16px;
  text-align: center;
}

.relaxed-empty-state.is-compact {
  min-height: 180px;
  padding: 18px 12px;
}

.relaxed-empty-state__art {
  display: block;
  width: 172px;
  max-width: 72%;
  height: auto;
  margin-bottom: 13px;
  overflow: visible;
}

.relaxed-empty-state__description {
  max-width: 360px;
  color: var(--color-text-3);
  font-size: 13px;
  line-height: 21px;
}

.relaxed-empty-state :deep(.el-button) {
  margin-top: 14px;
}

.empty-shadow {
  fill: var(--color-brand-1);
}

.empty-sun {
  fill: var(--color-brand-1);
  stroke: var(--color-brand-3);
  stroke-width: 1.7;
}

.empty-hill-back {
  fill: var(--color-brand-1);
}

.empty-hill-front {
  fill: var(--color-brand-2);
  opacity: 0.72;
}

.empty-plant,
.empty-bird,
.empty-spark {
  stroke: var(--color-brand-4);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.empty-plant {
  opacity: 0.78;
}

.empty-spark {
  opacity: 0.62;
}
</style>
