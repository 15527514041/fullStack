import { ref, unref, watch, type MaybeRef } from 'vue'
import { getUploadUrl } from '@/api/upload'

// 缓存解析结果:私有文件拿到的是签名地址,带过期时间,过期后自动重新取
const cache = new Map<string, { url: string; expiresAt: number }>()
const SAFETY_WINDOW = 30 * 1000 // 提前 30 秒视为过期,避免刚好踩到失效点

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

    if (/^(https?:)?\/\//i.test(value) || value.startsWith('/')) {
      url.value = value
      return
    }

    const cached = force ? undefined : cache.get(value)
    if (cached && cached.expiresAt - SAFETY_WINDOW > Date.now()) {
      url.value = cached.url
      return
    }

    loading.value = true
    try {
      const result = await getUploadUrl(value)
      cache.set(value, {
        url: result.url,
        expiresAt: result.expiresAt ? new Date(result.expiresAt).getTime() : Number.POSITIVE_INFINITY
      })
      url.value = result.url
    } catch {
      url.value = ''
    } finally {
      loading.value = false
    }
  }

  watch(() => unref(source), (value) => resolve(value), { immediate: true })

  return { url, loading, refresh: () => resolve(unref(source), true) }
}
