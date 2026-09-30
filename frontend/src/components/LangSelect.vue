<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import flagCn from '@/assets/flags/cn.png'
import flagUs from '@/assets/flags/us.png'
import { setLanguage, type LanguageType } from '@/lang'

const { t, locale } = useI18n()

const flagMap: Record<LanguageType, string> = {
  zh_CN: flagCn,
  en_US: flagUs
}

const currentFlag = computed(() => flagMap[locale.value as LanguageType] || flagCn)

function handleLanguageChange(lang: LanguageType): void {
  if (locale.value === lang) return

  locale.value = lang
  setLanguage(lang)
  ElMessage.success(t('lang.switched'))
}
</script>

<template>
  <el-tooltip :content="t('navbar.language')" effect="light" placement="bottom" popper-class="app-tooltip">
    <el-dropdown
      trigger="click"
      popper-class="lang-dropdown-popper"
      class="lang-selector"
      @command="handleLanguageChange"
    >
      <img class="flag-icon" :src="currentFlag" alt="language" />

      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="zh_CN" :class="{ 'is-active': locale === 'zh_CN' }">
            <div class="language-option">
              <img class="flag-icon-small" :src="flagCn" alt="zh_CN" />
              <span>{{ t('lang.zh') }}</span>
            </div>
          </el-dropdown-item>
          <el-dropdown-item command="en_US" :class="{ 'is-active': locale === 'en_US' }">
            <div class="language-option">
              <img class="flag-icon-small" :src="flagUs" alt="en_US" />
              <span>{{ t('lang.en') }}</span>
            </div>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </el-tooltip>
</template>

<style scoped>
/* 参考 client:34×34 圆角触发区,里面是 24×24 圆形国旗 */
.lang-selector {
  width: 34px;
  height: 34px;
  padding: 6px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.lang-selector:hover {
  transform: translateY(-2px);
  border-radius: 12px;
  background: var(--el-border-color-light);
  box-shadow: 0 2px 8px rgba(229, 136, 136, 0.1);
}

.flag-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
  border-radius: 50%;
}

.language-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.flag-icon-small {
  width: 24px;
  height: 24px;
  object-fit: contain;
  border-radius: 2px;
}
</style>

<style>
/* 语言下拉气泡:样式与 client 一致(也和我们右上角个人中心弹框保持一致) */
.lang-dropdown-popper.el-dropdown__popper {
  padding: 0;
  background: var(--color-bg-card);
  border: 1px solid transparent;
  border-radius: 24px;
  box-shadow: 0 0 8px 1px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.lang-dropdown-popper.el-dropdown__popper .el-popper__arrow {
  display: none;
}

.lang-dropdown-popper.el-dropdown__popper .el-dropdown-menu {
  padding: 0;
  background: transparent;
}

.lang-dropdown-popper.el-dropdown__popper .el-dropdown-menu__item {
  height: 50px;
  padding: 0 20px;
  font-size: 14px;
  color: var(--color-text-2);
}

.lang-dropdown-popper.el-dropdown__popper .el-dropdown-menu__item:not(.is-disabled):hover,
.lang-dropdown-popper.el-dropdown__popper .el-dropdown-menu__item:not(.is-disabled):focus {
  background: var(--color-bg-bottom);
  color: var(--color-text-1);
}

/* 当前语言用主题色标识,不置灰 */
.lang-dropdown-popper.el-dropdown__popper .el-dropdown-menu__item.is-active {
  color: var(--color-brand-6);
}

.lang-dropdown-popper.el-dropdown__popper .el-dropdown-menu__item.is-active:hover,
.lang-dropdown-popper.el-dropdown__popper .el-dropdown-menu__item.is-active:focus {
  color: var(--color-brand-6);
}
</style>
