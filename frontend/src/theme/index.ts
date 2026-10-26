import { computed, readonly, ref } from 'vue'
import {
  COLOR_THEMES,
  DEFAULT_COLOR_THEME,
  isColorThemeKey,
  type ColorThemeKey,
  type ThemeConfig
} from './config'

export type ThemeMode = 'light' | 'dark'

// 与 client 使用的 VueUse useDark 保持相同存储键，方便两端行为一致。
const STORAGE_KEY = 'vueuse-color-scheme'
const COLOR_STORAGE_KEY = 'confluo-color-theme'
const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

const themeModeState = ref<ThemeMode>('light')
const colorThemeState = ref<ColorThemeKey>(DEFAULT_COLOR_THEME)
let initialized = false

function readStoredTheme(): ThemeMode | null {
  try {
    const storedTheme = window.localStorage.getItem(STORAGE_KEY)
    return storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : null
  } catch {
    return null
  }
}

function getSystemTheme(): ThemeMode {
  return window.matchMedia?.(DARK_MEDIA_QUERY).matches ? 'dark' : 'light'
}

function readStoredColorTheme(): ColorThemeKey {
  try {
    const storedColorTheme = window.localStorage.getItem(COLOR_STORAGE_KEY)
    return isColorThemeKey(storedColorTheme) ? storedColorTheme : DEFAULT_COLOR_THEME
  } catch {
    return DEFAULT_COLOR_THEME
  }
}

function hexToRgb(hex: string): number[] {
  const normalized = hex.replace('#', '')
  const pairs = normalized.match(/.{2}/g)
  return pairs ? pairs.slice(0, 3).map((value) => Number.parseInt(value, 16)) : []
}

