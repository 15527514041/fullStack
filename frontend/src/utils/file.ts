// 文件相关的通用小工具(上传组件与预览组件共用)

/** 字节 → 可读大小,如 1.2 MB */
export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** 是否图片类型(按 mime 判断;没有 mime 时按扩展名兜底) */
export function isImageMime(mime?: string | null, name?: string | null): boolean {
  if (mime) return mime.startsWith('image/')
  if (!name) return false
  return /\.(png|jpe?g|webp|gif|bmp|heic)$/i.test(name)
}

/** 取扩展名(小写,不含点) */
export function getExtension(name?: string | null): string {
  if (!name || !name.includes('.')) return ''
  return name.slice(name.lastIndexOf('.') + 1).toLowerCase()
}

/** 触发浏览器下载(blob → 临时 a 标签,用完立刻撤销 objectURL) */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
