export type ColorThemeKey = 'green' | 'blue' | 'gold'

interface ThemeSection {
  [key: string]: string
}

export interface ThemeConfig {
  brand: ThemeSection
  logo?: ThemeSection
  sec: ThemeSection
  sub: ThemeSection
  functional: ThemeSection
  neutral: ThemeSection
}

export interface ColorThemeOption {
  key: ColorThemeKey
  clientName: string
  labelKey: string
  light: ThemeConfig
  dark: ThemeConfig
}

const commonSec: ThemeSection = {
  '1': '#CDE6FF',
  '2': '#BCFBD0',
  '3': '#EDE4FF',
  '4': '#FFE4D7',
  '5': '#C3D1E1',
  '6': '#00F1A6',
  '7': '#EBBAFE',
  '8': '#FFCAD6',
  '9': '#FFED76',
  '10': '#231AEA'
}

const commonFunctional: ThemeSection = {
  success: '#00CB8D',
  'success-1': '#E8FFEF',
  'success-2': '#BCFBD0',
  'success-3': '#96ECB1',
  'success-5': '#00E19B',
  'success-6': '#00CB8D',
  'success-7': '#009B60',
  warning: '#EB9825',
  'warning-1': '#FFF6ED',
  'warning-2': '#FFE4BA',
  'warning-3': '#FFCF8B',
  'warning-5': '#D38313',
  'warning-6': '#EB9825',
  'warning-7': '#A5660F',
  error: '#F53F3F',
  'danger-1': '#FFEFEB',
  'danger-2': '#FDCDC5',
  'danger-3': '#FBACA3',
  'danger-5': '#F76560',
  'danger-6': '#F53F3F',
  'danger-7': '#CB272D',
  info: '#86909C',
  'wait-1': '#395BFF',
  'wait-2': '#ECF4FF'
}

const commonDarkFunctional: ThemeSection = {
  success: '#00CB8D',
  'success-1': '#004D35',
  'success-2': '#00875D',
  'success-3': '#1C7B5E',
  'success-5': '#00F1A6',
  'success-6': '#00E19B',
  'success-7': '#00A666',
  warning: '#EB9825',
  'warning-1': '#3A2C10',
  'warning-2': '#74501D',
  'warning-3': '#B37A30',
  'warning-5': '#D38313',
  'warning-6': '#EB9825',
  'warning-7': '#A5660F',
  error: '#F53F3F',
  'danger-1': '#3A1A1A',
  'danger-2': '#793737',
  'danger-3': '#B35050',
  'danger-5': '#F76560',
  'danger-6': '#F53F3F',
  'danger-7': '#CB272D',
  info: '#86909C',
  'wait-1': '#3D91FF',
  'wait-2': '#17275A'
}

