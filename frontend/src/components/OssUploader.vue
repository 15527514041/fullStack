<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { deleteUpload, uploadFile } from '@/api/upload'
import type { UploadVisibility } from '@/api/upload'
import { useOssUrl } from '@/composables/useOssUrl'
import MenuIcon from '@/components/MenuIcon.vue'

/**
 * 公共上传组件:内部走后端 /api/uploads 中转上传 OSS
 * v-model 绑定的是 ossId(不是 URL)
 *
 * 用法:
 *   <OssUploader v-model="form.attachmentOssId" folder="todos" :max-size-mb="10" />
 */
const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    /** 目录,便于按业务分文件夹,如 todos / avatars */
    folder?: string
    accept?: string
    maxSizeMB?: number
    /** PUBLIC:永久直链;PRIVATE:签名地址(要求登录,仅本人/管理员可取) */
    visibility?: UploadVisibility
    /** 自定义提示文案,不传用默认 */
    tip?: string
  }>(),
  {
    modelValue: null,
    folder: 'uploads',
    accept: 'image/*',
    maxSizeMB: 10,
    visibility: 'PUBLIC',
    tip: ''
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const { t } = useI18n()

const uploading = ref(false)
const percent = ref(0)
// 本次刚上传成功拿到的直链,做预览用(比再请求一次地址接口快)
const uploadedOssId = ref('')
const localUrl = ref('')

const { url: remoteUrl } = useOssUrl(computed(() => props.modelValue))
const previewUrl = computed(() => localUrl.value || remoteUrl.value)

// 外部把 modelValue 换成别的文件时,清掉本地预览
watch(
  () => props.modelValue,
  (value) => {
    if (value !== uploadedOssId.value) {
      uploadedOssId.value = ''
      localUrl.value = ''
    }
  }
)

function validate(file: File): boolean {
  if (props.accept.startsWith('image') && !file.type.startsWith('image/')) {
    ElMessage.warning(t('upload.typeError'))
    return false
  }
  if (file.size > props.maxSizeMB * 1024 * 1024) {
    ElMessage.warning(t('upload.sizeError', { size: props.maxSizeMB }))
    return false
  }
  return true
}

// el-upload 自定义上传:交给我们的 axios 封装,能拿到进度
async function handleRequest(options: { file: File; onSuccess?: (r: unknown) => void; onError?: (e: unknown) => void }): Promise<void> {
  const file = options.file
  if (!validate(file)) return

  uploading.value = true
  percent.value = 0
  try {
    const result = await uploadFile(file, {
      folder: props.folder,
      visibility: props.visibility,
      onProgress: (value) => (percent.value = value)
    })
    uploadedOssId.value = result.ossId
    localUrl.value = result.url
    emit('update:modelValue', result.ossId)
    options.onSuccess?.(result)
    ElMessage.success(t('upload.success'))
  } catch (error) {
    options.onError?.(error)
    // 错误提示已由 axios 拦截器统一处理
  } finally {
    uploading.value = false
  }
}

async function handleRemove(): Promise<void> {
  const ossId = props.modelValue

  uploadedOssId.value = ''
  localUrl.value = ''
  emit('update:modelValue', null)

  if (!ossId) return
  try {
    await deleteUpload(ossId)
  } catch {
    // 删除失败不阻塞使用,后端有孤儿文件清理兜底
  }
}
</script>

<template>
  <div class="oss-uploader">
    <!-- 已选:预览 + 更换/删除 -->
    <div v-if="previewUrl" class="oss-preview">
      <img :src="previewUrl" alt="" />

      <div class="oss-preview-actions">
        <el-upload
          :show-file-list="false"
          :http-request="handleRequest"
          :accept="accept"
          :disabled="uploading"
        >
          <el-button size="small">{{ $t('upload.change') }}</el-button>
        </el-upload>
        <el-button size="small" type="danger" plain @click="handleRemove">{{ $t('upload.remove') }}</el-button>
      </div>
    </div>

    <!-- 未选:占位选择区 -->
    <el-upload
      v-else
      class="oss-picker-upload"
      :show-file-list="false"
      :http-request="handleRequest"
      :accept="accept"
      :disabled="uploading"
    >
      <div class="oss-picker" :class="{ 'is-uploading': uploading }">
        <MenuIcon name="avatar" :size="24" />
        <span v-if="uploading">{{ $t('upload.uploading') }}</span>
        <span v-else>{{ $t('upload.pick') }}</span>
      </div>
    </el-upload>

    <el-progress v-if="uploading" class="oss-progress" :percentage="percent" :stroke-width="6" :show-text="false" />

    <p class="oss-tip">{{ tip || $t('upload.tip', { size: maxSizeMB }) }}</p>
  </div>
</template>

<style scoped>
.oss-uploader {
  width: 100%;
}

.oss-picker {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 120px;
  border: 1px dashed var(--el-border-color);
  border-radius: 12px;
  color: var(--color-text-2);
  font-size: 14px;
  background: var(--color-bg-bottom);
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.oss-picker:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.oss-picker.is-uploading {
  cursor: progress;
}

.oss-preview {
  display: flex;
  align-items: center;
  gap: 14px;
}

.oss-preview img {
  width: 96px;
  height: 96px;
  object-fit: cover;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-bottom);
}

.oss-preview-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.oss-progress {
  margin-top: 10px;
}

.oss-tip {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--color-text-3);
}
</style>
