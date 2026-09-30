<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import { syncDocumentTitle } from '@/router'

const { locale } = useI18n()

// Element Plus 组件自身的文案(分页、弹窗按钮、日期等)跟随当前语言
const elementLocale = computed(() => (locale.value === 'en_US' ? en : zhCn))

// 切语言后重新同步浏览器标题
watch(locale, syncDocumentTitle)
</script>

<template>
  <el-config-provider :locale="elementLocale">
    <router-view />
  </el-config-provider>
</template>