function rgbToHex(rgb: number[]): string {
  return `#${rgb.map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

function getLightColor(color: string, level: number): string {
  return rgbToHex(
    hexToRgb(color).map((value) => Math.floor((255 - value) * level + value))
  )
}

function getDarkColor(color: string, level: number): string {
  return rgbToHex(hexToRgb(color).map((value) => Math.floor(value * (1 - level))))
}

function writeExtendedVariables(root: HTMLElement, config: ThemeConfig): void {
  const variableMap: Array<[string, string, string]> = [
    ['--color-brand-secondary', 'brand', 'secondary'],
    ['--color-brand-accent', 'brand', 'accent'],
    ['--color-sub-secondary', 'sub', 'secondary'],
    ['--color-sub-white', 'sub', 'white'],
    ['--color-sub-black', 'sub', 'black']
  ]

  for (let index = 1; index <= 10; index += 1) {
    variableMap.push([`--color-sec-${index}`, 'sec', String(index)])
  }

  for (let index = 1; index <= 7; index += 1) {
    const brandKey = index === 6 ? 'primary' : String(index)
    variableMap.push([`--color-brand-${index}`, 'brand', brandKey])
    variableMap.push([`--color-sub-${index}`, 'sub', String(index)])
  }

  const functionalKeys = [
    'success-1',
    'success-2',
    'success-3',
    'success-5',
    'success-6',
    'success-7',
    'warning-1',
    'warning-2',
    'warning-3',
    'warning-5',
    'warning-6',
    'warning-7',
    'danger-1',
    'danger-2',
    'danger-3',
    'danger-5',
    'danger-6',
    'danger-7',
    'wait-1',
    'wait-2'
  ]

  for (const key of functionalKeys) {
    variableMap.push([`--color-${key}`, 'functional', key])
  }

  const neutralKeys = [
    'text',
    'fill',
    'text-1',
    'text-2',
    'text-3',
    'text-4',
    'bg-card',
    'bg-card-1',
    'bg-bottom',
    'border'
  ]
  for (const key of neutralKeys) {
    variableMap.push([`--color-${key}`, 'neutral', key])
  }

  for (const [cssVariable, section, key] of variableMap) {
    const value = config[section as keyof ThemeConfig][key]
    if (value) root.style.setProperty(cssVariable, value)
  }
}

function applyColorTheme(colorTheme: ColorThemeKey, mode: ThemeMode): void {
  const root = document.documentElement
  const config = COLOR_THEMES[colorTheme][mode]
  const primary = config.brand.primary
  const primaryRgb = hexToRgb(primary)

  writeExtendedVariables(root, config)

  root.dataset.colorTheme = colorTheme
  root.style.setProperty('--el-color-primary', primary)
  root.style.setProperty('--el-color-primary-rgb', primaryRgb.join(', '))

  for (let index = 1; index <= 9; index += 1) {
    const level = index / 10
    const shade = mode === 'dark' ? getDarkColor(primary, level) : getLightColor(primary, level)
    root.style.setProperty(`--el-color-primary-light-${index}`, shade)
    root.style.setProperty(
      `--el-color-primary-dark-${index}`,
      getDarkColor(primary, level)
    )
  }

  root.style.setProperty('--el-color-secondary', config.brand.secondary)
  root.style.setProperty('--el-color-accent', config.brand.accent)
  root.style.setProperty('--el-color-success', config.functional.success)
  root.style.setProperty('--el-color-warning', config.functional.warning)
  root.style.setProperty('--el-color-error', config.functional.error)
  root.style.setProperty('--el-color-info', config.functional.info)
  root.style.setProperty('--el-color-text', config.neutral.text || config.neutral['text-1'])
  root.style.setProperty('--el-color-fill', config.neutral.fill)
  root.style.setProperty('--el-color-border', config.neutral.border)

  root.style.setProperty('--el-bg-color', config.neutral['bg-card'])
  root.style.setProperty('--el-bg-color-page', config.neutral['bg-bottom'])
  root.style.setProperty('--el-bg-color-overlay', config.neutral['bg-card'])
  root.style.setProperty('--el-fill-color-blank', config.neutral['bg-card'])
  root.style.setProperty('--el-fill-color-light', config.neutral['bg-bottom'])
  root.style.setProperty('--el-text-color-primary', config.neutral['text-1'])
  root.style.setProperty('--el-text-color-regular', config.neutral['text-2'])
  root.style.setProperty('--el-text-color-secondary', config.neutral['text-3'])
  root.style.setProperty('--el-border-color', config.neutral.border)
  root.style.setProperty('--el-border-color-light', config.neutral.border)

  if (mode === 'dark') {
    root.style.setProperty('--el-fill-color', config.neutral['bg-card-1'])
    root.style.setProperty('--el-fill-color-lighter', config.neutral['bg-card'])
    root.style.setProperty('--el-fill-color-dark', getLightColor(config.neutral['bg-card-1'], 0.08))
    root.style.setProperty('--el-fill-color-darker', getLightColor(config.neutral['bg-card-1'], 0.14))
    root.style.setProperty('--color-divider', config.neutral.border)
  }

  root.style.setProperty(
    '--shadow-brand',
    `0 2px ${mode === 'dark' ? 10 : 8}px rgba(${primaryRgb.join(', ')}, ${mode === 'dark' ? 0.32 : 0.28})`
  )
}

function applyTheme(mode: ThemeMode, colorTheme: ColorThemeKey): void {
  const root = document.documentElement
  root.classList.toggle('dark', mode === 'dark')
  root.dataset.theme = mode
  applyColorTheme(colorTheme, mode)
}

export function setTheme(mode: ThemeMode, persist = true): void {
  themeModeState.value = mode
  applyTheme(mode, colorThemeState.value)

  if (!persist) return

  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // 浏览器禁用本地存储时，本次会话内仍然可以正常切换。
  }
}

export function setColorTheme(colorTheme: ColorThemeKey, persist = true): void {
  colorThemeState.value = colorTheme
  applyTheme(themeModeState.value, colorTheme)

  if (!persist) return

  try {
    window.localStorage.setItem(COLOR_STORAGE_KEY, colorTheme)
  } catch {
    // 浏览器禁用本地存储时，本次会话内仍然可以正常切换。
  }
}

export function initializeTheme(): void {
  const mode = readStoredTheme() || getSystemTheme()
  const colorTheme = readStoredColorTheme()
  themeModeState.value = mode
  colorThemeState.value = colorTheme
  applyTheme(mode, colorTheme)

  if (initialized || typeof window.matchMedia !== 'function') return
  initialized = true

  const colorScheme = window.matchMedia(DARK_MEDIA_QUERY)
  colorScheme.addEventListener('change', (event) => {
    // 用户明确选择过主题后，不再被系统主题覆盖。
    if (readStoredTheme()) return
    setTheme(event.matches ? 'dark' : 'light', false)
  })

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY && (event.newValue === 'light' || event.newValue === 'dark')) {
      setTheme(event.newValue, false)
      return
    }

    if (event.key === COLOR_STORAGE_KEY && isColorThemeKey(event.newValue)) {
      setColorTheme(event.newValue, false)
    }
  })
}

export function useTheme() {
  const isDark = computed(() => themeModeState.value === 'dark')
  const colorTheme = readonly(colorThemeState)

  function toggleTheme(): void {
    setTheme(isDark.value ? 'light' : 'dark')
  }

  return {
    themeMode: readonly(themeModeState),
    colorTheme,
    isDark,
    setColorTheme,
    setTheme,
    toggleTheme
  }
}
