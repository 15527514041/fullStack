<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { resolveOssMeta } from '@/composables/useOssUrl'
import type { UploadResult } from '@/api/upload'
import FileIcon from '@/components/FileIcon.vue'
import { formatFileSize, isImageMime } from '@/utils/file'

/**
 * 公共预览组件(列表/详情里用,样式参考 client 的 ImagePreview / FilePreview)
 *
 * value 支持单个 ossId 或数组:
 * - 图片 → 缩略图,点击放大(多张可左右切换,超出 max 折叠成 +N)
 * - 其它文件 → 一行「图标 + 文件名 + 大小」,点击新窗口打开(私有文件是签名地址)
 */
const props = withDefaults(
  defineProps<{
    value?: string | string[] | null
    /** 图片缩略图边长(px) */
    size?: number
    /** 最多显示几张图片,超出的折叠成 +N */
    max?: number
    /** 图片圆角(px) */
    radius?: number
  }>(),
  { value: null, size: 36, max: 1, radius: 6 }
)

const ids = computed<string[]>(() => {
  if (!props.value) return []
  return Array.isArray(props.value) ? props.value.filter(Boolean) : [props.value]
})

const metas = ref<Array<UploadResult | null>>([])

watch(
  ids,
  async (list) => {
    metas.value = await Promise.all(
      list.map(async (ossId) => {
        try {
          return await resolveOssMeta(ossId)
        } catch {
          return null
        }
      })
    )
  },
  { immediate: true }
)

// 图片与文件分开渲染
const imageMetas = computed(() => metas.value.filter((meta): meta is UploadResult => !!meta && isImageMime(meta.mime, meta.originalName)))
const fileMetas = computed(() => metas.value.filter((meta): meta is UploadResult => !!meta && !isImageMime(meta.mime, meta.originalName)))

const imageUrls = computed(() => imageMetas.value.map((meta) => meta.url).filter(Boolean))
const visibleImages = computed(() => imageMetas.value.slice(0, Math.max(1, props.max)))
const hiddenCount = computed(() => Math.max(0, imageMetas.value.length - visibleImages.value.length))

const boxStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: `${props.radius}px`
}))
</script>

<template>
  <div v-if="ids.length" class="oss-attachment-preview">
    <!-- 图片:缩略图 + 点击放大 -->
    <div v-if="imageMetas.length" class="oss-attachment-preview__images">
      <el-image
        v-for="(meta, index) in visibleImages"
        :key="meta.ossId"
        class="oss-attachment-preview__item"
        :src="meta.url"
        :preview-src-list="imageUrls"
        :initial-index="index"
        :preview-teleported="true"
        fit="cover"
        :style="boxStyle"
      >
        <template #error>
          <div class="oss-attachment-preview__error">
            <FileIcon name="file" :size="size" />
          </div>
        </template>

        <div v-if="index === visibleImages.length - 1 && hiddenCount > 0" class="oss-attachment-preview__more">
          +{{ hiddenCount }}
        </div>
      </el-image>
    </div>

    <!-- 文件:图标 + 文件名 + 大小,点击新窗口打开 -->
    <a
      v-for="meta in fileMetas"
      :key="meta.ossId"
      class="oss-attachment-preview__file"
      :href="meta.url"
      target="_blank"
      rel="noopener"
      :title="meta.originalName || meta.key"
    >
      <FileIcon name="file" :size="20" class="oss-attachment-preview__file-icon" />
      <span class="oss-attachment-preview__file-name">{{ meta.originalName || meta.key }}</span>
      <span class="oss-attachment-preview__file-size">{{ formatFileSize(meta.size) }}</span>
    </a>
  </div>
</template>

<style scoped>
.oss-attachment-preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.oss-attachment-preview__images {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.oss-attachment-preview__item {
  display: block;
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-bg-bottom);
  cursor: pointer;
  transition: transform 0.2s ease;
}

.oss-attachment-preview__item:hover {
  transform: scale(1.04);
}

.oss-attachment-preview__error {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.oss-attachment-preview__more {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

/* 文件行 */
.oss-attachment-preview__file {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--color-bg-bottom);
  color: var(--color-text-1);
  font-size: 13px;
  line-height: 20px;
  text-decoration: none;
  transition: background 0.2s;
}

.oss-attachment-preview__file:hover {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.oss-attachment-preview__file-icon {
  flex-shrink: 0;
}

.oss-attachment-preview__file-name {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oss-attachment-preview__file-size {
  flex-shrink: 0;
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
