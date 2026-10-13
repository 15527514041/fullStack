<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

/**
 * 渲染 Markdown(公共组件):和 MarkdownInput 的预览共用同一套解析 + 净化
 * 用法:<MarkdownText :value="item.experience" empty="-" />
 */
const props = withDefaults(defineProps<{ value?: string | null; empty?: string }>(), {
  value: '',
  empty: ''
})

const html = computed(() => DOMPurify.sanitize(marked.parse(props.value || '', { async: false }) as string))
const isEmpty = computed(() => !(props.value || '').trim())
</script>

<template>
  <!-- 排版在全局 .markdown-body 里;这里只保证按正常空白渲染 -->
  <div class="markdown-text">
    <span v-if="isEmpty">{{ empty }}</span>
    <div v-else class="markdown-body" v-html="html" />
  </div>
</template>

<style scoped>
.markdown-text {
  /* 外层(.detail-card__value)是 pre-wrap,这里改回正常空白 */
  white-space: normal;
}
</style>
