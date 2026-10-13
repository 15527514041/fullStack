<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { ElInput } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import MarkdownIcon, { type MarkdownIconName } from '@/components/MarkdownIcon.vue'

/**
 * 支持 Markdown 的表单项(公共组件):文本域 + 工具栏 + 预览
 *
 * - v-model 的值就是 Markdown 原文(存库、走接口的仍是纯文本,后端无需改动)
 * - 工具栏在光标 / 选区上插入语法;预览用 marked 渲染,过 DOMPurify 之后才 v-html
 * 用法:
 *   <MarkdownInput v-model="form.experience" :rows="3" :maxlength="500" placeholder="…" />
 */
const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    /** 文本域行数,默认 3 */
    rows?: number
    /** 最多字符数(和原来的 maxlength 对齐) */
    maxlength?: number
    /** 是否显示字数统计 */
    showWordLimit?: boolean
    disabled?: boolean
  }>(),
  { placeholder: '', rows: 3, maxlength: undefined, showWordLimit: true, disabled: false }
)

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const { t } = useI18n()

const inputRef = ref<InstanceType<typeof ElInput> | null>(null)
const previewing = ref(false)

/** 预览:先渲染 Markdown,再净化掉脚本之类的东西 */
const previewHtml = computed(() =>
  DOMPurify.sanitize(marked.parse(props.modelValue || '', { async: false }) as string)
)

/** 原生 textarea(root 是 el-input 渲染的,EP 已经暴露出来了) */
function textarea(): HTMLTextAreaElement | undefined {
  return inputRef.value?.textarea
}

/** 用一对标记包住选区(没选区就插入一对空标记,光标停在中间) */
function wrapSelection(before: string, after = before): void {
  const el = textarea()
  if (!el) return

  const { selectionStart: start, selectionEnd: end } = el
  const value = props.modelValue
  const selected = value.slice(start, end)
  emit('update:modelValue', `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`)

  const cursor = start + before.length
  nextTick(() => {
    el.focus()
    el.setSelectionRange(cursor, cursor + selected.length)
  })
}

/** 给选区覆盖到的每一行加前缀(列表 / 引用) */
function prefixLines(prefix: string): void {
  const el = textarea()
  if (!el) return

  const value = props.modelValue
  const start = el.selectionStart
  const end = el.selectionEnd
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const nextBreak = value.indexOf('\n', end)
  const lineEnd = nextBreak === -1 ? value.length : nextBreak

  const patched = value
    .slice(lineStart, lineEnd)
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n')

  emit('update:modelValue', `${value.slice(0, lineStart)}${patched}${value.slice(lineEnd)}`)

  const cursor = start + prefix.length
  nextTick(() => {
    el.focus()
    el.setSelectionRange(cursor, end + prefix.length)
  })
}

/** 插入链接:有选中内容就拿它当文字,否则用占位文字 */
function insertLink(): void {
  const el = textarea()
  if (!el) return

  const value = props.modelValue
  const start = el.selectionStart
  const end = el.selectionEnd
  const selected = value.slice(start, end) || t('markdown.linkText')
  const snippet = `[${selected}](url)`

  emit('update:modelValue', `${value.slice(0, start)}${snippet}${value.slice(end)}`)

  // 光标停在 url 上,直接粘贴地址就行
  const urlStart = start + selected.length + 3
  nextTick(() => {
    el.focus()
    el.setSelectionRange(urlStart, urlStart + 3)
  })
}

const tools = computed<Array<{ key: string; icon: MarkdownIconName; title: string; run: () => void }>>(() => [
  { key: 'bold', icon: 'bold', title: t('markdown.bold'), run: () => wrapSelection('**') },
  { key: 'italic', icon: 'italic', title: t('markdown.italic'), run: () => wrapSelection('*') },
  { key: 'list', icon: 'list', title: t('markdown.list'), run: () => prefixLines('- ') },
  { key: 'ordered', icon: 'ordered-list', title: t('markdown.orderedList'), run: () => prefixLines('1. ') },
  { key: 'quote', icon: 'quote', title: t('markdown.quote'), run: () => prefixLines('> ') },
  { key: 'code', icon: 'code', title: t('markdown.code'), run: () => wrapSelection('`') },
  { key: 'link', icon: 'link', title: t('markdown.link'), run: insertLink }
])

