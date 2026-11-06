<script setup lang="ts">
import { useRouter } from 'vue-router'
import BackButton from '@/components/BackButton.vue'

const router = useRouter()
const adminEmail = import.meta.env.VITE_ADMIN_EMAIL?.trim() || '842806078@qq.com'

function goToLogin(): void {
  router.push('/login')
}

function contactAdmin(): void {
  window.location.href = `mailto:${adminEmail}?subject=${encodeURIComponent('申请重置 Confluo 账号密码')}`
}
</script>

<template>
  <div class="forgot-page">
    <div class="forgot-box">
      <div class="forgot-header">
        <BackButton :custom-action="goToLogin" />
        <div class="forgot-title">{{ $t('forgotPassword.title') }}</div>
      </div>

      <div class="notice-card">
        <div class="notice-title">{{ $t('forgotPassword.noticeTitle') }}</div>
        <p class="notice-text">{{ $t('forgotPassword.notice') }}</p>
      </div>

      <div class="contact-card">
        <div class="contact-title">{{ $t('forgotPassword.contactTitle') }}</div>
        <p class="contact-text">{{ $t('forgotPassword.contactTip') }}</p>
        <div class="email-label">{{ $t('forgotPassword.emailLabel') }}</div>
        <a class="admin-email" :href="`mailto:${adminEmail}`">{{ adminEmail }}</a>
      </div>

      <el-button type="primary" class="contact-button" @click="contactAdmin">
        {{ $t('forgotPassword.contactAction') }}
      </el-button>

      <div class="login-link">
        <span>{{ $t('forgotPassword.hasAccount') }}</span>
        <el-link type="primary" :underline="false" @click="goToLogin">
          {{ $t('forgotPassword.goLogin') }}
        </el-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.forgot-page {
  min-height: 100%;
  padding: 32px 20px 40px;
  background: var(--el-bg-color);
}

.forgot-box {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
}

.forgot-header {
  position: relative;
  min-height: 36px;
  margin: 16px 0 36px;
}

.forgot-title {
  padding: 0 52px;
  font-size: 28px;
  font-weight: bold;
  line-height: 36px;
  text-align: center;
  color: var(--color-text-1);
}

.notice-card,
.contact-card {
  border-radius: 16px;
}

.notice-card {
  padding: 20px;
  border: 1px solid var(--el-color-warning-light-7);
  background: var(--el-color-warning-light-9);
}

.notice-title,
.contact-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
}

.notice-text,
.contact-text {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--color-text-2);
}

.contact-card {
  margin-top: 20px;
  padding: 24px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-card-1);
}

.email-label {
  margin-top: 22px;
  font-size: 13px;
  color: var(--color-text-3);
}

.admin-email {
  display: inline-block;
  margin-top: 6px;
  color: var(--el-color-primary);
  font-size: 17px;
  font-weight: 600;
  text-decoration: none;
  word-break: break-all;
}

.admin-email:hover {
  text-decoration: underline;
}

.contact-button {
  width: 100%;
  height: 50px;
  margin: 24px 0 20px;
  border-radius: 16px;
  font-size: 16px;
}

.login-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 14px;
  color: var(--color-text-2);
}

@media (max-width: 768px) {
  .forgot-page {
    padding: 24px 16px 32px;
  }

  .forgot-header {
    margin: 12px 0 28px;
  }

  .forgot-title {
    font-size: 24px;
  }

  .notice-card,
  .contact-card {
    padding: 18px;
  }
}
</style>
