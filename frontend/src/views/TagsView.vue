<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { createTag, deleteTag, getTags } from '@/api/tags'
import { formatDateTime } from '@/utils/datetime'
import type { TagItem } from '@/types'

const { t } = useI18n()

const tags = ref<TagItem[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance>()

const form = reactive({ name: '' })

// 校验文案跟随语言,切换语言后重新生成
const rules = computed<FormRules>(() => ({
  name: [
    { required: true, message: t('validation.tagNameRequired'), trigger: 'blur' },
    { min: 1, max: 20, message: t('validation.tagNameLength'), trigger: 'blur' }
  ]
}))

async function loadTags(): Promise<void> {
  loading.value = true
  try {
    tags.value = await getTags()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  } finally {
    loading.value = false
  }
}

function openDialog(): void {
  form.name = ''
  formRef.value?.clearValidate()
  dialogVisible.value = true
}

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    await createTag(form.name.trim())
    dialogVisible.value = false
    ElMessage.success(t('tag.created'))
    await loadTags()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  } finally {
    submitting.value = false
  }
}

async function handleDelete(tag: TagItem): Promise<void> {
  try {
    await ElMessageBox.confirm(t('tag.deleteConfirm', { name: tag.name }), t('common.tip'), {
      type: 'warning',
      showClose: false,
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel')
    })
  } catch {
    return // 用户取消
  }

  try {
    await deleteTag(tag.id)
    ElMessage.success(t('tag.deleted'))
    await loadTags()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  }
}

onMounted(loadTags)
</script>

<template>
  <div class="list-page">
    <div class="page-header">
      <div class="page-title">{{ $t('tag.title') }}</div>
      <el-button type="primary" @click="openDialog">
        <el-icon><Plus /></el-icon>
        {{ $t('tag.addButton') }}
      </el-button>
    </div>

    <el-skeleton v-if="loading && tags.length === 0" :rows="6" animated class="list-skeleton" />

    <el-table v-else :data="tags">
      <el-table-column prop="name" :label="$t('tag.colName')" min-width="200">
        <template #default="{ row }">
          <el-tag type="info">{{ row.name }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column :label="$t('tag.colTodoCount')" width="120" align="center">
        <template #default="{ row }">{{ row._count ? row._count.todos : 0 }}</template>
      </el-table-column>

      <el-table-column :label="$t('common.createdAt')" width="180">
        <template #default="{ row }">
          {{ formatDateTime(row.createdAt) }}
        </template>
      </el-table-column>

      <el-table-column :label="$t('common.actions')" width="100" align="center">
        <template #default="{ row }">
          <el-button link type="danger" @click="handleDelete(row)">{{ $t('common.delete') }}</el-button>
        </template>
      </el-table-column>

      <template #empty>
        <el-empty :description="$t('tag.empty')" />
      </template>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="$t('tag.dialogTitle')" width="min(640px, 94vw)" :show-close="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item :label="$t('tag.colName')" prop="name">
          <el-input v-model="form.name" :placeholder="$t('tag.namePlaceholder')" maxlength="20" show-word-limit @keyup.enter="handleSubmit" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ $t('common.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
</style>
