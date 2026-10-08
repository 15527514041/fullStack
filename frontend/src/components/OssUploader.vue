<script setup lang="ts" generic="T extends string | string[] | null">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { UploadFile, UploadRequestOptions } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { deleteUpload, getUploadUrl, uploadFile } from '@/api/upload'
import type { UploadResult, UploadVisibility } from '@/api/upload'
import FileIcon from '@/components/FileIcon.vue'
import { resolveOssMeta } from '@/composables/useOssUrl'
import { formatFileSize, isImageMime } from '@/utils/file'

/**
 * 公共上传组件(表单里用,样式参考 client 的 FileUpload)
 *
 * 全站只有这一套上传样式:拖拽区 + 文件列表
 * 列表项:左侧缩略图(图片显示预览图,其它显示文档图标)+ 文件名/大小 + 右侧「下载 / 预览 / 删除」
 *
 * v-model 约定:
 * - limit = 1(默认):值是 `string | null`
 * - limit > 1:值是 `string[]`
 */
const props = withDefaults(
  defineProps<{
    modelValue?: T
    /** 最多上传几个,默认 1 */
    limit?: number
    /** 单个文件大小上限(MB) */
    maxSizeMB?: number
    /** 允许的扩展名(默认图片;传 pdf/docx 等即可支持文件) */
    fileTypes?: string[]
    /** OSS 目录,便于按业务分文件夹 */
    folder?: string
    /** 上传可见性:私有文件走签名地址 */
    visibility?: UploadVisibility
    /** 是否显示底部提示 */
    showTip?: boolean
  }>(),
  {
    limit: 1,
    maxSizeMB: 10,
    fileTypes: () => ['png', 'jpg', 'jpeg', 'webp', 'gif'],
    folder: 'uploads',
    visibility: 'PUBLIC',
    showTip: true
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: T]
}>()

const { t } = useI18n()

interface OssListItem {
  uid: number
  ossId?: string
  name: string
  size?: number
  mime?: string
  url: string
  percent: number
  status: 'uploading' | 'done' | 'error'
}

const isMultiple = computed(() => props.limit > 1)
const accept = computed(() => props.fileTypes.map((type) => `.${type}`).join(','))
const fileTypeText = computed(() => props.fileTypes.join('/'))

const listItems = ref<OssListItem[]>([])
const previewVisible = ref(false)
const previewUrl = ref('')

const currentIds = computed(() => listItems.value.filter((item) => item.ossId).map((item) => item.ossId as string))
const isLocked = computed(() => currentIds.value.length >= props.limit)

function emitValue(): void {
  const ids = currentIds.value
  emit('update:modelValue', (isMultiple.value ? ids : (ids[0] ?? null)) as T)
}

function toArray(value: string | string[] | null | undefined): string[] {
  if (!value) return []
  return Array.isArray(value) ? value.filter(Boolean) : [value]
}

// 外部值变化 → 回显(编辑时把已存的 ossId 换成地址/文件名渲染)
watch(
  () => props.modelValue,
  async (value) => {
    const ids = toArray(value)

    // 自己 emit 出去的值会回流一次,内容一致就不重建,避免打断正在上传的列表
    if (ids.length === currentIds.value.length && ids.every((id, index) => id === currentIds.value[index])) {
      return
    }

    listItems.value = await Promise.all(
      ids.map(async (ossId, index) => {
        try {
          const meta = await resolveOssMeta(ossId)
          return {
            uid: -(index + 1),
            ossId,
            name: meta?.originalName || ossId,
            size: meta?.size,
            mime: meta?.mime,
            url: meta?.url || '',
            percent: 100,
            status: 'done' as const
          }
        } catch {
          return { uid: -(index + 1), ossId, name: ossId, url: '', percent: 100, status: 'done' as const }
        }
      })
    )
  },
  { immediate: true }
)

