<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { createTag, deleteTag, getTags } from '@/api/tags'
import type { TagItem } from '@/types'

const tags = ref<TagItem[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance>()

const form = reactive({ name: '' })

const rules: FormRules = {
  name: [
    { required: true, message: '请输入标签名', trigger: 'blur' },
    { min: 1, max: 20, message: '标签名长度为 1-20 个字符', trigger: 'blur' }
  ]
}

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
    ElMessage.success('标签已创建')
    await loadTags()
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  } finally {
    submitting.value = false
  }
}

async function handleDelete(tag: TagItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除标签「${tag.name}」吗?删除后 TODO 上的该标签会一并移除`, '提示', {
      type: 'warning',
      showClose: false,
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return // 用户取消
  }

  try {
    await deleteTag(tag.id)
    ElMessage.success('已删除')
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
      <div class="page-title">标签管理</div>
      <el-button type="primary" @click="openDialog">
        <el-icon><Plus /></el-icon>
        新建标签
      </el-button>
    </div>

    <el-skeleton v-if="loading && tags.length === 0" :rows="6" animated class="list-skeleton" />

    <el-table v-else :data="tags">
      <el-table-column prop="name" label="标签名" min-width="200">
        <template #default="{ row }">
          <el-tag type="info">{{ row.name }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column label="关联 TODO" width="120" align="center">
        <template #default="{ row }">{{ row._count ? row._count.todos : 0 }}</template>
      </el-table-column>

      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">
          {{ row.createdAt ? new Date(row.createdAt).toLocaleString() : '-' }}
        </template>
      </el-table-column>

      <el-table-column label="操作" width="100" align="center">
        <template #default="{ row }">
          <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>

      <template #empty>
        <el-empty description="还没有标签,点击「新建标签」创建" />
      </template>
    </el-table>

    <el-dialog v-model="dialogVisible" title="新建标签" width="min(640px, 94vw)" :show-close="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="标签名" prop="name">
          <el-input v-model="form.name" placeholder="例如:工作 / 紧急" maxlength="20" show-word-limit @keyup.enter="handleSubmit" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
</style>
