<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { createTag, deleteTag, getTags, updateTag } from '@/api/tags'
import { useIsMobile } from '@/composables/useIsMobile'
import { formatDateTime } from '@/utils/datetime'
import type { TagItem, TagType } from '@/types'

const { t } = useI18n()
const { isMobile } = useIsMobile()

const tags = ref<TagItem[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance>()
// 编辑中的标签 id:null 表示新建
const editingTagId = ref<number | null>(null)

const form = reactive<{ name: string; type: TagType }>({ name: '', type: 'primary' })

// 标签类型可选项:颜色直接对应 el-tag 的语义类型,文案跟随语言
const typeOptions = computed<Array<{ value: TagType; label: string }>>(() => [
  { value: 'primary', label: t('tag.typePrimary') },
  { value: 'success', label: t('tag.typeSuccess') },
  { value: 'info', label: t('tag.typeInfo') },
  { value: 'warning', label: t('tag.typeWarning') },
  { value: 'danger', label: t('tag.typeDanger') }
])

// 校验文案跟随语言,切换语言后重新生成
const rules = computed<FormRules>(() => ({
  name: [
    { required: true, message: t('validation.tagNameRequired'), trigger: 'blur' },
    { min: 1, max: 20, message: t('validation.tagNameLength'), trigger: 'blur' }
  ]
}))

const dialogTitle = computed(() => (editingTagId.value === null ? t('tag.dialogTitle') : t('tag.dialogEdit')))

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
  editingTagId.value = null
  form.name = ''
  form.type = 'primary'
  formRef.value?.clearValidate()
  dialogVisible.value = true
}

// 编辑复用同一个弹窗:回显名称与类型
function openEditDialog(tag: TagItem): void {
  editingTagId.value = tag.id
  form.name = tag.name
  form.type = tag.type || 'primary'
  formRef.value?.clearValidate()
  dialogVisible.value = true
}

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const payload = { name: form.name.trim(), type: form.type }
    if (editingTagId.value === null) {
      await createTag(payload)
    } else {
      await updateTag(editingTagId.value, payload)
    }
    dialogVisible.value = false
    ElMessage.success(editingTagId.value === null ? t('tag.created') : t('tag.updated'))
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

    <!-- 移动端:卡片列表 -->
    <div v-else-if="isMobile" class="card-list">
      <el-empty v-if="tags.length === 0" :description="$t('tag.empty')" />

      <div v-for="row in tags" :key="row.id" class="list-card">
        <div class="card-head">
          <el-tag :type="row.type || 'primary'">{{ row.name }}</el-tag>
          <span class="card-id">{{ $t('tag.colTodoCount') }}:{{ row._count ? row._count.todos : 0 }}</span>
        </div>

        <div class="card-meta">
          <span>{{ $t('common.createdAt') }}:{{ formatDateTime(row.createdAt) }}</span>
        </div>

        <div class="card-actions">
          <el-button link type="primary" @click="openEditDialog(row)">{{ $t('common.edit') }}</el-button>
          <el-button link type="danger" @click="handleDelete(row)">{{ $t('common.delete') }}</el-button>
        </div>
      </div>
    </div>

    <el-table v-else :data="tags">
      <el-table-column prop="name" :label="$t('tag.colName')" min-width="200">
        <template #default="{ row }">
          <el-tag :type="row.type || 'primary'">{{ row.name }}</el-tag>
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

      <el-table-column :label="$t('common.actions')" width="160" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEditDialog(row)">{{ $t('common.edit') }}</el-button>
          <el-button link type="danger" @click="handleDelete(row)">{{ $t('common.delete') }}</el-button>
        </template>
      </el-table-column>

      <template #empty>
        <el-empty :description="$t('tag.empty')" />
      </template>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="min(640px, 94vw)" :show-close="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item :label="$t('tag.colName')" prop="name">
          <el-input v-model="form.name" :placeholder="$t('tag.namePlaceholder')" maxlength="20" show-word-limit @keyup.enter="handleSubmit" />
        </el-form-item>

        <el-form-item :label="$t('tag.colType')" prop="type">
          <!-- label 用回显样式:选中态和下拉项都渲染成对应颜色的标签 -->
          <el-select v-model="form.type" style="width: 100%">
            <template #label="{ label, value }">
              <el-tag :type="value">{{ label }}</el-tag>
            </template>
            <el-option v-for="opt in typeOptions" :key="opt.value" :label="opt.label" :value="opt.value">
              <el-tag :type="opt.value">{{ opt.label }}</el-tag>
            </el-option>
          </el-select>
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