// 上传前校验:格式 + 大小;通过后先往列表里插一条占位(显示进度)
function beforeUpload(file: File): boolean {
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase() : ''
  if (!props.fileTypes.includes(ext)) {
    ElMessage.warning(t('upload.typeError', { types: fileTypeText.value }))
    return false
  }
  if (file.size > props.maxSizeMB * 1024 * 1024) {
    ElMessage.warning(t('upload.sizeError', { size: props.maxSizeMB }))
    return false
  }

  listItems.value.push({
    uid: (file as File & { uid?: number }).uid ?? Date.now(),
    name: file.name,
    size: file.size,
    mime: file.type,
    // 图片用本地预览,上传完成后再换成 OSS 地址
    url: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
    percent: 0,
    status: 'uploading'
  })
  return true
}

// 自定义上传:走我们封装的 axios(能拿到进度,后端再转存 OSS)
async function handleRequest(options: UploadRequestOptions): Promise<void> {
  const uid = (options.file as File & { uid?: number }).uid

  try {
    const result = await uploadFile(options.file, {
      folder: props.folder,
      visibility: props.visibility,
      onProgress: (percent) => {
        options.onProgress({ percent } as never)
        const item = listItems.value.find((entry) => entry.uid === uid)
        if (item) item.percent = percent
      }
    })
    options.onSuccess(result as never)
  } catch (error) {
    options.onError(error as never)
  }
}

function handleSuccess(response: unknown, uploadFileItem: UploadFile): void {
  const result = response as UploadResult
  const item = listItems.value.find((entry) => entry.uid === uploadFileItem.uid)

  if (item) {
    item.ossId = result.ossId
    item.mime = result.mime
    item.size = result.size
    item.url = result.url
    item.name = result.originalName || item.name
    item.percent = 100
    item.status = 'done'
  }

  emitValue()
  ElMessage.success(t('upload.success'))
}

function handleError(_error: unknown, uploadFileItem: UploadFile): void {
  const item = listItems.value.find((entry) => entry.uid === uploadFileItem.uid)
  if (item) item.status = 'error'
}

async function removeItem(item: OssListItem): Promise<void> {
  listItems.value = listItems.value.filter((entry) => entry.uid !== item.uid)
  emitValue()

  if (!item.ossId) return
  try {
    await deleteUpload(item.ossId)
  } catch {
    // 后端有孤儿文件清理兜底
  }
}

function handleExceed(): void {
  ElMessage.warning(t('upload.exceed', { count: props.limit }))
}

// 预览:图片弹窗放大,其它文件新窗口打开
function openPreview(item: { url: string; mime?: string; name?: string }): void {
  if (!item.url) return
  if (isImageMime(item.mime, item.name)) {
    previewUrl.value = item.url
    previewVisible.value = true
    return
  }
  window.open(item.url, '_blank', 'noopener')
}

// 下载:让后端签一个带 content-disposition 的地址,浏览器直接下载
async function downloadItem(item: OssListItem): Promise<void> {
  if (!item.ossId) return
  try {
    const result = await getUploadUrl(item.ossId, { download: true })
    window.open(result.url, '_blank', 'noopener')
  } catch {
    // 错误提示已由 axios 拦截器统一处理
  }
}
</script>

