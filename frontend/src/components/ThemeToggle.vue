<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTheme } from '@/theme'
import themeDark from '@/assets/images/dark.png'
import themeLight from '@/assets/images/light.png'

const { t } = useI18n()
const { isDark, toggleTheme } = useTheme()

const tooltip = computed(() => t(isDark.value ? 'navbar.lightMode' : 'navbar.darkMode'))
const themeIcon = computed(() => (isDark.value ? themeDark : themeLight))
</script>

<template>
  <el-tooltip :content="tooltip" effect="light" placement="bottom" popper-class="app-tooltip">
    <button
      type="button"
      class="theme-toggle"
      :aria-label="tooltip"
      :aria-pressed="isDark"
      @click="toggleTheme"
    >
      <img :src="themeIcon" alt="" class="theme-icon" />
    </button>
  </el-tooltip>
</template>

<style scoped>
/* 与语言切换保持同一 34×34 的触发区尺寸和交互反馈 */
.theme-toggle {
  width: 34px;
  height: 34px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text-2);
  font-family: inherit;
  cursor: pointer;
  transition:
    color 0.3s ease,
    transform 0.3s ease,
    border-radius 0.3s ease,
    background-color 0.3s ease,
    box-shadow 0.3s ease;
}

.theme-toggle:hover {
  transform: translateY(-2px);
  border-radius: 12px;
  background: var(--el-border-color-light);
  color: var(--color-text-1);
  box-shadow: var(--shadow-nav-action);
}

.theme-toggle:active {
  transform: translateY(0);
}

.theme-toggle:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.theme-icon {
  display: block;
  width: 24px;
  height: 24px;
}
</style>
