<script setup lang="ts">
withDefaults(defineProps<{ color?: string | null; size?: number }>(), {
  color: '#0bb06d',
  size: 8
})
</script>

<template>
  <span
    class="color-dot"
    :style="{ width: `${size}px`, height: `${size}px`, backgroundColor: color || '#0bb06d' }"
  />
</template>

<style scoped>
.color-dot {
  display: inline-block;
  flex: none;
  border-radius: 50%;
}
</style>
