<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { changePassword } from '@/api/user'

/**
 * 修改密码弹窗(个人中心入口)
 * - 表单项 / 校验规则与注册页一套:6-32 位 + 两次输入一致
 * - 提交成功后关掉自己,抛 success 给父组件,由父组件弹「修改成功」的提示弹窗
 */
const props = withDefaults(defineProps<{ visible: boolean }>(), { visible: false })
const emit = defineEmits<{
  'update:visible': [value: boolean]
  success: []
}>()

const { t } = useI18n()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value)
})

const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({ password: '', confirmPassword: '' })

const rules = computed<FormRules>(() => ({
  password: [
    { required: true, message: t('validation.passwordRequired'), trigger: 'blur' },
    { min: 6, max: 32, message: t('validation.passwordLength'), trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: t('validation.confirmRequired'), trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== form.password) {
          callback(new Error(t('validation.confirmMismatch')))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}))

// 每次打开都清空,避免上次的输入残留
watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    form.password = ''
    form.confirmPassword = ''
    formRef.value?.clearValidate()
  }
)

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await changePassword({ password: form.password, confirmPassword: form.confirmPassword })
    dialogVisible.value = false
    emit('success')
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="$t('password.title')"
    width="min(500px, 92vw)"
    :show-close="false"
    :close-on-click-modal="false"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @keyup.enter="handleSubmit">
      <el-form-item :label="$t('password.newPassword')" prop="password">
        <el-input
          v-model="form.password"
          type="password"
          :placeholder="$t('password.newPasswordPlaceholder')"
          show-password
          autocomplete="new-password"
        />
      </el-form-item>

      <el-form-item :label="$t('password.confirmPassword')" prop="confirmPassword">
        <el-input
          v-model="form.confirmPassword"
          type="password"
          :placeholder="$t('password.confirmPasswordPlaceholder')"
          show-password
          autocomplete="new-password"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">{{ $t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">{{ $t('password.submit') }}</el-button>
    </template>
  </el-dialog>
</template>
