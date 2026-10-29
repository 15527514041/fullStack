<script setup lang="ts">
withDefaults(
  defineProps<{
    kind?: 'tasks' | 'schedule'
  }>(),
  { kind: 'tasks' }
)
</script>

<template>
  <svg
    class="overview-empty-art"
    viewBox="0 0 180 104"
    fill="none"
    aria-hidden="true"
  >
    <ellipse class="art-shadow" cx="90" cy="93" rx="57" ry="7" />

    <template v-if="kind === 'tasks'">
      <path
        class="art-leaf"
        d="M132 27c9-7 18-6 22-4-1 8-7 15-17 14M146 25c-4 4-7 9-8 15"
      />
      <rect class="art-paper" x="39" y="15" width="102" height="72" rx="16" />
      <rect class="art-check" x="56" y="34" width="18" height="18" rx="6" />
      <path class="art-check-mark" d="m61 43 3 3 6-7" />
      <path class="art-line" d="M84 39h39M84 45h26" />
      <rect class="art-check art-check-soft" x="56" y="61" width="18" height="18" rx="6" />
      <path class="art-line art-line-soft" d="M84 66h31M84 72h22" />
      <path class="art-spark" d="M31 30v8M27 34h8M145 62v5M142.5 64.5h5" />
    </template>

    <template v-else>
      <rect class="art-paper" x="39" y="21" width="102" height="67" rx="16" />
      <path class="art-calendar-line" d="M39 42h102M61 14v14M119 14v14" />
      <circle class="art-calendar-dot" cx="61" cy="56" r="4" />
      <circle class="art-calendar-dot" cx="81" cy="56" r="4" />
      <circle class="art-calendar-dot is-soft" cx="61" cy="72" r="4" />
      <path class="art-calendar-dash" d="M76 72h20M103 56h19M103 72h13" />
      <circle class="art-clock-face" cx="132" cy="76" r="21" />
      <path class="art-clock-hands" d="M132 64v12l8 5" />
      <path class="art-leaf" d="M31 39c-8-6-16-5-20-3 1 8 7 14 16 13M18 38c4 4 7 8 8 13" />
    </template>
  </svg>
</template>

<style scoped>
.overview-empty-art {
  display: block;
  width: 168px;
  max-width: 76%;
  height: auto;
  margin: 0 auto 12px;
  overflow: visible;
}

.art-shadow {
  fill: var(--color-brand-1);
}

.art-paper {
  fill: var(--color-bg-card);
  stroke: var(--color-brand-2);
  stroke-width: 1.8;
}

.art-check {
  fill: var(--color-brand-1);
  stroke: var(--color-brand-3);
  stroke-width: 1.5;
}

.art-check-soft {
  opacity: 0.62;
}

.art-check-mark,
.art-calendar-line,
.art-clock-hands {
  stroke: var(--color-brand-6);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.art-line {
  stroke: var(--color-text-3);
  stroke-width: 2;
  stroke-linecap: round;
  opacity: 0.65;
}

.art-line-soft {
  opacity: 0.36;
}

.art-spark,
.art-leaf {
  stroke: var(--color-brand-4);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.art-calendar-line {
  opacity: 0.7;
}

.art-calendar-dot {
  fill: var(--color-brand-3);
}

.art-calendar-dot.is-soft {
  opacity: 0.42;
}

.art-calendar-dash {
  stroke: var(--color-text-4);
  stroke-width: 2;
  stroke-linecap: round;
}

.art-clock-face {
  fill: var(--color-brand-1);
  stroke: var(--color-brand-3);
  stroke-width: 1.8;
}
</style>
