<script setup lang="ts">
import { computed } from 'vue'
import type { Tag } from '@/types'
import ColorTag from '@/components/ColorTag.vue'

const props = withDefaults(
  defineProps<{
    tags?: Tag[]
    max?: number
    emptyText?: string
  }>(),
  { tags: () => [], max: 3, emptyText: '—' }
)

const visibleTags = computed(() => props.tags.slice(0, props.max))
const hiddenCount = computed(() => Math.max(props.tags.length - props.max, 0))
</script>

<template>
  <span v-if="tags.length" class="ledger-tag-list">
    <ColorTag v-for="tag in visibleTags" :key="tag.id" :name="tag.name" :color="tag.color" />
    <span v-if="hiddenCount" class="ledger-tag-list__more">+{{ hiddenCount }}</span>
  </span>
  <span v-else class="ledger-tag-list__empty">{{ emptyText }}</span>
</template>

<style scoped>
.ledger-tag-list {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.ledger-tag-list__more {
  font-size: 12px;
  color: var(--color-text-3);
}

.ledger-tag-list__empty {
  color: var(--color-text-3);
}
</style>
