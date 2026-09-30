<script setup lang="ts">
import LogoMark from '@/components/LogoMark.vue'
import LangSelect from '@/components/LangSelect.vue'
</script>

<template>
  <div class="auth-wrapper">
    <!-- 只展示 logo 的导航栏(右上角个人中心不显示) -->
    <header class="navbar">
      <div class="navbar-left">
        <div class="logo-mark"><LogoMark /></div>
        <span class="logo-text">Confluo</span>
      </div>

      <div class="navbar-right">
        <LangSelect />
      </div>
    </header>

    <main class="auth-main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.auth-wrapper {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}

.navbar {
  flex: none;
  height: 80px;
  display: flex;
  align-items: center;
  padding: 0 32px 0 0;
  background: var(--el-bg-color);
}

.navbar-left {
  height: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding-left: 28px;
}

/* 右侧语言切换 */
.navbar-right {
  height: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.logo-mark {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: var(--color-text-1);
  white-space: nowrap;
}

.auth-main {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

@media (max-width: 768px) {
  .navbar {
    height: 64px;
    padding: 0 12px 0 0;
  }

  .navbar-left {
    padding-left: 12px;
    gap: 8px;
  }

  .logo-text {
    font-size: 17px;
  }
}
</style>
