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
.detail-page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  padding: 30px 32px;
  background: var(--el-bg-color);
  border-radius: 18px;
}

/* 无菜单栏:去圆角,内边距收到 client 详情页的 20px(内容列自己居中) */
.detail-page.is-full {
  padding: 20px 20px 60px;
  border-radius: 0;
}

/* 标题居中、返回按钮贴左(参考 client 详情页头部) */
.detail-header {
  position: relative;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  /* 和内容列同宽:标题居中在卡片上方,返回按钮与卡片左边缘对齐(参考 client) */
  width: 100%;
  max-width: 1000px;
  margin: 0 auto 20px;
}

.detail-title {
  max-width: 70%;
  overflow: hidden;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-text-1);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-container {
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
}

/* 卡片:白底 + 柔和阴影 + 30px 大圆角(参考 client) */
.info-card {
  padding: 0 30px 24px;
  border-radius: 30px;
  background: var(--color-bg-card-1);
  box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.08);
}

.section-title {
  padding: 30px 0 10px;
  font-size: 18px;
  font-weight: 500;
  color: var(--color-text-1);
}

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
  .detail-page {
    padding: 14px 12px;
    border-radius: 12px;
  }

  .detail-page.is-full {
    padding: 12px 12px 40px;
    border-radius: 0;
  }

  .detail-header {
    height: 40px;
    margin-bottom: 14px;
  }

  .detail-title {
    max-width: 60%;
    font-size: 18px;
  }

  .info-card {
    padding: 0 20px 20px;
    border-radius: 30px;
  }

  .section-title {
    padding: 20px 0 8px;
    font-size: 15px;
  }

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