function togglePreview(): void {
  previewing.value = !previewing.value
}
</script>

<template>
  <div class="markdown-input" :class="{ 'is-previewing': previewing }">
    <!-- 工具栏:左边插入语法,右边切预览 -->
    <div class="markdown-input__toolbar">
      <el-tooltip v-for="tool in tools" :key="tool.key" :content="tool.title" effect="light" placement="top">
        <button type="button" class="markdown-tool" :disabled="disabled || previewing" @click="tool.run">
          <MarkdownIcon :name="tool.icon" />
        </button>
      </el-tooltip>

      <el-tooltip
        :content="previewing ? $t('markdown.edit') : $t('markdown.preview')"
        effect="light"
        placement="top"
      >
        <button type="button" class="markdown-tool markdown-tool--toggle" @click="togglePreview">
          <MarkdownIcon :name="previewing ? 'edit' : 'preview'" />
          <span>{{ previewing ? $t('markdown.edit') : $t('markdown.preview') }}</span>
        </button>
      </el-tooltip>
    </div>

    <!-- 文本域:预览时隐藏(留着 DOM,切回来光标位置还在) -->
    <el-input
      v-show="!previewing"
      ref="inputRef"
      class="markdown-input__editor"
      :model-value="modelValue"
      type="textarea"
      :rows="rows"
      :maxlength="maxlength"
      :show-word-limit="showWordLimit"
      :placeholder="placeholder"
      :disabled="disabled"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <!-- 预览 -->
    <div v-show="previewing" class="markdown-input__preview">
      <p v-if="!modelValue.trim()" class="markdown-input__empty">{{ $t('markdown.empty') }}</p>
      <div v-else class="markdown-body" v-html="previewHtml" />
    </div>
  </div>
</template>

<style scoped>
/* 整体像一个大输入框:工具栏在上,文本域在下 */
.markdown-input {
  width: 100%;
  border: 1px solid var(--el-border-color);
  border-radius: 16px;
  overflow: hidden;
  background: var(--color-bg-card-1);
}

.markdown-input.is-previewing {
  border-color: var(--el-border-color);
}

.markdown-input__toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  /* 工具栏不填色,只留一条分隔线;高度比原来高一档 */
  padding: 2px 8px;
  border-bottom: 1px solid var(--color-border);
  background: transparent;
}

.markdown-tool {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  min-width: 30px;
  padding: 0 6px;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-2);
  font-family: inherit;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease;
}

.markdown-tool:hover:not(:disabled) {
  color: var(--color-brand-6);
  background: var(--color-brand-1);
}

.markdown-tool:disabled {
  color: var(--color-text-4);
  cursor: not-allowed;
}

/* 预览开关推到右边 */
.markdown-tool--toggle {
  margin-left: auto;
  padding: 0 10px;
}

/* 内层文本域去掉自己的边框和阴影:外框统一画 */
.markdown-input :deep(.el-textarea__inner) {
  border: none;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}

.markdown-input :deep(.el-textarea__inner:focus) {
  box-shadow: none;
}

/* 字数统计和内层贴边一点 */
.markdown-input :deep(.el-input__count) {
  right: 10px;
  bottom: 6px;
  background: transparent;
  font-size: 12px;
}

/* 预览区:高度跟文本域接近,内容超高自己滚 */
.markdown-input__preview {
  padding: 10px 14px;
  min-height: 76px;
  max-height: 320px;
  overflow-y: auto;
}

.markdown-input__empty {
  margin: 0;
  color: var(--color-text-4);
}
</style>