export const COLOR_THEMES: Record<ColorThemeKey, ColorThemeOption> = {
  green: {
    key: 'green',
    clientName: 'Confluo-Green',
    labelKey: 'preferences.themeGreen',
    light: {
      sec: {
        '1': '#99EED1',
        '2': '#7EDCF0',
        '3': '#FFEA8D',
        '4': '#DDFFF3',
        '5': '#D7F8FF',
        '6': '#FFF6CC',
        '7': '#EBBAFE',
        '8': '#FFCAD6',
        '9': '#FFED76',
        '10': '#231AEA'
      },
      brand: {
        primary: '#03A05E',
        secondary: '#003411',
        accent: '#FF7D00',
        '1': '#E7F8F1',
        '2': '#B6EBD5',
        '3': '#76D1AB',
        '4': '#0DD782',
        '5': '#047546',
        '7': '#05462B'
      },
      // 绿色 Logo 使用独立的鲜绿渐变，和品牌界面主色分开控制。
      logo: {
        'main-light': '#10B757',
        'main-dark': '#06913F',
        'soft-light': '#8BD9B2',
        'soft-dark': '#76CF9E',
        dot: '#22C23B'
      },
      sub: {
        secondary: '#003411',
        white: '#FFFFFF',
        black: '#000000',
        '1': '#E6F2EB',
        '2': '#BFDBCB',
        '3': '#7FB897',
        '4': '#3D8C5E',
        '5': '#00280D',
        '6': '#003411',
        '7': '#001A08'
      },
      functional: commonFunctional,
      neutral: {
        text: '#131C27',
        fill: '#4E5969',
        'text-1': '#131C27',
        'text-2': '#364B60',
        'text-3': '#949BA6',
        'text-4': '#CACED4',
        'bg-card': '#FFFFFF',
        'bg-card-1': '#FFFFFF',
        'bg-bottom': '#F6F6F6',
        border: '#ECEEF2'
      }
    },
    dark: {
      sec: {
        '1': '#59C4B0',
        '2': '#53B9D6',
        '3': '#E6C868',
        '4': '#82E7CF',
        '5': '#86DEF7',
        '6': '#EED892',
        '7': '#EBBAFE',
        '8': '#FFCAD6',
        '9': '#FFED76',
        '10': '#231AEA'
      },
      brand: {
        primary: '#23B57B',
        secondary: '#1C7C3C',
        accent: '#FF7D00',
        '1': '#163529',
        '2': '#163B2C',
        '3': '#1A543D',
        '4': '#1E7050',
        '5': '#3DD79A',
        '7': '#4ACD97'
      },
      // 深色模式保持同一套绿色 Logo 色值。
      logo: {
        'main-light': '#10B757',
        'main-dark': '#06913F',
        'soft-light': '#8BD9B2',
        'soft-dark': '#76CF9E',
        dot: '#22C23B'
      },
      sub: {
        secondary: '#1C7C3C',
        white: '#FFFFFF',
        black: '#000000',
        '1': '#0A271C',
        '2': '#063B14',
        '3': '#064319',
        '4': '#07481D',
        '5': '#339956',
        '6': '#1C7C3C',
        '7': '#4CC472'
      },
      functional: commonDarkFunctional,
      neutral: {
        fill: '#4E5969',
        'text-1': '#FFFFFF',
        'text-2': '#BCC4CD',
        'text-3': '#878D95',
        'text-4': '#52575F',
        'bg-card': '#181818',
        'bg-card-1': '#222222',
        'bg-bottom': '#0A0A0A',
        border: '#2A2A2A'
      }
    }
  },
  blue: {
    key: 'blue',
    clientName: 'Confluo-Blue',
    labelKey: 'preferences.themeBlue',
    light: {
      sec: commonSec,
      brand: {
        primary: '#0B2DCD',
        secondary: '#000000',
        accent: '#FF7D00',
        '1': '#EAF3FF',
        '2': '#CDE6FF',
        '3': '#91C3FF',
        '4': '#2A48D6',
        '5': '#0E1C47',
        '7': '#061244'
      },
      sub: {
        secondary: '#000000',
        white: '#FFFFFF',
        black: '#000000',
        '1': '#EEF2F7',
        '2': '#BCC8D9',
        '3': '#8D9EBA',
        '4': '#4A6278',
        '5': '#233347',
        '6': '#000000',
        '7': '#000000'
      },
      functional: commonFunctional,
      neutral: {
        text: '#131C27',
        fill: '#4E5969',
        'text-1': '#131C27',
        'text-2': '#364B60',
        'text-3': '#607D96',
        'text-4': '#BCC8D9',
        'bg-card': '#FFFFFF',
        'bg-card-1': '#FFFFFF',
        'bg-bottom': '#F3F6FB',
        border: '#EEF2F7'
      }
    },
    dark: {
      sec: commonSec,
      brand: {
        primary: '#4162FF',
        secondary: '#FFFFFF',
        accent: '#FF7D00',
        '1': '#0B1842',
        '2': '#23316B',
        '3': '#1A2C63',
        '4': '#5DA3FE',
        '5': '#051A75',
        '7': '#0E28BD'
      },
      sub: {
        secondary: '#FFFFFF',
        white: '#FFFFFF',
        black: '#000000',
        '1': '#131C27',
        '2': '#2A3D54',
        '3': '#4A6278',
        '4': '#EEF2F7',
        '5': '#D9E2EC',
        '6': '#FFFFFF',
        '7': '#FFFFFF'
      },
      functional: commonDarkFunctional,
      neutral: {
        fill: '#4E5969',
        'text-1': '#FFFFFF',
        'text-2': '#BCC4CD',
        'text-3': '#87919E',
        'text-4': '#3E454F',
        'bg-card': '#141414',
        'bg-card-1': '#222222',
        'bg-bottom': '#0A0A0A',
        border: '#222222'
      }
    }
  },
  gold: {
    key: 'gold',
    clientName: 'Confluo-Gold',
    labelKey: 'preferences.themeGold',
    light: {
      sec: commonSec,
      brand: {
        primary: '#9D8343',
        secondary: '#172A88',
        accent: '#FF7D00',
        '1': '#F8F3E6',
        '2': '#D9C8A0',
        '3': '#BAA97B',
        '4': '#AB9660',
        '5': '#AE9250',
        '7': '#88703A'
      },
      sub: {
        secondary: '#172A88',
        white: '#FFFFFF',
        black: '#000000',
        '1': '#EDF3FF',
        '2': '#B4C0E2',
        '3': '#8093CB',
        '4': '#4C66B4',
        '5': '#2D4590',
        '6': '#172A88',
        '7': '#142470'
      },
      functional: commonFunctional,
      neutral: {
        text: '#1D2129',
        fill: '#4E5969',
        'text-1': '#1D2129',
        'text-2': '#4E5969',
        'text-3': '#86909C',
        'text-4': '#C9CDD4',
        'bg-card': '#FFFFFF',
        'bg-card-1': '#FFFFFF',
        'bg-bottom': '#F2F3F5',
        border: '#E5E6EB'
      }
    },
    dark: {
      sec: commonSec,
      brand: {
        primary: '#CAA64F',
        secondary: '#3B66D6',
        accent: '#FF7D00',
        '1': '#3B301A',
        '2': '#665530',
        '3': '#8D7846',
        '4': '#A68A46',
        '5': '#D4B45C',
        '7': '#A8883F'
      },
      sub: {
        secondary: '#3B66D6',
        white: '#FFFFFF',
        black: '#000000',
        '1': '#121F47',
        '2': '#1F3576',
        '3': '#37509B',
        '4': '#2F52C0',
        '5': '#4B76E6',
        '6': '#3B66D6',
        '7': '#2F52C0'
      },
      functional: commonDarkFunctional,
      neutral: {
        fill: '#4E5969',
        'text-1': '#FFFFFF',
        'text-2': '#C9CDD4',
        'text-3': '#86909C',
        'text-4': '#4B556A',
        'bg-card': '#0E111D',
        'bg-card-1': '#080A12',
        'bg-bottom': '#040717',
        border: '#1D2129'
      }
    }
  }
}

export const DEFAULT_COLOR_THEME: ColorThemeKey = 'green'

export function isColorThemeKey(value: string | null): value is ColorThemeKey {
  return value === 'green' || value === 'blue' || value === 'gold'
}
