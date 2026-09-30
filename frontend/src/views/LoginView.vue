<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const loading = ref(false)
const formRef = ref<FormInstance>()

const form = reactive({
  username: '',
  password: ''
})

const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 20, message: '用户名长度为 2-20 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 32, message: '密码长度为 6-32 个字符', trigger: 'blur' }
  ]
}

// 注册成功跳回时,预填用户名
onMounted(() => {
  if (typeof route.query.username === 'string') {
    form.username = route.query.username
  }
})

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await authStore.login({ ...form })
    ElMessage.success('登录成功')
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
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
      <div class="auth-title">欢迎回来</div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        size="large"
        @keyup.enter="handleSubmit"
      >
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" clearable autocomplete="username" />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            show-password
            autocomplete="current-password"
          />
        </el-form-item>

        <el-button type="primary" class="auth-btn" :loading="loading" @click="handleSubmit">登录</el-button>
      </el-form>

      <div class="auth-link">
        <span>没有账号?</span>
        <el-link type="primary" @click="router.push('/register')">去注册</el-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
  background: #fff;
}

.auth-box {
  width: 100%;
  max-width: 480px;
}

.auth-title {
  text-align: center;
  font-size: 28px;
  font-weight: bold;
  margin: 16px 0 36px;
}

.auth-btn {
  width: 100%;
  height: 50px;
  border-radius: 16px;
  font-size: 16px;
}

.auth-link {
  display: flex;
  justify-content: center;
  gap: 4px;
  margin-top: 20px;
  font-size: 14px;
  color: #606266;
}

:deep(.el-input) {
  --el-input-height: 48px;
}
</style>