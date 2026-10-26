<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    hint?: string
  }>(),
  { hint: '' }
)
</script>

<template>
  <section class="weekly-period-card">
    <div class="weekly-period-card__copy">
      <h3 class="weekly-period-card__title">{{ title }}</h3>
      <p v-if="hint" class="weekly-period-card__hint">{{ hint }}</p>
    </div>

    <div class="weekly-period-card__controls">
      <slot />
    </div>

  </section>
</template>

<style scoped>
.weekly-period-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
  padding: 20px 30px;
  border-radius: 30px;
  background: var(--color-bg-card-1);
  box-shadow: var(--shadow-card-lg);
}

.weekly-period-card__copy {
  flex: 0 0 auto;
  min-width: 0;
}

.weekly-period-card__title {
  margin: 0;
  color: var(--color-text-1);
  font-size: 16px;
  font-weight: 500;
  line-height: 22px;
}

.weekly-period-card__hint {
  margin: 2px 0 0;
  color: var(--color-text-3);
  font-size: 12px;
  line-height: 18px;
}

.weekly-period-card__controls {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

@media (max-width: 768px) {
  .weekly-period-card {
    align-items: stretch;
    padding: 18px 20px;
    border-radius: 24px;
  }

  .weekly-period-card__copy {
    min-width: 0;
  }

  .weekly-period-card__controls {
    flex-basis: 100%;
  }
}
</style>
