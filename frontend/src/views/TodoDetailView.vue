<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getTodo } from '@/api/todo'
import { formatDateTime } from '@/utils/datetime'
import BackButton from '@/components/BackButton.vue'
import OssAttachmentPreview from '@/components/OssAttachmentPreview.vue'
import type { Todo } from '@/types'

/**
 * TODO 详情页(样式参考 client 收款方管理 - 详情)
 * 布局:居中标题 + 返回按钮 → 30px 圆角白卡片 → section-title 分节 → label/value 行
 */
const route = useRoute()
const router = useRouter()
const loading = ref(true)
const todo = ref<Todo | null>(null)
// 接口 404(不存在或已删除)时不弹错误,直接走空状态
const notFound = ref(false)

const todoId = computed(() => Number(route.params.id))
const attachmentIds = computed(() => (todo.value?.attachments || []).map((item) => item.ossId))
// 无菜单栏时内容区已铺满,页面自己不留圆角,只保留左右留白
const noSidebar = computed(() => route.meta.noSidebar === true)

async function loadDetail(): Promise<void> {
  if (!Number.isInteger(todoId.value) || todoId.value <= 0) {
    notFound.value = true
    loading.value = false
    return
  }

  loading.value = true
  try {
    todo.value = await getTodo(todoId.value)
  } catch {
    // 错误提示已由 axios 拦截器统一处理(401 等),这里只补一个空状态
    notFound.value = true
  } finally {
    loading.value = false
  }
}

onMounted(loadDetail)
</script>

<template>
  <div class="detail-page" :class="{ 'is-full': noSidebar }">
    <div class="detail-header">
      <!-- 返回按钮:无历史(直接打开链接)时兜底回列表页 -->
      <BackButton :fallback="{ name: 'todos' }" />
      <div class="detail-title">{{ $t('todo.detailTitle') }}</div>
    </div>

    <div class="detail-container">
      <el-skeleton v-if="loading" :rows="6" animated />

      <el-empty v-else-if="notFound || !todo" :description="$t('todo.detailNotFound')">
        <el-button type="primary" @click="router.push({ name: 'todos' })">{{ $t('todo.detailBackList') }}</el-button>
      </el-empty>

      <div v-else class="info-card">
        <div class="section-title">{{ $t('todo.detailBasic') }}</div>

        <div class="info-item">
          <span class="label">{{ $t('todo.formTitle') }}</span>
          <span class="value">{{ todo.title }}</span>
        </div>

        <div class="info-item">
          <span class="label">{{ $t('todo.detailStatus') }}</span>
          <span class="value">
            <el-tag :type="todo.completed ? 'success' : 'warning'">
              {{ todo.completed ? $t('todo.detailDone') : $t('todo.detailUndone') }}
            </el-tag>
          </span>
        </div>

        <div class="info-item">
          <span class="label">{{ $t('todo.formTags') }}</span>
          <span class="value">
            <template v-if="todo.tags && todo.tags.length">
              <el-tag v-for="tag in todo.tags" :key="tag.id" class="tag-item" :type="tag.type || 'primary'">
                {{ tag.name }}
              </el-tag>
            </template>
            <span v-else class="empty-value">-</span>
          </span>
        </div>

        <div class="info-item">
          <span class="label">{{ $t('todo.formRemark') }}</span>
          <span class="value">
            <span v-if="todo.remark" class="remark-value">{{ todo.remark }}</span>
            <span v-else class="empty-value">-</span>
          </span>
        </div>

        <div class="info-item">
          <span class="label">{{ $t('todo.formAttachment') }}</span>
          <span class="value">
            <OssAttachmentPreview v-if="attachmentIds.length" :value="attachmentIds" :size="56" :max="3" :radius="8" />
            <span v-else class="empty-value">-</span>
          </span>
        </div>

        <div class="section-title">{{ $t('todo.detailTime') }}</div>

        <div class="info-item">
          <span class="label">{{ $t('common.createdAt') }}</span>
          <span class="value">{{ formatDateTime(todo.createdAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 页面外壳、卡片、分节标题都在全局 theme.css 里(.detail-page/.info-card/.section-title) */
.info-item {
  display: flex;
  align-items: flex-start;
  padding: 8px 0;
}

.label {
  flex-shrink: 0;
  min-width: 130px;
  max-width: 130px;
  margin-right: 20px;
  font-size: 14px;
  font-weight: 500;
  line-height: 28px;
  color: var(--color-text-3);
}

.value {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  line-height: 28px;
  color: var(--color-text-1);
  word-break: break-word;
}

.tag-item {
  margin-right: 6px;
}

.remark-value {
  white-space: pre-wrap;
}

.empty-value {
  color: var(--color-text-4);
}

@media (max-width: 768px) {
  .label {
    min-width: 84px;
    max-width: 84px;
    margin-right: 12px;
    font-size: 13px;
  }

  .value {
    font-size: 13px;
  }
}
</style>