<template>
  <div class="oss-uploader">
    <!-- 全站唯一的上传样式:拖拽区 + 文件列表 -->
    <el-upload
      class="oss-uploader__drop"
      drag
      :show-file-list="false"
      :limit="limit"
      :multiple="isMultiple"
      :disabled="isLocked"
      :accept="accept"
      :http-request="handleRequest"
      :before-upload="beforeUpload"
      :on-success="handleSuccess"
      :on-error="handleError"
      :on-exceed="handleExceed"
    >
      <div class="oss-uploader__drop-inner" :class="{ 'is-locked': isLocked }">
        <FileIcon :name="isLocked ? 'lock' : 'cloud-upload'" :size="20" />
        <span>{{ isLocked ? $t('upload.limitReached') : $t('upload.dropHint') }}</span>
      </div>
    </el-upload>

    <ul v-if="listItems.length" class="oss-list">
      <li v-for="item in listItems" :key="item.uid" class="oss-list__item">
        <div class="oss-list__thumb">
          <img v-if="isImageMime(item.mime, item.name) && item.url" :src="item.url" alt="" />
          <FileIcon v-else name="file" :size="40" />
        </div>

        <div class="oss-list__info">
          <span class="oss-list__name" :title="item.name">{{ item.name }}</span>
          <span v-if="item.status === 'error'" class="oss-list__error">{{ $t('upload.failed') }}</span>
          <span v-else class="oss-list__size">{{ formatFileSize(item.size) }}</span>
          <div v-if="item.status === 'uploading'" class="oss-list__progress">
            <i :style="{ width: `${item.percent}%` }" />
          </div>
        </div>

        <div class="oss-list__actions">
          <FileIcon v-if="item.status === 'done'" name="download" class="oss-list__action" @click="downloadItem(item)" />
          <FileIcon v-if="item.status === 'done'" name="eye" class="oss-list__action" @click="openPreview(item)" />
          <FileIcon name="delete" class="oss-list__action" @click="removeItem(item)" />
        </div>
      </li>
    </ul>

    <div v-if="showTip" class="el-upload__tip">
      {{ $t('upload.tipPrefix') }}
      <b class="oss-uploader__strong">{{ maxSizeMB }}MB</b>
      {{ $t('upload.tipMiddle') }}
      <b class="oss-uploader__strong">{{ fileTypeText }}</b>
      {{ $t('upload.tipSuffix') }}
    </div>

    <el-dialog v-model="previewVisible" :title="$t('upload.preview')" width="800px" append-to-body>
      <img class="oss-uploader__preview" :src="previewUrl" alt="" />
    </el-dialog>
  </div>
</template>

<style scoped>
.oss-uploader {
  width: 100%;
}

.oss-uploader__strong {
  color: var(--el-color-danger);
  font-weight: 600;
}

.oss-uploader__preview {
  display: block;
  max-width: 100%;
  margin: 0 auto;
}

.oss-uploader .el-upload__tip {
  margin-top: 8px;
  font-size: 14px;
  line-height: 22px;
  color: var(--color-text-3);
}

/* ---------- 拖拽区 ---------- */
.oss-uploader__drop :deep(.el-upload) {
  display: block;
  width: 100%;
}

.oss-uploader__drop :deep(.el-upload-dragger) {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60px;
  padding: 0;
  border: 1px dashed var(--color-border);
  border-radius: 16px;
  background: var(--color-bg-bottom);
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.oss-uploader__drop :deep(.el-upload:not(.is-disabled) .el-upload-dragger:hover),
.oss-uploader__drop :deep(.el-upload-dragger.is-dragover) {
  background: var(--color-brand-1);
  border-color: var(--color-brand-2);
}

.oss-uploader__drop-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  line-height: 22px;
  color: var(--color-brand-6);
}

.oss-uploader__drop-inner.is-locked {
  color: var(--color-text-4);
}

/* ---------- 文件列表(参考 client 的 FileUpload 卡片) ---------- */
.oss-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.oss-list__item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  padding: 14px 20px;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: var(--color-bg-card);
}

.oss-list__thumb {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 6px;
}

.oss-list__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.oss-list__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.oss-list__name {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  color: var(--color-text-1);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oss-list__size,
.oss-list__error {
  font-size: 12px;
  line-height: 16px;
  color: var(--color-text-3);
}

.oss-list__error {
  color: var(--el-color-danger);
}

.oss-list__progress {
  height: 4px;
  margin-top: 2px;
  border-radius: 2px;
  background: var(--color-bg-bottom);
  overflow: hidden;
}

.oss-list__progress i {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: var(--el-color-primary);
  transition: width 0.2s;
}

.oss-list__actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 20px;
  color: var(--color-text-2);
}

.oss-list__action {
  cursor: pointer;
  transition: color 0.2s ease;
}

.oss-list__action:hover {
  color: var(--color-brand-6);
}

.oss-list__action:last-child:hover {
  color: var(--el-color-danger);
}
</style>
