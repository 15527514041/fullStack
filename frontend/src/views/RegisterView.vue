<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const formRef = ref<FormInstance>()

const form = reactive({
  username: '',
  password: '',
  confirmPassword: ''
})

const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 20, message: '用户名长度为 2-20 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 32, message: '密码长度为 6-32 个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    {
      validator: (_rule, value, callback) => {
        if (!value) {
          callback(new Error('请再次输入密码'))
        } else if (value !== form.password) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await authStore.register({ username: form.username, password: form.password })
    ElMessage.success('注册成功,请登录')
    await router.replace({ name: 'login', query: { username: form.username } })
  } catch {
    // 错误提示已在 axios 拦截器统一处理
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-box">
      <div class="auth-title">创建账号</div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        size="large"
        @keyup.enter="handleSubmit"
      >
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="2-20 个字符" clearable autocomplete="username" />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="6-32 个字符"
            show-password
            autocomplete="new-password"
          />
        </el-form-item>

        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            show-password
            autocomplete="new-password"
          />
        </el-form-item>

        <el-button type="primary" class="auth-btn" :loading="loading" @click="handleSubmit">注册</el-button>
      </el-form>

      <div class="auth-link">
        <span>已有账号?</span>
        <el-link type="primary" @click="router.push('/login')">去登录</el-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 一屏布局:空间够时垂直居中,不够时可滚动,不会被裁掉 */
.auth-page {
  height: 100%;
  display: flex;
  /* 底部多留一个 navbar 高度(80px),把内容整体上移,视觉上相对"整屏"垂直居中 */
  padding: 24px 20px 104px;
  background: #fff;
  overflow-y: auto;
}

.auth-box {
  width: 100%;
  max-width: 420px;
  margin: auto;
}

.auth-title {
  text-align: center;
  font-size: 28px;
  font-weight: bold;
  margin: 0 0 36px;
}

.auth-btn {
  width: 100%;
  height: 50px;
  border-radius: 16px;
  font-size: 16px;
  margin-bottom: 20px;
}

.auth-link {
  display: flex;
  justify-content: center;
  gap: 4px;
  font-size: 14px;
  color: var(--color-text-2);
}

/* 外框 50px 走全局,内框 48px(和 client 登录页一致) */
:deep(.el-input) {
  --el-input-height: 48px;
}

:deep(.el-form-item) {
  margin-bottom: 30px;
}

/* 屏幕特别矮时压缩底部留白,减少滚动距离 */
@media (max-height: 700px) {
  .auth-page {
    padding-bottom: 24px;
  }
}
</style>
