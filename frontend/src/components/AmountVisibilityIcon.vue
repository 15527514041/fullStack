<script setup lang="ts">
withDefaults(
  defineProps<{
    visible?: boolean
    size?: number
  }>(),
  { visible: false, size: 18 }
)
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="visible">
      <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.8" />
    </template>

    <template v-else>
      <path d="M3 10.5c2.2 3.2 5.2 4.8 9 4.8s6.8-1.6 9-4.8" />
      <path d="m4.8 13.2-1.6 2.3M12 15.3v2.7M19.2 13.2l1.6 2.3" />
    </template>
  </svg>
</template>
