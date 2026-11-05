import i18n from '@/lang'
import { requestFile } from './request'

export type ExportResource = 'todos' | 'plans' | 'reflections'
export type ExportParamValue = string | number | boolean | null | undefined

export interface ExportDownload {
  blob: Blob
  fileName: string
  count: number
}

const TITLE_KEYS: Record<ExportResource, string> = {
  todos: 'todo.title',
  plans: 'plan.title',
  reflections: 'reflection.title'
}

function fileNameFromDisposition(value?: string): string {
  if (!value) return ''

  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(value)?.[1]
  if (encoded) {
    try {
      return decodeURIComponent(encoded)
    } catch {
      // 响应头异常时继续尝试普通 filename
    }
  }

  return /filename="?([^";]+)"?/i.exec(value)?.[1] || ''
}

function fallbackFileName(resource: ExportResource): string {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('')
  return `${i18n.global.t(TITLE_KEYS[resource])}-${stamp}.csv`
}

/**
 * 前端只传模块、筛选条件、界面语言和时区;
 * 查询、字段整理、CSV 生成与文件名全部由后端完成。
 */
export async function downloadExport(
  resource: ExportResource,
  params: Record<string, ExportParamValue> = {}
): Promise<ExportDownload> {
  const response = await requestFile({
    url: `/exports/${resource}`,
    method: 'get',
    params: {
      ...params,
      locale: i18n.global.locale.value,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    timeout: 60_000
  })

  const blob = response.data instanceof Blob
    ? response.data
    : new Blob([response.data as unknown as BlobPart])

  return {
    blob,
    fileName:
      fileNameFromDisposition(response.headers['content-disposition']) ||
      fallbackFileName(resource),
    count: Number(response.headers['x-export-count']) || 0
  }
}
