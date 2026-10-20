<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ name: string; color?: string | null }>(), {
  color: '#0bb06d'
})

const tagColor = computed(() => props.color || '#0bb06d')
const style = computed(() => ({
  color: tagColor.value,
  backgroundColor: `${tagColor.value}14`,
  borderColor: `${tagColor.value}33`
}))
</script>

<template>
  <span class="color-tag" :style="style">{{ name }}</span>
</template>

<style scoped>
.color-tag {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  height: 24px;
  padding: 0 8px;
  border: 1px solid;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  line-height: 22px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
