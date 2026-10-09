<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { toDateString } from '@/utils/datetime'
import type { ReflectionItem } from '@/types'

/**
 * 反思条目的新增 / 编辑弹窗(一次只处理一条)
 * - 从列表页打开:不传 date,弹窗里自己选日期
 * - 从详情页打开:传 date(固定为那天的日期),只读展示
 * - 传了 item 就是编辑已有条目,回显三栏
 * 提交只往上抛数据,具体调哪个接口由页面决定
 */
export interface ReflectionSubmitPayload {
  date: string
  item: { experience: string; reason: string | null; measure: string | null }
}

const props = withDefaults(
  defineProps<{
    visible: boolean
    /** 固定日期(详情页用):传了就只读展示 */
    date?: string
    /** 编辑已有条目时传进来回显 */
    item?: ReflectionItem | null
    loading?: boolean
  }>(),
  { date: '', item: null, loading: false }
)

const emit = defineEmits<{
  'update:visible': [value: boolean]
  submit: [payload: ReflectionSubmitPayload]
}>()

const { t } = useI18n()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value)
})

const title = computed(() => (props.item ? t('reflection.editItemTitle') : t('reflection.addItemTitle')))

const form = reactive({ date: toDateString(new Date()), experience: '', reason: '', measure: '' })

// 每次打开都按传入的内容重置
watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    form.date = props.date || toDateString(new Date())
    form.experience = props.item?.experience || ''
    form.reason = props.item?.reason || ''
    form.measure = props.item?.measure || ''
  },
  { immediate: true }
)

function handleSubmit(): void {
  if (!props.date && !form.date) {
    ElMessage.warning(t('reflection.dateRequired'))
    return
  }
  if (!form.experience.trim()) {
    ElMessage.warning(t('reflection.experienceRequired'))
    return
  }

  emit('submit', {
    date: props.date || form.date,
    item: {
      experience: form.experience.trim(),
      reason: form.reason.trim() || null,
      measure: form.measure.trim() || null
    }
  })
}
</script>

<template>
  <el-dialog v-model="dialogVisible" :title="title" width="min(720px, 94vw)" :show-close="false">
    <el-form label-position="top">
      <!-- 表单复用:从列表页进来可以选日期,从详情页进来日期固定(禁用) -->
      <el-form-item :label="$t('reflection.dateLabel')" :required="!date">
        <el-date-picker
          v-model="form.date"
          type="date"
          value-format="YYYY-MM-DD"
          :disabled="!!date"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item :label="$t('reflection.experience')" required>
        <el-input
          v-model="form.experience"
          type="textarea"
          :rows="3"
          maxlength="500"
          show-word-limit
          :placeholder="$t('reflection.experiencePlaceholder')"
        />
      </el-form-item>

      <el-form-item :label="$t('reflection.reason')">
        <el-input v-model="form.reason" type="textarea" :rows="3" maxlength="500" show-word-limit />
      </el-form-item>

      <el-form-item :label="$t('reflection.measure')">
        <el-input v-model="form.measure" type="textarea" :rows="3" maxlength="500" show-word-limit />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">{{ $t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">{{ $t('common.save') }}</el-button>
    </template>
  </el-dialog>
</template>

