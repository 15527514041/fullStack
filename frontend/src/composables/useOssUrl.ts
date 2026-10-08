import { ref, unref, watch, type MaybeRef } from 'vue'
import { getUploadUrl, type UploadResult } from '@/api/upload'

// 缓存解析结果:私有文件拿到的是签名地址,带过期时间,过期后自动重新取
const cache = new Map<string, { meta: UploadResult; expiresAt: number }>()
const SAFETY_WINDOW = 30 * 1000 // 提前 30 秒视为过期,避免刚好踩到失效点

// 已经是完整地址或站内相对路径,直接返回(兼容老数据)
function isDirectUrl(value: string): boolean {
  return /^(https?:)?\/\//i.test(value) || value.startsWith('/')
}

/**
 * ossId → 可访问地址(带缓存与过期判断)
 * 上传组件、预览组件共用这一个入口,避免各自实现一套缓存
 */
export async function resolveOssUrl(ossId: string | null | undefined, force = false): Promise<string> {
  const meta = await resolveOssMeta(ossId, force)
  return meta?.url ?? ''
}

/**
 * ossId → 文件元信息(地址 + 类型 + 大小 + 原始文件名)
 * 上传组件、预览组件共用同一个缓存
 */
export async function resolveOssMeta(ossId: string | null | undefined, force = false): Promise<UploadResult | null> {
  if (!ossId) return null
  // 兼容老数据:直接存了 URL 的情况
  if (isDirectUrl(ossId)) {
    return { ossId, key: '', url: ossId, visibility: 'PUBLIC', expiresAt: null, size: 0, mime: '', originalName: null }
  }

  const cached = force ? undefined : cache.get(ossId)
  if (cached && cached.expiresAt - SAFETY_WINDOW > Date.now()) {
    return cached.meta
  }

  const result = await getUploadUrl(ossId)
  cache.set(ossId, {
    meta: result,
    expiresAt: result.expiresAt ? new Date(result.expiresAt).getTime() : Number.POSITIVE_INFINITY
  })
  return result
}

/**
 * 把 ossId 解析成可访问地址。
 * - 已经是 http(s) 完整地址或 / 开头的相对路径 → 原样返回(兼容老数据)
 * - 其它情况当 ossId,走后端「访问地址接口」并缓存
 */
export function useOssUrl(source: MaybeRef<string | null | undefined>) {
  const url = ref('')
  const loading = ref(false)

  async function resolve(value: string | null | undefined, force = false): Promise<void> {
    if (!value) {
      url.value = ''
      return
    }

    if (value.startsWith('/') || /^(https?:)?\/\//i.test(value)) {
      url.value = value
      return
    }

    loading.value = true
    try {
      url.value = await resolveOssUrl(value, force)
    } catch {
      url.value = ''
    } finally {
      loading.value = false
    }
  }

  watch(() => unref(source), (value) => resolve(value), { immediate: true })

  return { url, loading, refresh: () => resolve(unref(source), true) }
}
