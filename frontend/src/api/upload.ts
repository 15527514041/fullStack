import { request } from './request'

export type UploadVisibility = 'PUBLIC' | 'PRIVATE'

// 后端上传接口返回的结构
export interface UploadResult {
  /** 对外唯一标识,业务表里存这个(不要存 URL) */
  ossId: string
  /** OSS 对象 key,形如 public/uploads/2026/10/xxx.png */
  key: string
  /** 原始文件名(带扩展名),文件类附件展示用 */
  originalName?: string | null
  /** 公共文件是永久直链;私有文件是带签名的临时地址 */
  url: string
  visibility: UploadVisibility
  /** 私有地址的过期时间(公共直链为 null),前端据此决定何时重新取地址 */
  expiresAt: string | null
  size: number
  mime: string
}

/**
 * 上传:前端 → 后端 → OSS
 * - visibility=PUBLIC(默认) 走 /uploads/public,返回永久直链
 * - visibility=PRIVATE 走 /uploads/private,返回签名地址
 * 业务侧只保存 ossId,展示时用 useOssUrl 换地址
 */
export function uploadFile(
  file: File,
  options: { folder?: string; visibility?: UploadVisibility; onProgress?: (percent: number) => void } = {}
): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  if (options.folder) formData.append('folder', options.folder)

  const url = options.visibility === 'PRIVATE' ? '/uploads/private' : '/uploads/public'

  return request<UploadResult>({
    url,
    method: 'post',
    data: formData,
    timeout: 60000, // 大图/慢网络,给足超时
    onUploadProgress: (event) => {
      if (!options.onProgress || !event.total) return
      options.onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
    }
  })
}

/**
 * 访问地址接口:按 ossId 换地址(库里只存 ossId 时用,换 CDN/私有桶前端不用改)
 * download=true 时后端会签成「带 content-disposition」的地址,浏览器直接下载
 */
export function getUploadUrl(ossId: string, options: { download?: boolean } = {}): Promise<UploadResult> {
  return request<UploadResult>({
    url: `/uploads/${ossId}`,
    method: 'get',
    params: options.download ? { download: 1 } : undefined
  })
}

/** 删除文件(同时删 OSS 对象与记录) */
export function deleteUpload(ossId: string): Promise<void> {
  return request<void>({ url: `/uploads/${ossId}`, method: 'delete' })
}
