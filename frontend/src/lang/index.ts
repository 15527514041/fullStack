import { createI18n } from 'vue-i18n'
import zh_CN from './zh_CN'
import en_US from './en_US'

export type LanguageType = 'zh_CN' | 'en_US'

const STORAGE_KEY = 'confluo-language'

// 语言优先级:本地存储 → 浏览器语言 → 中文(和 client 的规则一致)
export function getLanguage(): LanguageType {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'zh_CN' || saved === 'en_US') return saved

  const systemLanguage = navigator.language.toLowerCase()
  return systemLanguage.includes('zh') ? 'zh_CN' : 'en_US'
}

export function setLanguage(lang: LanguageType): void {
  localStorage.setItem(STORAGE_KEY, lang)
}

const i18n = createI18n({
  globalInjection: true,
  allowComposition: true,
  legacy: false,
  locale: getLanguage(),
  fallbackLocale: 'zh_CN',
  messages: {
    zh_CN,
    en_US
  }
})

export default i18n

export type LanguageMessage = typeof zh_CN
